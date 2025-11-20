from app import create_app, socketio
import os

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = '0.0.0.0' if os.environ.get('RENDER') or os.environ.get('PORT') else 'localhost'
    socketio.run(app, debug=False, host=host, allow_unsafe_werkzeug=True, port=port)