/**
 * Maneja la lógica del juego UNO
 */
class GameClient {
    constructor(socketManager, roomCode, username) {
        this.socket = socketManager;
        this.roomCode = roomCode;
        this.username = username;
        this.myCards = [];
        this.currentCard = null;
        this.currentPlayer = null;
        this.players = [];
        this.isMyTurn = false;
        this.isInitialized = false;
        this.gameUI = null;
    }

    /**
     * Inicializa el cliente del juego
     * ✅ FIX: Espera a estar conectado Y reconectado antes de pedir el estado
     */
    async init() {
        console.log('🎮 Inicializando GameClient:', {
            roomCode: this.roomCode,
            username: this.username
        });

        this._setupGameEvents();

        // ✅ PASO 1: Asegurar que estamos conectados
        if (!this.socket.isSocketConnected()) {
            console.log('⏳ Esperando conexión...');
            await this._waitForConnection();
        }

        // ✅ PASO 2: Reconectar a la sala
        await this._reconnectToRoom();

        // ✅ PASO 3: Solicitar estado del juego
        this._requestGameState();
    }

    /**
     * Conecta GameClient con GameUI para comunicación bidireccional
     */
    setGameUI(gameUI) {
        this.gameUI = gameUI;
        console.log('✅ GameUI conectado a GameClient');
    }

    /**
     * Espera a que el socket esté conectado
     * @private
     */
    _waitForConnection() {
        return new Promise((resolve) => {
            if (this.socket.isSocketConnected()) {
                resolve();
                return;
            }

            this.socket.once('connected', () => {
                console.log('✅ Conexión establecida');
                resolve();
            });

            // Timeout de seguridad
            setTimeout(() => {
                if (!this.socket.isSocketConnected()) {
                    console.error('❌ Timeout esperando conexión');
                    alert('Error de conexión. Por favor recarga la página.');
                }
                resolve();
            }, 10000);
        });
    }

    /**
     * Reconecta a la sala del juego
     * @private
     */
    _reconnectToRoom() {
        return new Promise((resolve) => {
            console.log('🔄 Reconectando a sala:', this.roomCode);

            // Escuchar respuesta de reconexión
            const timeout = setTimeout(() => {
                console.error('❌ Timeout en reconexión');
                resolve();
            }, 5000);

            this.socket.once('room_state_sync', (data) => {
                clearTimeout(timeout);
                console.log('✅ Reconexión exitosa:', data);
                resolve();
            });

            // ✅ FIX CRÍTICO: Usar el SID actual del socket
            this.socket.emit('request_reconnect', {
                room_code: this.roomCode,
                username: this.username,
                old_sid: this.socket.sid // ✅ Usar el SID actual
            });
        });
    }

    /**
     * Solicita el estado inicial del juego
     * @private
     */
    _requestGameState() {
        console.log('📡 Solicitando estado del juego...');

        const realUsername = this.username  // ya lo sobre-escribió el backend
                  || sessionStorage.getItem('uno_username')  // backup
                  || new URLSearchParams(window.location.search).get('u');
        
        this.socket.emit('initialize_game', {
            room_code: this.roomCode,
            username: realUsername
        });
    }

    /**
     * Configura eventos del juego
     * @private
     */
    _setupGameEvents() {
        this.socket.on('game_state_update', (data) => this._handleGameStateUpdate(data));
        this.socket.on('card_played', (data) => this._handleCardPlayed(data));
        this.socket.on('turn_changed', (data) => this._handleTurnChanged(data));
        this.socket.on('player_drew_card', (data) => this._handlePlayerDrewCard(data));
        this.socket.on('uno_called', (data) => this._handleUnoCalled(data));
        this.socket.on('game_ended', (data) => this._handleGameEnded(data));
    }

    /**
     * Acciones del jugador
     */
    playCard(cardIndex) {
        if (!this.isMyTurn) {
            alert('No es tu turno');
            return;
        }

        console.log('🎯 Jugando carta:', cardIndex);

        const card = this.myCards[cardIndex];
        if (card.color === 'black') {
            console.log('⚫ Carta negra detectada');
            
            // ✅ Usar GameUI en lugar de this._requestColorChoice
            if (this.gameUI && this.gameUI._requestColorChoice) {
                this.gameUI._requestColorChoice(cardIndex);
            } else {
                console.error('❌ GameUI no disponible, usando fallback');
                // Fallback: jugar con color por defecto
                this.playCardWithColor(cardIndex, 'red');
            }
            return;
        }

        this.socket.emit('play_card', {
            room_code: this.roomCode,
            username: this.username,
            card_index: cardIndex
        });
    }

    playCardWithColor(cardIndex, declaredColor) {
        this.socket.emit('play_card', {
            room_code: this.roomCode,
            username: this.username,
            card_index: cardIndex,
            declared_color: declaredColor
        });
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

    callUno() {
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

    /**
     * Manejadores de eventos
     * @private
     */
    _handleGameStateUpdate(data) {
        console.log('🔄 Estado del juego actualizado:', data);

        if (!data || !data.current_player) {
            console.error('❌ Datos inválidos:', data);
            return;
        }

        this.currentPlayer = data.current_player;
        this.currentCard = data.current_card;
        this.myCards = data.player_hand || [];
        this.players = data.players || [];
        this.username = data.your_username;
        this.isMyTurn = (data.current_player === this.username);
        this.isInitialized = true;

        // Disparar evento para que la UI se actualice
        this._triggerUIUpdate(data);
    }

    _handleCardPlayed(data) {
        console.log('🃏 Carta jugada:', data);
        this._trigger('card_played', data);
    }

    _handleTurnChanged(data) {
        console.log('⏰ Turno cambiado:', data);
        this.currentPlayer = data.current_player;
        this.isMyTurn = (data.current_player === this.username);
        this._trigger('turn_changed', data);
    }

    _handlePlayerDrewCard(data) {
        console.log('🃏 Jugador robó carta:', data);
        this._trigger('player_drew_card', data);
    }

    _handleUnoCalled(data) {
        console.log('🚨 ¡UNO! -', data.username);
        alert(`¡${data.username} ha gritado UNO! 🚨`);
    }

    _handleGameEnded(data) {
        console.log('🏆 Juego terminado:', data);
        this._showGameEndedModal(data.winner);
    }

    /**
     * Muestra el modal de fin de juego
     * @private
     */
    _showGameEndedModal(winner) {
        // Crear el modal si no existe
        let modal = document.getElementById('game-ended-modal');
        
        if (!modal) {
            console.error('❌ No se encontró el modal de fin de juego');
            // Fallback: usar alert
            alert(`🏆 ¡${winner} ha ganado!`);
            return;
        }

        // Obtener roomCode y username de múltiples fuentes
        const roomCode = this.roomCode || this._getRoomCodeFromURL();
        const username = this.username || this._getUsernameFromURL() || 'Jugador';

        // Actualizar el mensaje del ganador
        const winnerMessage = document.getElementById('winner-message');
        if (winnerMessage) {
            if (winner === this.username) {
                winnerMessage.textContent = '¡Felicidades! ¡Has ganado la partida! 🎉';
                winnerMessage.style.color = '#2ecc71'; // Verde para victoria
            } else {
                winnerMessage.textContent = `¡${winner} ha ganado la partida!`;
                winnerMessage.style.color = '#f1c40f'; // Amarillo para otros
            }
        }

        // Configurar el botón de volver al lobby
        const backButton = document.getElementById('back-to-lobby-btn');
        if (backButton) {
            backButton.onclick = () => {
                console.log('🚪 Volviendo al lobby...');
                const lobbyUrl = `/lobby/${roomCode}?username=${encodeURIComponent(username)}`;
                window.location.href = lobbyUrl;
            };
        }

        // Mostrar el modal
        modal.classList.remove('hidden');
        console.log('✅ Modal de fin de juego mostrado');
    }

    /**
     * Obtiene el código de sala de la URL actual
     * @private
     */
    _getRoomCodeFromURL() {
        const path = window.location.pathname;
        const match = path.match(/\/play\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Obtiene el username de la URL actual
     * @private
     */
    _getUsernameFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('username');
    }

    /**
     * Dispara eventos de UI
     * @private
     */
    _triggerUIUpdate(data) {
        const event = new CustomEvent('game:state_update', { detail: data });
        document.dispatchEvent(event);
    }

    _trigger(eventName, data) {
        const event = new CustomEvent(`game:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }
}

export default GameClient;