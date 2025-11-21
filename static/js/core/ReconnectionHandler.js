/**
 * Maneja la lógica de reconexión automática
 */
class ReconnectionHandler {
    constructor(socket, urlManager) {
        this.socket = socket;
        this.urlManager = urlManager;
        this.maxAttempts = 5;
        this.currentAttempt = 0;
    }

    /**
     * Configura los eventos de reconexión
     */
    setupReconnectionEvents() {
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Intento de reconexión ${attemptNumber}/${this.maxAttempts}`);
            this.currentAttempt = attemptNumber;
            this._updateStatus(`Reconectando... (${attemptNumber})`, 'reconnecting');
        });

        this.socket.on('reconnect', () => {
            console.log('✅ Reconexión exitosa');
            this.currentAttempt = 0;
            this._updateStatus('Reconectado', 'connected');
        });

        this.socket.on('reconnect_failed', () => {
            console.error('❌ Reconexión fallida después de varios intentos');
            this._updateStatus('No se pudo reconectar', 'error');
            this._showReconnectionModal();
        });
    }

    /**
     * Intenta reconectar a una sala específica
     */
    attemptRoomReconnection(roomCode, username, oldSid) {
        if (!this.urlManager.isInActiveRoom()) {
            console.log('ℹ️ No hay sala activa para reconectar');
            return;
        }

        console.log('🔄 Reconectando a sala:', roomCode);
        
        this.socket.emit('request_reconnect', {
            room_code: roomCode,
            username: username,
            old_sid: oldSid
        });
    }

    /**
     * Fuerza una reconexión manual
     */
    forceReconnect() {
        console.log('🔄 Forzando reconexión manual...');
        this.socket.disconnect();
        this.socket.connect();
    }

    /**
     * Actualiza el estado de conexión en la UI
     * @private
     */
    _updateStatus(message, statusClass) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${statusClass}`;
        }
    }

    /**
     * Muestra modal de reconexión manual
     * @private
     */
    _showReconnectionModal() {
        const existingModal = document.getElementById('reconnection-modal');
        if (existingModal) return;

        const modal = document.createElement('div');
        modal.id = 'reconnection-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        z-index: 10000;">
                <h3>Conexión perdida</h3>
                <p>No se pudo reconectar automáticamente.</p>
                <button onclick="window.reconnectionHandler.forceReconnect()" 
                        style="margin-right: 10px; padding: 10px 20px; cursor: pointer;">
                    Reintentar
                </button>
                <button onclick="window.location.reload()" 
                        style="padding: 10px 20px; cursor: pointer;">
                    Recargar página
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

export default ReconnectionHandler;