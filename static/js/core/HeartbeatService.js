/**
 * Servicio de heartbeat para mantener la conexión activa
 */
class HeartbeatService {
    constructor(socket) {
        this.socket = socket;
        this.interval = null;
        this.intervalDuration = 5000; // 5 segundos
    }

    /**
     * Inicia el envío de heartbeats
     */
    start() {
        if (this.interval) {
            console.warn('⚠️ Heartbeat ya está activo');
            return;
        }

        this.interval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat');
            }
        }, this.intervalDuration);

        console.log('💓 Heartbeat iniciado');
    }

    /**
     * Detiene el envío de heartbeats
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('💔 Heartbeat detenido');
        }
    }

    /**
     * Reinicia el heartbeat
     */
    restart() {
        this.stop();
        this.start();
    }
}

export default HeartbeatService;