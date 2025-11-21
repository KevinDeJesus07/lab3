/**
 * Gestiona la información de la URL y la navegación
 */
class URLManager {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    /**
     * Obtiene información del contexto actual desde la URL
     * @returns {Object} { roomCode, username, isHost, context }
     */
    getContextFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const path = window.location.pathname;
        
        const context = this._identifyContext(path);
        const session = this.storage.getSession();
        
        let roomCode = null;
        let username = urlParams.get('username') || session.username || 'Jugador';
        let isHost = session.isHost;

        // Extraer room code si estamos en lobby o play
        if (context === 'lobby' || context === 'play') {
            roomCode = path.split(`/${context}/`)[1] || '';
        }

        console.log('📍 Contexto de URL:', {
            path,
            context,
            roomCode,
            username,
            isHost
        });

        return { roomCode, username, isHost, context };
    }

    /**
     * Identifica el contexto actual de la página
     * @private
     */
    _identifyContext(path) {
        if (path.includes('/lobby/')) return 'lobby';
        if (path.includes('/play/')) return 'play';
        if (path === '/create') return 'create';
        if (path === '/join') return 'join';
        return 'home';
    }

    /**
     * Verifica si estamos en una sala activa
     */
    isInActiveRoom() {
        const { context } = this.getContextFromURL();
        return context === 'lobby' || context === 'play';
    }

    /**
     * Construye URL para redirigir al lobby
     */
    buildLobbyURL(roomCode, username) {
        return `/lobby/${roomCode}?username=${encodeURIComponent(username)}`;
    }

    /**
     * Construye URL para redirigir al juego
     */
    buildPlayURL(roomCode, username) {
        return `/play/${roomCode}?username=${encodeURIComponent(username)}`;
    }
}

export default URLManager;