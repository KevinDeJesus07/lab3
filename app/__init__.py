from flask import Flask
from flask_socketio import SocketIO

socketio = SocketIO()

def create_app():
    app = Flask(
        __name__,
        template_folder='../templates',
        static_folder='../static'
    )

    app.config['SECRET_KEY'] = 'key'

    from app.routes import main_bp
    app.register_blueprint(main_bp)

    from app import socket_events

    socketio.init_app(app)

    return app