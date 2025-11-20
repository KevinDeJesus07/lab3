import eventlet
from flask import Flask
from flask_socketio import SocketIO
import os

socketio = SocketIO(
    cors_allowed_origins="*", 
    async_mode='eventlet',
    logger=True,
    engineio_logger=True
)

def create_app():
    app = Flask(
        __name__,
        template_folder='../templates',
        static_folder='../static'
    )

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'uno-secret-key')

    from app.routes import main_bp
    app.register_blueprint(main_bp)

    from app import socket_events

    socketio.init_app(app)

    return app