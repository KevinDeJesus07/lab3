from flask_socketio import emit, join_room, leave_room
from flask import request
from app import socketio
import random
import string

rooms = {} # Diccionario temporal por rapidez. Posteriormente, implementaremos la clase

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')
    emit('connected', {'message': 'Conectado al servidor UNO'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Cliente desconectado: {request.sid}')

    for room_code, room_data in list(rooms.items()):
        if room_data['host_sid'] == request.sid:
            del rooms[room_code]
            print(f'Sala {room_code} eliminada (host desconectado)')
            emit('room_closed', {'message': 'El host abandonó la sala'}, room=room_code)
        else:
            room_data['players'] = [p for p in room_data['players'] if p['sid'] != request.sid]
            if room_data['players']:
                emit('player_left', {
                    'players': room_data['players'],
                    'message': 'Un jugador abandonó la sala'
                }, room=room_code)

@socketio.on('create_room')
def handle_create_room(data):
    room_name = data.get('room_name', 'Sala UNO')
    username = data.get('username', 'Jugador')
    
    room_code = generate_room_code()
    while room_code in rooms:
        room_code = generate_room_code()
    
    rooms[room_code] = {
        'name': room_name,
        'host_sid': request.sid,
        'players': [{'sid': request.sid, 'username': username}],
        'game_started': False
    }
    
    join_room(room_code)
    
    print(f'Sala creada: {room_code} por {username}')
    emit('room_created', {
        'room_code': room_code,
        'room_name': room_name,
        'message': f'Sala {room_name} creada exitosamente'
    })
    
    emit('player_joined', {
        'username': username,
        'players': rooms[room_code]['players']
    }, room=room_code)

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data.get('room_code', '').upper()
    username = data.get('username', 'Jugador')
    
    if room_code not in rooms:
        emit('join_error', {'message': 'Sala no encontrada'})
        return
    
    room = rooms[room_code]
    
    if len(room['players']) >= 4:
        emit('join_error', {'message': 'La sala está llena (máximo 4 jugadores)'})
        return
    
    if room['game_started']:
        emit('join_error', {'message': 'El juego ya comenzó en esta sala'})
        return
    
    existing_usernames = [p['username'] for p in room['players']]
    if username in existing_usernames:
        emit('join_error', {'message': 'Este nombre de usuario ya está en uso en la sala'})
        return
    
    room['players'].append({'sid': request.sid, 'username': username})
    join_room(room_code)
    
    print(f'{username} se unió a la sala {room_code}')
    emit('room_joined', {
        'room_code': room_code,
        'room_name': room['name'],
        'message': f'Te uniste a {room["name"]}'
    })
    
    emit('player_joined', {
        'username': username,
        'players': room['players']
    }, room=room_code)

@socketio.on('start_game')
def handle_start_game(data):
    room_code = data.get('room_code')
    if room_code in rooms:
        room = rooms[room_code]
        if room['host_sid'] == request.sid:
            room['game_started'] = True
            emit('game_started', {'message': '¡El juego comienza!'}, room=room_code)
            print(f'Juego iniciado en sala {room_code}')