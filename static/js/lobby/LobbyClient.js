/**
 * Maneja la lógica del lobby (crear/unirse a salas)
 */
class LobbyClient {
    constructor(socketManager, urlManager, storageManager) {
        this.socket = socketManager;
        this.urlManager = urlManager;
        this.storage = storageManager;
        this.currentRoom = null;
        this.username = null;
        this.isHost = false;
    }

    /**
     * Inicializa el cliente del lobby
     */
    init(username, roomCode, isHost) {
        this.username = username;
        this.currentRoom = roomCode;
        this.isHost = isHost;
        this._setupLobbyEvents();
    }

    /**
     * Crea una nueva sala
     */
    createRoom(roomName, username) {
        if (!this.socket.isSocketConnected()) {
            alert('No estás conectado al servidor');
            return;
        }

        this.username = username;
        
        this.socket.emit('create_room', {
            room_name: roomName,
            username: username
        });

        console.log('🏠 Creando sala:', roomName);
    }

    /**
     * Se une a una sala existente
     */
    joinRoom(roomCode, username) {
        if (!this.socket.isSocketConnected()) {
            alert('No estás conectado al servidor');
            return;
        }

        // Prevenir unirse a la misma sala
        if (this.currentRoom === roomCode) {
            alert('Ya estás en esta sala');
            return;
        }

        this.username = username;
        this.currentRoom = roomCode;

        console.log('🚪 Uniéndose a sala:', roomCode);
        
        this.socket.emit('join_room', {
            room_code: roomCode,
            username: username
        });
    }

    /**
     * Inicia el juego (solo host)
     */
    startGame(roomCode) {
        if (!this.socket.isSocketConnected()) {
            alert('No estás conectado al servidor');
            return;
        }

        if (!this.isHost) {
            alert('Solo el host puede iniciar el juego');
            return;
        }

        console.log('🎮 Iniciando juego en sala:', roomCode);
        
        this.socket.emit('start_game', {
            room_code: roomCode
        });
    }

    /**
     * Configura eventos del lobby
     * @private
     */
    _setupLobbyEvents() {
        this.socket.on('room_created', (data) => this._handleRoomCreated(data));
        this.socket.on('room_joined', (data) => this._handleRoomJoined(data));
        this.socket.on('join_error', (data) => this._handleJoinError(data));
        this.socket.on('player_joined', (data) => this._handlePlayerJoined(data));
        this.socket.on('player_left', (data) => this._handlePlayerLeft(data));
        this.socket.on('player_online', (data) => this._handlePlayerOnline(data));
        this.socket.on('player_offline', (data) => this._handlePlayerOffline(data));
        this.socket.on('room_state_sync', (data) => this._handleRoomStateSync(data));
        this.socket.on('game_started_redirect', (data) => this._handleGameStarted(data));
    }

    /**
     * Manejadores de eventos
     * @private
     */
    _handleRoomCreated(data) {
        console.log('✅ Sala creada:', data);
        
        this.isHost = true;
        this.currentRoom = data.room_code;
        
        this.storage.saveSession(data.room_code, this.username, true);
        
        const url = this.urlManager.buildLobbyURL(data.room_code, this.username);
        window.location.href = url;
    }

    _handleRoomJoined(data) {
        console.log('✅ Unido a sala:', data);
        
        this.currentRoom = data.room_code;
        this.isHost = false;
        
        this.storage.saveSession(data.room_code, this.username, false);
        
        const url = this.urlManager.buildLobbyURL(data.room_code, this.username);
        window.location.href = url;
    }

    _handleJoinError(data) {
        console.error('❌ Error al unirse:', data.message);
        alert(`Error: ${data.message}`);
    }

    _handlePlayerJoined(data) {
        console.log('🟢 Jugador unido:', data.username);
        this._trigger('players_update', data);
    }

    _handlePlayerLeft(data) {
        console.log('🔴 Jugador salió:', data);
        this._trigger('players_update', data);
    }

    _handlePlayerOnline(data) {
        console.log('🟢 Jugador online:', data.username);
        this._trigger('players_update', data);
    }

    _handlePlayerOffline(data) {
        console.log('🔴 Jugador offline:', data);
        this._trigger('players_update', data);
    }

    _handleRoomStateSync(data) {
        console.log('🔄 Sincronización de sala:', data);
        
        // Actualizar estado local
        const myPlayer = data.players.find(p => p.username === data.your_username);
        if (myPlayer) {
            this.isHost = data.you_are_host || false;
            this.storage.setIsHost(this.isHost);
        }
        
        this._trigger('players_update', data);
    }

    _handleGameStarted(data) {
        console.log('🎮 Juego iniciado, redirigiendo...');
        window.location.href = `${data.redirect_url}?username=${encodeURIComponent(this.username)}`;
    }

    /**
     * Dispara eventos personalizados
     * @private
     */
    _trigger(eventName, data) {
        const event = new CustomEvent(`lobby:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }
}

export default LobbyClient;