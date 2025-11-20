class UNOClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.currentRoom = null;
        this.playerHand = [];
        this.isHost = false;
        this.username = '';
        this.roomCode = '';
        this.mySid = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.heartbeatInterval = null;
        this.lastConnectionState = null;
        
        this.init();
    }
    
    init() {
        this.connectToServer();
        this.setupEventListeners();
        this.getRoomInfoFromURL();
        this.startHeartbeat();
    }

    startHeartbeat() {
        // Enviar heartbeat cada 5 segundos
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.socket) {
                this.socket.emit('heartbeat');
            }
        }, 5000);
    }
    
    connectToServer() {
        const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : 'https://tu-app.onrender.com';

        this.socket = io(serverUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: this.maxReconnectAttempts,
            timeout: 20000,
        });
        
        // Eventos de reconexión automática
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Intentando reconexión ${attemptNumber}/${this.maxReconnectAttempts}`);
            this.updateConnectionStatus(`Reconectando... (${attemptNumber})`, 'reconnecting');
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('✅ Reconexión exitosa!');
            this.handleReconnect();
        });
        
        this.socket.on('reconnect_failed', () => {
            console.error('❌ Falló reconexión después de varios intentos');
            this.updateConnectionStatus('No se pudo reconectar', 'error');
            this.showReconnectionModal();
        });
        
        // Resto de eventos...
        this.socket.on('heartbeat_ack', (data) => {
            console.log('💓 Heartbeat confirmado por servidor');
        });

        this.socket.on('room_created', (data) => this.handleRoomCreated(data));
        this.socket.on('room_joined', (data) => this.handleRoomJoined(data));
        this.socket.on('join_error', (data) => this.handleJoinError(data));
        this.socket.on('player_joined', (data) => this.handlePlayerJoined(data));
        this.socket.on('player_left', (data) => this.handlePlayerLeft(data));
        this.socket.on('player_online', (data) => this.handlePlayerOnline(data));
        this.socket.on('player_offline', (data) => this.handlePlayerOffline(data));
        this.socket.on('players_update', (data) => this.handlePlayersUpdate(data));
        this.socket.on('game_started', (data) => this.handleGameStarted(data));
        this.socket.on('game_state_update', (data) => this.handleGameStateUpdate(data));
        this.socket.on('thread_info', (data) => this.handleThreadInfo(data));

        this.socket.on('room_state_sync', (data) => this.handleRoomStateSync(data));
        this.socket.on('reconnect_failed', (data) => this.handleReconnectFailed(data));
        this.socket.on('player_reconnected', (data) => this.handlePlayerReconnected(data));

        this.socket.on('game_started_redirect', (data) => this.handleGameStartedRedirect(data));
        
        this.socket.on('connect', () => {
            this.handleConnect();
        });
        
        this.socket.on('disconnect', () => {
            this.handleDisconnect();
        });
    }
    
    handleThreadInfo(data) {
        console.log('🧵 INFORMACIÓN DE HILOS:');
        console.log(`   - Hilos activos en servidor: ${data.active_threads}`);
        console.log(`   - Tu ID de hilo: ${data.your_thread_id}`);
        console.log(`   - Esto significa: ${data.active_threads} cliente(s) conectado(s)`);
    }

    handleConnect() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus('Conectado al servidor', 'connected');
        console.log('Conectado al servidor, ID:', this.socket.id);
        
        // Guardar el SID actual
        this.mySid = this.socket.id;
        
        // Si estamos en una sala REAL, intentar reconectar
        if (this.roomCode && this.roomCode !== 'create' && this.roomCode !== 'join' && this.username) {
            setTimeout(() => {
                this.handleReconnect();
            }, 500);
        }
    }

    handleReconnect() {
        console.log('🔄 Manejando reconexión...');
        
        // SOLO reconectar si estamos realmente en una sala
        if (this.roomCode && this.roomCode !== 'create' && this.roomCode !== 'join' && this.username) {
            console.log('🔄 Intentando reconectar a sala:', this.roomCode);
            this.socket.emit('request_reconnect', {
                room_code: this.roomCode,
                username: this.username,
                old_sid: this.mySid
            });
        } else {
            console.log('ℹ️ No hay sala para reconectar, esperando...');
            // No hacer nada, el usuario está en proceso de crear/unirse
        }
    }
    
    handleDisconnect() {
        this.isConnected = false;
        this.updateConnectionStatus('Desconectado - Intentando reconectar...', 'disconnected');
        console.log('Desconectado del servidor');
    }

    showReconnectionModal() {
        // Crear modal de reconexión manual
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3>Conexión perdida</h3>
                <p>No se pudo reconectar automáticamente.</p>
                <button onclick="window.unoClient.forceReconnect()" style="margin-right: 10px;">
                    Reintentar
                </button>
                <button onclick="window.location.reload()">
                    Recargar página
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    forceReconnect() {
        console.log('🔄 Forzando reconexión manual...');
        this.socket.disconnect();
        this.socket.connect();
    }

    handleRoomStateSync(data) {
        console.log('🔄 Sincronización de estado de sala:', data);
        
        // Determinar si este cliente es el host
        const myPlayer = data.players.find(p => p.username === data.your_username);
        if (myPlayer) {
            this.isHost = data.you_are_host || false;  // ✅ Usar valor del servidor
            this.mySid = myPlayer.sid;
            
            console.log('👑 Estado de host confirmado:', {
                username: data.your_username,
                isHost: this.isHost,
                hostSid: data.host_sid,
                mySid: this.mySid
            });
        }
        
        this.updatePlayersList(data.players, data.host_sid);
    }
    
    handleServerMessage(data) {
        console.log('Mensaje del servidor:', data.message);
    }
    
    updateConnectionStatus(message, statusClass) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${statusClass}`;
        }
    }
    
    setupEventListeners() {
        console.log('Event listeners configurados');
    }
    
    createRoom(roomName, username) {
        if (!this.isConnected) {
            alert('No estás conectado al servidor');
            return;
        }
        
        this.username = username;
        this.socket.emit('create_room', {
            room_name: roomName,
            username: username
        });
    }
    
    joinRoom(roomCode, username) {
        console.log('📞 JOINROOM() LLAMADO:', { roomCode, username });
        console.log('Estado actual:', { 
            isConnected: this.isConnected, 
            currentRoomCode: this.roomCode 
        });
        
        if (!this.isConnected) {
            console.error('❌ No conectado');
            alert('No estás conectado al servidor');
            return;
        }
        
        // Si intenta unirse a la MISMA sala, no hacer nada
        if (this.roomCode === roomCode) {
            console.log('ℹ️ Ya estás en esta sala');
            alert('Ya estás en esta sala');
            return;
        }
        
        // Si intenta cambiar de sala, confirmar
        if (this.roomCode && this.roomCode !== roomCode) {
            if (confirm(`¿Quieres abandonar la sala ${this.roomCode} y unirte a ${roomCode}?`)) {
                console.log('🔄 Cambiando de sala:', this.roomCode, '→', roomCode);
                this.leaveCurrentRoom(); // Abandonar sala actual
            } else {
                return; // Cancelado por el usuario
            }
        }
        
        this.username = username;
        this.roomCode = roomCode;
        
        console.log('🚀 EMITIENDO: join_room', { room_code: roomCode, username: username });
        
        this.socket.emit('join_room', {
            room_code: roomCode,
            username: username
        });
        
        console.log('✅ EMITIDO - Esperando respuesta...');
    }

    leaveCurrentRoom() {
        if (this.roomCode && this.socket) {
            console.log('🚪 Abandonando sala:', this.roomCode);
            this.socket.emit('leave_room', { room_code: this.roomCode });
            leave_room(this.roomCode); // WebSocket leave
            this.roomCode = null;
        }
    }

    startGame(roomCode) {
        if (!this.isConnected) {
            alert('No estás conectado al servidor');
            return;
        }
        
        this.socket.emit('start_game', {
            room_code: roomCode
        });
    }
    
    handleRoomCreated(data) {
        console.log('Sala creada:', data);
        this.isHost = true;  // ✅ Establecer como host INMEDIATAMENTE
        this.roomCode = data.room_code;
        this.mySid = this.socket.id;
        
        if (!this.username) {
            this.username = 'Jugador' + Math.floor(Math.random() * 1000);
        }
        
        // Guardar estado en localStorage para recuperación
        localStorage.setItem('uno_room_code', this.roomCode);
        localStorage.setItem('uno_username', this.username);
        localStorage.setItem('uno_is_host', 'true');
        
        console.log('👑 Host creado:', {
            roomCode: this.roomCode,
            username: this.username,
            isHost: this.isHost
        });
        
        // Redirigir a la sala
        window.location.href = `/lobby/${data.room_code}?username=${encodeURIComponent(this.username)}`;
    }

    handleRoomJoined(data) {
        console.log('🎉 EVENTO room_joined RECIBIDO:', data);
        console.log('📋 Datos:', { room_code: data.room_code, room_name: data.room_name });
        
        this.roomCode = data.room_code;
        this.mySid = this.socket.id;
        
        if (!this.username) {
            this.username = 'Jugador' + Math.floor(Math.random() * 1000);
        }
        
        // Guardar estado en localStorage
        localStorage.setItem('uno_room_code', this.roomCode);
        localStorage.setItem('uno_username', this.username);
        localStorage.setItem('uno_is_host', 'false');
        
        console.log('🔄 REDIRIGIENDO A:', `/lobby/${data.room_code}?username=${encodeURIComponent(this.username)}`);
        
        // REDIRIGIR
        window.location.href = `/lobby/${data.room_code}?username=${encodeURIComponent(this.username)}`;
    }

    getRoomInfoFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const path = window.location.pathname;
        
        console.log('📍 Ruta actual:', path);
        
        // RESETAR VALORES - LÓGICA DEFINITIVA
        this.roomCode = null;
        this.isHost = false;
        
        if (path.includes('/lobby/')) {
            // Estamos en una sala real (/lobby/ABC123)
            this.roomCode = path.split('/lobby/')[1] || '';
            this.username = urlParams.get('username') || localStorage.getItem('uno_username') || 'Jugador';
            
            // Recuperar si es host
            const storedHost = localStorage.getItem('uno_is_host');
            if (storedHost === 'true') {
                this.isHost = true;
            }
        } else if (path === '/create') {
            // Estamos en la página de crear sala
            this.username = urlParams.get('username') || localStorage.getItem('uno_username') || 'Jugador';
            // No es host AÚN - se establecerá cuando cree la sala
        } else if (path === '/join') {
            // Estamos en la página de unirse a sala
            this.username = urlParams.get('username') || localStorage.getItem('uno_username') || 'Jugador';
            // No es host y no hay sala
        } else {
            // Estamos en la página principal u otra
            this.username = urlParams.get('username') || localStorage.getItem('uno_username') || 'Jugador';
        }
        
        console.log('📋 Información recuperada:', {
            roomCode: this.roomCode,
            username: this.username,
            isHost: this.isHost,
            pathname: path
        });
    }

    handleJoinError(data) {
        console.log('❌ EVENTO join_error RECIBIDO:', data);
        alert(`Error: ${data.message}`);
    }
    
    handlePlayerJoined(data) {
        console.log('🟢 Jugador unido:', data.username);
        console.log('   Lista completa de jugadores:', data.players);
        this.updatePlayersList(data.players, data.host_sid);
    }

    handlePlayerLeft(data) {
        console.log('🔴 Jugador abandonó:', data);
        this.updatePlayersList(data.players, data.host_sid);
    }

    handlePlayerOnline(data) {
        console.log('🟢 Jugador reconectado:', data.username);
        console.log('   Lista completa de jugadores:', data.players);
        this.updatePlayersList(data.players, data.host_sid);
    }

    handlePlayerOffline(data) {
        console.log('🔴 Jugador desconectado:', data);
        this.updatePlayersList(data.players, data.host_sid);
    }

    handlePlayersUpdate(data) {
        console.log('🔄 Actualización de jugadores recibida:', data.players);
        this.updatePlayersList(data.players, data.host_sid);
    }

    updatePlayersList(players, hostSid) {
        console.log('🔄 Actualizando lista de jugadores:', {
            players: players,
            hostSid: hostSid,
            mySid: this.socket.id,
            isHost: this.isHost
        });
        
        const playerCountElement = document.getElementById('player-count');
        const playersListElement = document.getElementById('players-list');
        const hostControls = document.getElementById('host-controls');
        const waitingMessage = document.getElementById('waiting-message');
        
        if (playerCountElement) {
            const onlinePlayers = players.filter(p => p.is_online).length;
            playerCountElement.textContent = `${onlinePlayers}`;
        }
        
        if (playersListElement) {
            playersListElement.innerHTML = '';
            
            // Ordenar jugadores: host primero, luego por orden de conexión
            const sortedPlayers = [...players].sort((a, b) => {
                if (a.sid === hostSid) return -1;
                if (b.sid === hostSid) return 1;
                return 0;
            });
            
            sortedPlayers.forEach(player => {
                const playerElement = document.createElement('div');
                const isYou = player.sid === this.socket.id;
                const isHost = player.sid === hostSid;
                const isOnline = player.is_online;
                
                playerElement.className = `player-item ${isYou ? 'you' : ''} ${!isOnline ? 'offline' : ''}`;
                
                playerElement.innerHTML = `
                    <span class="player-name">
                        ${player.username} ${isYou ? '(Tú)' : ''}
                        ${!isOnline ? ' 🔴' : ' 🟢'}
                    </span>
                    <div>
                        ${isHost ? '<span class="player-badge host">Host</span>' : ''}
                        ${!isOnline ? '<span class="player-badge offline">Offline</span>' : ''}
                    </div>
                `;
                
                playersListElement.appendChild(playerElement);
            });
        }
        
        // Mostrar controles de host SI ESTE JUGADOR ES EL HOST
        if (hostControls && waitingMessage) {
            console.log('🏠 Verificando controles de host:', {
                isThisPlayerHost: this.isHost,
                hostSid: hostSid,
                mySid: this.socket.id,
                roomCode: this.roomCode
            });
            
            if (this.isHost) {
                hostControls.style.display = 'block';
                waitingMessage.style.display = 'none';
                
                const startBtn = document.getElementById('start-game-btn');
                if (startBtn) {
                    const onlinePlayers = players.filter(p => p.is_online).length;
                    const hasEnoughPlayers = onlinePlayers >= 2;
                    
                    startBtn.disabled = !hasEnoughPlayers;
                    startBtn.textContent = hasEnoughPlayers 
                        ? 'Iniciar Partida' 
                        : `Esperando más jugadores... (${onlinePlayers}/2)`;
                    
                    console.log('Botón de inicio configurado para host');
                }
            } else {
                hostControls.style.display = 'none';
                waitingMessage.style.display = 'block';
                waitingMessage.textContent = 'Esperando a que el host inicie el juego...';
            }
        }
    }

    handleGameStarted(data) {
        console.log('Juego iniciado:', data);
        this.showGameInterface();
    }

    handleGameStartedRedirect(data) {
        console.log('🔄 REDIRECCIÓN MASIVA RECIBIDA:', data);
        console.log('📍 Redirigiendo a:', data.redirect_url);
        
        window.location.href = data.redirect_url;
    }
    
    handleGameStateUpdate(data) {
        console.log('Estado del juego actualizado:', data);
        this.playerHand = data.player_hand || [];
        this.updateGameUI(data);
    }
    
    updateGameUI(gameState) {
        console.log('Actualizando UI con:', gameState);
    }

    handleReconnectFailed(data) {
        console.error('❌ Reconexión fallida:', data.message);
        alert(`Error al reconectar: ${data.message}`);
    }
    
    handlePlayerReconnected(data) {
        console.log('🔄 Jugador reconectado:', data.username);
        this.updatePlayersList(data.players, data.host_sid);
    }

    showGameInterface() {
        alert('¡El juego está comenzando! Esta funcionalidad se implementará próximamente.');
        
        const waitingArea = document.querySelector('.players-section, .host-controls, .waiting-message');
        if (waitingArea) {
            waitingArea.style.display = 'none';
        }
    }
}

// ===== CLASE UNOGAME - SALA DE JUEGO REAL =====
class UNOGame {
    constructor(roomCode, username) {
        this.roomCode = roomCode;
        this.username = username;
        this.socket = window.unoClient.socket; // Reutilizar conexión
        this.myCards = [];
        this.currentCard = null;
        this.currentPlayer = null;
        this.players = [];
        this.isMyTurn = false;
        
        this.init();
    }
    
    init() {
        console.log('🎮 Inicializando UNOGame...');
        this.setupEventListeners();
        this.requestGameState();
    }
    
    setupEventListeners() {
        // Botones del juego
        document.getElementById('draw-card-btn').addEventListener('click', () => this.drawCard());
        document.getElementById('uno-btn').addEventListener('click', () => this.shoutUno());
        document.getElementById('pass-btn').addEventListener('click', () => this.passTurn());
        document.getElementById('leave-game-btn').addEventListener('click', () => this.leaveGame());
        
        // Eventos del servidor
        this.socket.on('game_state_update', (data) => this.handleGameStateUpdate(data));
        this.socket.on('card_played', (data) => this.handleCardPlayed(data));
        this.socket.on('turn_changed', (data) => this.handleTurnChanged(data));
        this.socket.on('player_drew_card', (data) => this.handlePlayerDrewCard(data));
        this.socket.on('uno_called', (data) => this.handleUnoCalled(data));
        this.socket.on('game_ended', (data) => this.handleGameEnded(data));
        

        this.socket.on('game_started_redirect', (data) => {
            console.log('🎯 EVENTO game_started_redirect RECIBIDO');
            console.log('📍 Sala actual:', this.roomCode);
            console.log('🌐 URL actual:', window.location.href);
            console.log('📋 Datos del evento:', data);
            
            // Verificar que estamos en la sala correcta
            if (this.roomCode && data.redirect_url.includes(this.roomCode)) {
                console.log('✅ Sala coincide - REDIRIGIENDO');
                alert(data.message);
                
                setTimeout(() => {
                    console.log('🚀 REDIRIGIENDO A:', data.redirect_url);
                    window.location.href = data.redirect_url;
                }, 100);
            } else {
                console.log('❌ Sala no coincide o error', {
                    currentRoom: this.roomCode,
                    eventRoom: data.redirect_url
                });
            }
        });
        
        console.log('✅ Eventos de juego configurados');
    }
    
    

    requestGameState() {
        console.log('📡 Solicitando estado del juego...');
        this.socket.emit('request_game_state', { room_code: this.roomCode });
    }
    
    drawCard() {
        if (!this.isMyTurn) {
            alert('No es tu turno');
            return;
        }
        console.log('🃏 Robando carta...');
        this.socket.emit('draw_card', { 
            room_code: this.roomCode,
            username: this.username 
        });
    }
    
    playCard(cardIndex) {
        if (!this.isMyTurn) {
            alert('No es tu turno');
            return;
        }
        console.log('🎯 Jugando carta:', cardIndex);
        this.socket.emit('play_card', {
            room_code: this.roomCode,
            username: this.username,
            card_index: cardIndex
        });
    }
    
    shoutUno() {
        console.log('🚨 ¡UNO!');
        this.socket.emit('call_uno', {
            room_code: this.roomCode,
            username: this.username
        });
    }
    
    passTurn() {
        if (!this.isMyTurn) {
            alert('No es tu turno');
            return;
        }
        console.log('⏭️ Pasando turno...');
        this.socket.emit('pass_turn', {
            room_code: this.roomCode,
            username: this.username
        });
    }
    
    leaveGame() {
        if (confirm('¿Quieres abandonar la partida?')) {
            console.log('🚪 Abandonando juego...');
            this.socket.emit('leave_game', {
                room_code: this.roomCode,
                username: this.username
            });
            window.location.href = '/';
        }
    }
    
    // Handlers de eventos del servidor
    handleGameStateUpdate(data) {
        console.log('🔄 Estado del juego actualizado:', data);
        this.updateGameInterface(data);
    }
    
    handleCardPlayed(data) {
        console.log('🃏 Carta jugada:', data);
        this.animateCardPlay(data);
    }
    
    handleTurnChanged(data) {
        console.log('⏰ Turno cambiado:', data);
        this.updateTurnIndicator(data);
        this.isMyTurn = (data.current_player === this.username);
        this.updateActionButtons();
    }
    
    handlePlayerDrewCard(data) {
        console.log('🃏 Jugador robó carta:', data);
        this.animateCardDraw(data);
    }
    
    handleUnoCalled(data) {
        console.log('🚨 ¡UNO llamado por:', data.username);
        this.showUnoAlert(data.username);
    }
    
    handleGameEnded(data) {
        console.log('🏆 Juego terminado:', data);
        this.showGameEnd(data.winner, data.stats);
    }
    
    // Métodos de UI
    updateGameInterface(data) {
        // Actualizar carta central
        this.updateCenterCard(data.current_card);
        
        // Actualizar mano del jugador
        this.updatePlayerHand(data.player_hand);
        
        // Actualizar lista de jugadores
        this.updatePlayersList(data.players);
        
        // Actualizar turno actual
        this.updateTurnIndicator(data.current_player);
        
        // Actualizar botones
        this.isMyTurn = (data.current_player === this.username);
        this.updateActionButtons();
    }
    
    updateCenterCard(card) {
        const centerCard = document.getElementById('current-card');
        if (card) {
            centerCard.innerHTML = `
                <div class="card-content">
                    <span class="card-number">${card.number}</span>
                    <span class="card-color ${card.color}">●</span>
                </div>
            `;
            centerCard.className = `current-card ${card.color}`;
        }
    }
    
    updatePlayerHand(hand) {
        this.myCards = hand;
        const handElement = document.getElementById('player-hand');
        handElement.innerHTML = '';
        
        hand.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = `game-card ${card.color}`;
            cardElement.innerHTML = `
                <div class="card-content">
                    <span class="card-number">${card.number}</span>
                    <span class="card-color">${card.color}</span>
                </div>
            `;
            cardElement.addEventListener('click', () => this.playCard(index));
            handElement.appendChild(cardElement);
        });
    }
    
    updatePlayersList(players) {
        const playersArea = document.getElementById('players-area');
        playersArea.innerHTML = '';
        
        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `player-game ${player.is_online ? 'online' : 'offline'}`;
            playerElement.innerHTML = `
                <div class="player-name">${player.username}</div>
                <div class="player-cards">${player.card_count} cartas</div>
                <div class="player-status">${player.is_online ? '🟢' : '🔴'}</div>
            `;
            playersArea.appendChild(playerElement);
        });
    }
    
    updateTurnIndicator(currentPlayer) {
        document.getElementById('current-player').textContent = `Turno de: ${currentPlayer}`;
    }
    
    updateActionButtons() {
        const buttons = document.querySelectorAll('.game-btn');
        buttons.forEach(btn => {
            btn.disabled = !this.isMyTurn;
            btn.style.opacity = this.isMyTurn ? '1' : '0.5';
        });
    }
    
    // Animaciones y efectos
    animateCardPlay(data) {
        // Animación cuando alguien juega una carta
        console.log('✨ Animando jugada de carta');
    }
    
    animateCardDraw(data) {
        // Animación cuando alguien roba carta
        console.log('✨ Animando robo de carta');
    }
    
    showUnoAlert(username) {
        alert(`¡${username} ha gritado UNO! 🚨`);
    }
    
    showGameEnd(winner, stats) {
        alert(`🏆 ¡${winner} ha ganado! \n\nEstadísticas:\n${JSON.stringify(stats, null, 2)}`);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.unoClient = new UNOClient();
    console.log('UNOClient inicializado. Usa window.unoClient para acceder en la consola.');
});