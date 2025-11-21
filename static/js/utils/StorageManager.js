/**
 * Gestiona el almacenamiento local de datos del juego
 */
class StorageManager {
    constructor() {
        this.keys = {
            ROOM_CODE: 'uno_room_code',
            USERNAME: 'uno_username',
            IS_HOST: 'uno_is_host'
        };
    }

    /**
     * Guarda los datos de la sesión actual
     */
    saveSession(roomCode, username, isHost) {
        localStorage.setItem(this.keys.ROOM_CODE, roomCode);
        localStorage.setItem(this.keys.USERNAME, username);
        localStorage.setItem(this.keys.IS_HOST, isHost ? 'true' : 'false');
    }

    /**
     * Obtiene los datos de la sesión guardada
     */
    getSession() {
        return {
            roomCode: localStorage.getItem(this.keys.ROOM_CODE),
            username: localStorage.getItem(this.keys.USERNAME),
            isHost: localStorage.getItem(this.keys.IS_HOST) === 'true'
        };
    }

    /**
     * Limpia la sesión actual
     */
    clearSession() {
        localStorage.removeItem(this.keys.ROOM_CODE);
        localStorage.removeItem(this.keys.USERNAME);
        localStorage.removeItem(this.keys.IS_HOST);
    }

    /**
     * Actualiza solo el estado de host
     */
    setIsHost(isHost) {
        localStorage.setItem(this.keys.IS_HOST, isHost ? 'true' : 'false');
    }
}

export default StorageManager;