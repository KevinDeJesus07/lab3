from flask import Blueprint, render_template, request

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/create')
def create_room():
    return render_template('create_room.html')

@main_bp.route('/join')
def join_room():
    return render_template('join_room.html')

@main_bp.route('/lobby/<room_code>')
def game_room(room_code):
    username = request.args.get('username', 'Jugador')
    return render_template('lobby.html', room_code=room_code, username=username)

@main_bp.route('/play/<room_code>')
def play_game(room_code):
    username = request.args.get('username', 'Jugador')
    return render_template('game_room.html', room_code=room_code, username=username)