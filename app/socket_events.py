from flask_socketio import emit, join_room, leave_room
from flask import request
from app import socketio
import random
import string
import threading
import time

class RoomManager:
    def __init__(self):
        self.rooms = {}
        self.lock = threading.Lock()
        self.player_heartbeats = {}  # SID -> timestamp
        self.heartbeat_interval = 5  # segundos
        self.start_heartbeat_checker()
    
    def start_heartbeat_checker(self):
        """Verifica cada 5 segundos si los jugadores siguen conectados"""
        def check_heartbeats():
            while True:
                time.sleep(self.heartbeat_interval)
                with self.lock:
                    current_time = time.time()
                    disconnected_sids = []
                    
                    for sid, last_heartbeat in self.player_heartbeats.items():
                        if current_time - last_heartbeat > self.heartbeat_interval * 2:
                            disconnected_sids.append(sid)
                    
                    # Marcar desconectados
                    for sid in disconnected_sids:
                        self.mark_player_offline(sid)
                        print(f'💔 Heartbeat perdido para SID: {sid}')
        
        threading.Thread(target=check_heartbeats, daemon=True).start()
    
    def mark_player_offline(self, player_sid):
        """Marca un jugador como offline"""
        for room_code, room in self.rooms.items():
            for player in room['players']:
                if player['sid'] == player_sid:
                    player['is_online'] = False
                    room['last_activity'] = time.time()
                    
                    # Notificar a la sala
                    socketio.emit('player_offline', {
                        'players': room['players'],
                        'host_sid': room['host_sid']
                    }, room=room_code)
                    break
    
    def update_heartbeat(self, player_sid):
        """Actualiza el timestamp del último heartbeat"""
        self.player_heartbeats[player_sid] = time.time()
    
    # ===== MÉTODOS ORIGINALES QUE FALTABAN =====
    
    def create_room(self, room_name, host_sid, username):
        with self.lock:
            room_code = self._generate_room_code()
            while room_code in self.rooms:
                room_code = self._generate_room_code()
            
            self.rooms[room_code] = {
                'name': room_name,
                'host_sid': host_sid,
                'players': [{
                    'sid': host_sid, 
                    'username': username,
                    'is_online': True,
                    'is_host': True
                }],
                'game_started': False,
                'game_state': None,
                'created_at': time.time(),
                'last_activity': time.time()
            }
            return room_code
    
    def join_room(self, room_code, player_sid, username):
        with self.lock:
            if room_code not in self.rooms:
                return False, "Sala no encontrada"
            
            room = self.rooms[room_code]
            room['last_activity'] = time.time()
            
            # Verificar si el jugador ya existe (reconexión)
            for player in room['players']:
                if player['username'] == username:
                    player['sid'] = player_sid
                    player['is_online'] = True
                    return True, "Reconectado exitosamente"
            
            # Jugador nuevo
            if len(room['players']) >= 4:
                return False, "La sala está llena (máximo 4 jugadores)"
            
            if room['game_started']:
                return False, "El juego ya comenzó en esta sala"
            
            existing_usernames = [p['username'] for p in room['players']]
            if username in existing_usernames:
                return False, "Este nombre de usuario ya está en uso en la sala"
            
            room['players'].append({
                'sid': player_sid, 
                'username': username,
                'is_online': True,
                'is_host': False
            })
            return True, "Unido exitosamente"
    
    def remove_player(self, player_sid):
        with self.lock:
            removed_rooms = []
            
            for room_code, room in list(self.rooms.items()):
                # Buscar al jugador en esta sala y marcarlo como offline
                player_found = False
                for player in room['players']:
                    if player['sid'] == player_sid:
                        player['is_online'] = False
                        player_found = True
                        print(f'Jugador {player["username"]} marcado como offline en sala {room_code}')
                        
                        # Si era el host, solo marcamos como offline, NO eliminamos la sala
                        if room['host_sid'] == player_sid:
                            print(f'Host {player_sid} desconectado en sala {room_code} - Esperando reconexión')
                        break
                
                # Solo eliminar sala si está completamente vacía por más de 2 minutos
                online_players = [p for p in room['players'] if p['is_online']]
                if not online_players and (time.time() - room['last_activity'] > 120):
                    removed_rooms.append(room_code)
            
            # Eliminar solo salas completamente vacías por más de 2 minutos
            for room_code in removed_rooms:
                del self.rooms[room_code]
                print(f'Sala {room_code} eliminada por inactividad completa')
            
            return removed_rooms
    
    def start_game(self, room_code, player_sid):
        with self.lock:
            if room_code not in self.rooms:
                return False, "Sala no encontrada"
            
            room = self.rooms[room_code]
            
            if room['host_sid'] != player_sid:
                return False, "Solo el host puede iniciar el juego"
            
            online_players = [p for p in room['players'] if p['is_online']]
            if len(online_players) < 2:
                return False, "Se necesitan al menos 2 jugadores conectados para comenzar"
            
            if room['game_started']:
                return False, "El juego ya comenzó"
            
            room['game_started'] = True
            return True, "Juego iniciado"
    
    def get_room(self, room_code):
        return self.rooms.get(room_code)
    
    def get_room_by_player_sid(self, player_sid):
        """Obtener la sala donde está un jugador por su SID"""
        for room_code, room in self.rooms.items():
            for player in room['players']:
                if player['sid'] == player_sid:
                    return room_code, room
        return None, None
    
    def _generate_room_code(self):
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# Instancia global del RoomManager
room_manager = RoomManager()

@socketio.on('connect')
def handle_connect():
    print(f'🟢 Cliente conectado: {request.sid}')
    
    # Buscar si este cliente estaba en alguna sala (reconexión)
    room_code, room = room_manager.get_room_by_player_sid(request.sid)
    if room:
        # Actualizar el SID del jugador en la sala
        for player in room['players']:
            if player['sid'] == request.sid:
                player['sid'] = request.sid
                player['is_online'] = True
                room['last_activity'] = time.time()
                
                print(f'🔄 Jugador {player["username"]} reconectado en sala {room_code}')
                
                # Unirse a la sala nuevamente
                join_room(room_code)
                
                # Notificar a TODOS en la sala sobre la reconexión
                emit('player_online', {
                    'username': player['username'],
                    'players': room['players'],
                    'host_sid': room['host_sid']
                }, room=room_code)
                break
    
    emit('connected', {
        'message': 'Conectado al servidor UNO',
        'sid': request.sid
    })

@socketio.on('heartbeat')
def handle_heartbeat():
    room_manager.update_heartbeat(request.sid)
    # Responder para confirmar que el servidor está vivo
    emit('heartbeat_ack', {'timestamp': time.time()})

@socketio.on('request_reconnect')
def handle_reconnect(data):
    room_code = data.get('room_code')
    username = data.get('username')
    old_sid = data.get('old_sid')  # SID anterior del cliente
    
    print(f'🔄 Intentando reconexión: {username} -> Sala {room_code}')
    
    room = room_manager.get_room(room_code)
    if not room:
        emit('reconnect_failed', {'message': 'Sala no encontrada'})
        return
    
    # Buscar al jugador por username (más confiable que por SID)
    player_found = False
    for player in room['players']:
        if player['username'] == username:
            # VERIFICAR SI ES EL HOST
            is_host = player['sid'] == room['host_sid']
            
            # Actualizar SID
            old_player_sid = player['sid']
            player['sid'] = request.sid
            player['is_online'] = True
            room['last_activity'] = time.time()
            
            # Si era el host, actualizar el host_sid de la sala
            if is_host:
                room['host_sid'] = request.sid
                print(f'👑 Host {username} reconectado con nuevo SID: {request.sid}')
            
            # Unir a la sala con el nuevo SID
            join_room(room_code)
            
            # Limpiar heartbeat antiguo
            if old_player_sid in room_manager.player_heartbeats:
                del room_manager.player_heartbeats[old_player_sid]
            
            player_found = True
            
            # Notificar a todos sobre la reconexión
            emit('player_reconnected', {
                'username': username,
                'players': room['players'],
                'host_sid': room['host_sid']
            }, room=room_code)
            
            # Enviar estado completo al cliente reconectado
            emit('room_state_sync', {
                'players': room['players'],
                'host_sid': room['host_sid'],
                'game_started': room['game_started'],
                'your_username': username,
                'you_are_host': is_host  # ✅ ENVIAR SI ES HOST
            })
            
            print(f'✅ Jugador {username} reconectado en sala {room_code}')
            break
    
    if not player_found:
        emit('reconnect_failed', {'message': 'Jugador no encontrado en la sala'})

@socketio.on('sync_room_state')
def handle_sync_room_state(data):
    room_code = data.get('room_code')
    username = data.get('username')
    
    room = room_manager.get_room(room_code)
    if room:
        # Enviar estado completo de la sala solo a este cliente
        emit('room_state_sync', {
            'players': room['players'],
            'host_sid': room['host_sid'],
            'game_started': room['game_started'],
            'your_username': username
        })

@socketio.on('disconnect')
def handle_disconnect():
    print(f'🔴 Cliente desconectado: {request.sid}')
    
    # Buscar la sala del jugador primero
    room_code, room = room_manager.get_room_by_player_sid(request.sid)
    
    if room:
        # Marcar jugador como offline
        for player in room['players']:
            if player['sid'] == request.sid:
                player['is_online'] = False
                room['last_activity'] = time.time()
                print(f'Jugador {player["username"]} marcado como offline en sala {room_code}')
                break
        
        # Notificar a TODOS en la sala que el jugador está offline
        emit('player_offline', {
            'players': room['players'],
            'host_sid': room['host_sid']
        }, room=room_code)
    
    # Limpiar heartbeat
    if request.sid in room_manager.player_heartbeats:
        del room_manager.player_heartbeats[request.sid]
    
    # Verificar salas inactivas
    removed_rooms = room_manager.remove_player(request.sid)
    
    # Notificar solo si se eliminó alguna sala
    for room_code in removed_rooms:
        emit('room_closed', {'message': 'La sala ha sido cerrada por inactividad'}, room=room_code)

@socketio.on('create_room')
def handle_create_room(data):
    room_name = data.get('room_name', 'Sala UNO')
    username = data.get('username', 'Jugador')
    
    room_code = room_manager.create_room(room_name, request.sid, username)
    join_room(room_code)
    
    room = room_manager.get_room(room_code)
    
    print(f'🏠 Sala creada: {room_code} por {username}')
    print(f'   Jugadores en sala: {[p["username"] for p in room["players"]]}')
    
    emit('room_created', {
        'room_code': room_code,
        'room_name': room_name,
        'message': f'Sala {room_name} creada exitosamente'
    })
    
    # Notificar a TODOS en la sala (en este caso solo el host)
    emit('player_joined', {
        'username': username,
        'players': room['players'],
        'host_sid': room['host_sid']
    }, room=room_code)

@socketio.on('join_room')
def handle_join_room(data):
    print(f'📞 EVENTO JOIN_ROOM RECIBIDO: {data}')
    print(f'📋 Datos procesados: room_code={data.get("room_code", "").upper()}, username={data.get("username", "")}')
    
    room_code = data.get('room_code', '').upper()
    username = data.get('username', 'Jugador')
    is_reconnect = data.get('is_reconnect', False)
    
    success, message = room_manager.join_room(room_code, request.sid, username)
    print(f'📊 Resultado join_room: success={success}, message={message}')
    
    if not success:
        print(f'❌ ENVIANDO ERROR: {message}')
        emit('join_error', {'message': message})
        return
    
    print(f'✅ ENVIANDO EXITO: {message}')
    room = room_manager.get_room(room_code)
    
    # RESPUESTA AL CLIENTE QUE SE UNIÓ
    emit('room_joined', {
        'room_code': room_code,
        'room_name': room['name'],
        'message': f'Te uniste a {room["name"]}'
    })
    
    # NOTIFICAR A TODOS EN LA SALA
    emit('player_joined', {
        'username': username,
        'players': room['players'],
        'host_sid': room['host_sid']
    }, room=room_code)
    
    print(f'🎉 RESPUESTA ENVIADA AL CLIENTE Y SALA {room_code}')

@socketio.on('start_game')
def handle_start_game(data):
    room_code = data.get('room_code')
    
    print(f'🎮 Host iniciando partida en sala: {room_code}')
    
    room = room_manager.get_room(room_code)
    if not room:
        emit('start_error', {'message': 'Sala no encontrada'})
        return
    
    if room['host_sid'] != request.sid:
        emit('start_error', {'message': 'Solo el host puede iniciar el juego'})
        return
    
    online_players = [p for p in room['players'] if p['is_online']]
    if len(online_players) < 2:
        emit('start_error', {'message': 'Se necesitan al menos 2 jugadores conectados'})
        return
    
    if room['game_started']:
        emit('start_error', {'message': 'El juego ya comenzó'})
        return
    
    # INICIAR EL JUEGO
    room['game_started'] = True
    print(f'✅ JUEGO INICIADO en sala {room_code}')
    
    # NOTIFICAR A TODOS LOS JUGADORES QUE SE REDIRIJAN
    emit('game_started_redirect', {
        'redirect_url': f'/play/{room_code}',
        'message': '¡El juego está comenzando!'
    }, room=room_code)
    
    print(f'🔄 REDIRIGIENDO A TODOS a: /play/{room_code}')

# Evento para forzar actualización de lista de jugadores
@socketio.on('request_players_update')
def handle_request_players_update(data):
    room_code = data.get('room_code')
    room = room_manager.get_room(room_code)
    
    if room:
        emit('players_update', {
            'players': room['players'],
            'host_sid': room['host_sid']
        }, room=room_code)

# ===== EVENTOS DEL JUEGO =====
@socketio.on('request_game_state')
def handle_request_game_state(data):
    room_code = data.get('room_code')
    room = room_manager.get_room(room_code)
    
    if room and room.get('game_started'):
        emit('game_state_update', {
            'current_card': room['game_state']['current_card'],
            'current_player': room['game_state']['current_player'],
            'players': room['game_state']['players'],
            'player_hand': room['game_state']['players_hands'].get(request.sid, [])
        })

@socketio.on('play_card')
def handle_play_card(data):
    room_code = data.get('room_code')
    username = data.get('username')
    card_index = data.get('card_index')
    
    print(f'🎯 Carta jugada por {username}: índice {card_index}')
    
    room = room_manager.get_room(room_code)
    if room and room.get('game_started'):
        # TODO: Implementar con tus models card.py y deck.py
        # Por ahora, simulación básica:
        
        # Simular jugada exitosa
        card_played = {"number": "5", "color": "red"}  # ← Reemplazar con tu lógica
        new_card = {"number": "7", "color": "blue"}   # ← Reemplazar con tu lógica
        next_player = "Jugador2"                      # ← Reemplazar con tu lógica
        
        print(f'✅ Carta jugada: {card_played}')
        
        # Notificar a TODOS que se jugó una carta
        emit('card_played', {
            'username': username,
            'card': card_played,
            'new_current_card': new_card
        }, room=room_code)
        
        # Cambiar turno
        emit('turn_changed', {
            'current_player': next_player
        }, room=room_code)
        
        print(f'➡️ Turno cambiado a: {next_player}')