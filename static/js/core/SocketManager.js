/**
 * Gestiona la conexión WebSocket y eventos básicos
 */
class SocketManager {
    constructor(urlManager, storageManager) {
        this.urlManager = urlManager;
        this.storage = storageManager;
        this.socket = null;
        this.isConnected = false;
        this.sid = null;
        this.eventHandlers = new Map();
    }

    /**
     * Conecta al servidor WebSocket
     */
    connect() {
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000' 
            : 'https://lab3-8l6a.onrender.com';

        this.socket = io(serverUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 20000,
        });

        this._setupCoreEvents();
        console.log('🔌 Conectando al servidor:', serverUrl);
    }

    /**
     * Configura eventos básicos de conexión
     * @private
     */
    _setupCoreEvents() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.sid = this.socket.id;
            console.log('✅ Conectado al servidor, SID:', this.sid);
            this._trigger('connected', { sid: this.sid });
        });

        this.socket.on('reconnect', () => {
            this.sid = this.socket.id;          // <-- NUEVO
            console.log('✅ Re-conectado, nuevo SID:', this.sid);
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('🔴 Desconectado del servidor');
            this._trigger('disconnected');
        });

        this.socket.on('heartbeat_ack', () => {
            console.log('💓 Heartbeat confirmado');
        });
    }

    /**
     * Registra un manejador de eventos personalizado
     */
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
        this.socket.on(eventName, handler);
    }

    /**
     * Registra un manejador de eventos que se ejecuta una sola vez
     */
    once(eventName, handler) {
        this.socket.once(eventName, handler);
    }

    /**
     * Emite un evento al servidor
     */
    emit(eventName, data) {
        if (!this.isConnected) {
            console.error('❌ No se puede emitir, no conectado:', eventName);
            return false;
        }
        this.socket.emit(eventName, data);
        return true;
    }

    /**
     * Dispara manejadores locales
     * @private
     */
    _trigger(eventName, data) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    /**
     * Obtiene el socket.io cliente
     */
    getSocket() {
        return this.socket;
    }

    /**
     * Verifica si está conectado
     */
    isSocketConnected() {
        return this.isConnected && this.socket && this.socket.connected;
    }
}

export default SocketManager;