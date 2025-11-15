from flask import Blueprint, render_template

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