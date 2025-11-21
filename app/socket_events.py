from flask import request
from flask_socketio import emit, join_room
from app import socketio
from app.services.room_manager import RoomManager
from app.models.game import UnoGame # Importar la clase del juego

# Instancia única del gestor
room_manager = RoomManager(socketio)

# Diccionario global para almacenar instancias de juegos ACTIVOS por room_code
# Esto es opcional si RoomManager ya lo hace, pero es una buena práctica:
# active_games = {} 

# ==========================================
# GESTIÓN DE CONEXIÓN Y SALAS (SIN CAMBIOS MAYORES)
# ==========================================

@socketio.on('connect')
def on_connect():
    print(f'🟢 Conectado: {request.sid}')
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def on_disconnect():
    print(f'🔴 Desconectado: {request.sid}')
    # La lógica de desconexión la maneja el heartbeat y el room_manager.

@socketio.on('heartbeat')
def on_heartbeat():
    room_manager.update_heartbeat(request.sid)
    emit('heartbeat_ack', {})

@socketio.on('create_room')
def handle_create(data):
    code = room_manager.create_room(
        data.get('room_name'), request.sid, data.get('username')
    )
    join_room(code)
    emit('room_created', {'room_code': code})

@socketio.on('join_room')
def handle_join(data):
    code = data.get('room_code', '').upper()
    success, msg = room_manager.join_room(code, request.sid, data.get('username'))
    
    if not success:
        emit('join_error', {'message': msg})
        return

    join_room(code)
    room = room_manager.get_room(code)
    
    # Si es reconexión y hay juego, sincronizar
    if room.get('game_started', False): # Mejor usar 'game_started' flag
        emit('game_started_redirect', {'redirect_url': f'/play/{code}'})
    else:
        emit('room_joined', {'room_code': code, 'room_name': room['name']})
        emit('player_joined', {'players': room['players']}, room=code)

@socketio.on('sync_room_state')
def handle_sync(data):
    # Lógica de sincronización de sala (Lobby)
    code = data.get('room_code')
    username = data.get('username')
    
    room = room_manager.get_room(code)
    
    if not room: return # Sala no existe
    
    # 1. Búsqueda y Actualización del SID para reconexión
    player_found = False
    is_host_in_sync = False # Variable local para el cliente que se conecta
    
    for p in room['players']:
        if p['username'] == username:
            
            # CRUCIAL: Capturamos el estado antes de la actualización
            was_host = (p['sid'] == room['host_sid'])
            
            if p['sid'] != request.sid:
                print(f"♻️ Auto-reconexión en Sync: {username} ({p['sid']} -> {request.sid})")
            
            # Actualizar el SID del jugador en la lista
            p['sid'] = request.sid
            p['is_online'] = True
            player_found = True
            
            # 2. Lógica de Corrección del Host:
            if was_host:
                # Si el jugador ERA el host (con el SID viejo), actualizamos el SID de la sala.
                room['host_sid'] = request.sid
                is_host_in_sync = True
            else:
                # Si no era el Host original, chequeamos si lo es ahora (por si se reconectó otro antes).
                is_host_in_sync = (p['sid'] == room['host_sid'])
            
            break
    
    # 3. Unir al canal de SocketIO (CRÍTICO)
    join_room(code)
    
    # 4. Preparar datos para el cliente (is_host para la UI del botón de inicio)
    players_data = []
    for p in room['players']:
        p_copy = p.copy()
        # Calculamos el is_host de cada jugador con el host_sid actualizado de la sala
        p_copy['is_host'] = (p['sid'] == room['host_sid'])
        players_data.append(p_copy)
        
    # 5. Emitir respuesta
    print(f"📤 Enviando Sync a {username} en sala {code}. Host: {is_host_in_sync}. Sala Host SID: {room['host_sid']}")
    
    emit('room_state_sync', {
        'players': players_data,
        'game_started': room.get('game_started', False),
        'your_username': username,
        'you_are_host': is_host_in_sync # Se envía la variable ya resuelta.
    })
    
    # 6. Notificar a los DEMÁS que este jugador revivió
    if player_found:
        emit('player_online', {
            'username': username,
            'players': players_data,
            'host_sid': room['host_sid']
        }, room=code, include_self=False)

# ==========================================
# LÓGICA DE JUEGO (MODIFICADAS/NUEVAS)
# ==========================================

@socketio.on('start_game')
def handle_start(data):
    """Llama al RoomManager para iniciar el juego y redirige a la sala."""
    code = data.get('room_code')
    
    # 1. El RoomManager se encarga de: validar si el SID es el host, 
    #    verificar el número de jugadores e instanciar el UnoGame.
    success, msg = room_manager.start_game(code, request.sid)
    
    if success:
        # 2. Si es exitoso, redireccionamos a todos los jugadores.
        emit('game_started_redirect', {
            'redirect_url': f'/play/{code}'
        }, room=code)
    else:
        # 3. Si falla (no es host, pocos jugadores), se notifica solo al host.
        emit('start_error', {'message': msg})

@socketio.on('initialize_game')
def handle_init_game(data):
    room_code = data.get('room_code')
    # CRÍTICO: Necesitamos el username, si no viene en 'data', asume que se pasó al redirigir.
    # Si tu frontend envía el username aquí, úsalo:
    username = data.get('username') 

    room = room_manager.get_room(room_code)
    
    if not room or not room.get('game'): 
        emit('init_error', {'message': 'Juego no inicializado o sala no encontrada.'})
        return

    game = room['game']
    
    # 1. ENCONTRAR EL SID VIEJO USANDO EL USERNAME DENTRO DEL JUEGO
    
    # Intenta encontrar el jugador en la estructura del juego (que aún tiene el SID viejo)
    # Buscamos el jugador dentro del objeto UnoGame, no en room['players']
    old_sid_in_game = None
    if username:
        # game.players es la lista de dicts {'sid': ..., 'username': ...}
        for p in game.players:
            if p['username'] == username:
                old_sid_in_game = p['sid']
                break

    # 2. MIGRAR SID si encontramos el viejo y es diferente al actual
    if old_sid_in_game and old_sid_in_game != request.sid:
        print(f"🔄 Migrando SID en UnoGame: {username} ({old_sid_in_game} -> {request.sid})")
        game.update_player_sid(old_sid_in_game, request.sid)
        
        # Además, actualiza el room['players'] para mantener la consistencia
        for p in room['players']:
            if p['username'] == username:
                p['sid'] = request.sid
                break
    
    # 3. Unir al canal y Obtener Estado
    join_room(room_code) 
    state = game.get_game_state_for_player(request.sid)
    
    emit('game_state_update', state)

@socketio.on('play_card')
def handle_play(data):
    """MODIFICADA: Maneja la jugada de carta, validación y efectos."""
    room_code = data.get('room_code')
    room = room_manager.get_room(room_code)
    if not room or not room.get('game'): return

    game = room['game']
    
    try:
        # Parámetros del Frontend
        card_index = data.get('card_index')
        declared_color = data.get('declared_color') # Necesario para wild/draw4

        # La lógica pesada está en game.py, solo llamamos:
        result = game.play_card(request.sid, card_index, declared_color)
        
        # 1. Notificar victoria
        if result['status'] == 'win':
            emit('game_ended', {'winner': game.winner}, room=room_code)
            # Opcional: limpiar la instancia de juego aquí
            # room['game'] = None 
            return

        # 2. Notificar grito de UNO (si es necesario)
        if len(game.players_hands.get(request.sid, [])) == 1:
             emit('uno_status', {'username': game.current_player_data['username']}, room=room_code)

        # 3. Notificar jugada a todos y actualizar estado
        emit('card_played', {
            'username': game.current_player_data['username'], 
            'card': result['card'] # Esto puede usarse para la animación
        }, room=room_code)
        
        _broadcast_game_state(room)

    except ValueError as e:
        # Error de turno, jugada inválida, o color no declarado
        emit('play_error', {'message': str(e)})

@socketio.on('draw_card')
def handle_draw(data):
    """MODIFICADA: Permite al jugador robar una carta y pasa el turno."""
    room_code = data.get('room_code')
    room = room_manager.get_room(room_code)
    if not room or not room.get('game'): return
    
    game = room['game']
    
    try:
        # draw_card ahora maneja la validación de turno y el avance
        game.draw_card(request.sid)
        
        # Notificar que se robó carta (para la animación visual del mazo)
        emit('player_drew_card', {'username': game.current_player_data['username']}, room=room_code)
        
        _broadcast_game_state(room)

    except ValueError as e:
        emit('draw_error', {'message': str(e)})


def _broadcast_game_state(room):
    """MODIFICADA: Helper para enviar el estado actualizado a todos, usando el nuevo método."""
    game = room['game']
    
    # Enviar a cada jugador su vista personalizada (estado público + su mano)
    for p in room['players']:
        if p.get('is_online', True):
            # Usamos get_game_state_for_player que calcula el estado público + mano privada
            state = game.get_game_state_for_player(p['sid'])
            emit('game_state_update', state, to=p['sid'])