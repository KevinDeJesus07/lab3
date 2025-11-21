/**
 * Maneja la interfaz de usuario del lobby
 */
class LobbyUI {
    constructor(roomCode) {
        this.roomCode = roomCode;
        this.elements = this._getElements();
        this._setupEventListeners();
        console.log('🎨 LobbyUI inicializado para sala:', roomCode);

        // Solicitar sincronización inmediata para recuperar estado (F5 o redirección)
        setTimeout(() => {
            if (window.unoApp && window.unoApp.socketManager) {
                console.log('📢 Solicitando estado de la sala (Sync)...');
                const username = new URLSearchParams(window.location.search).get('username');
                
                // Emitimos el evento que el backend espera
                window.unoApp.socketManager.emit('sync_room_state', {
                    room_code: this.roomCode,
                    username: username
                });
            }
        }, 500); // Pequeño delay para asegurar que el socket esté listo
    }

    /**
     * Obtiene referencias a elementos del DOM
     * @private
     */
    _getElements() {
        return {
            playerCount: document.getElementById('player-count'),
            playersList: document.getElementById('players-list'),
            hostControls: document.getElementById('host-controls'),
            waitingMessage: document.getElementById('waiting-message'),
            startGameBtn: document.getElementById('start-game-btn'),
            connectionStatus: document.getElementById('connection-status')
        };
    }

    /**
     * Configura listeners de eventos personalizados
     * @private
     */
    _setupEventListeners() {
        // Escuchar eventos del LobbyClient (ya lo tienes)
        document.addEventListener('lobby:players_update', (e) => {
            this.updatePlayersList(e.detail);
        });

        // Escuchar la sincronización directa del servidor (necesario para el botón de Host)
        document.addEventListener('game:room_state_sync', (e) => {
            console.log('🔄 Sincronización recibida en UI:', e.detail);
            this.updatePlayersList(e.detail);
        });

        console.log('✅ Listeners de LobbyUI configurados');
    }

    /**
     * Actualiza la lista de jugadores en la UI
     */
    updatePlayersList(data) {
        console.log('📊 Recibida lista de jugadores:', data);
        const { players, host_sid } = data;
        
        if (!players || !this.elements.playersList) {
            console.error('❌ Datos o elementos inválidos');
            return;
        }

        console.log('🔄 Actualizando lista de jugadores:', players);

        // Actualizar contador
        const onlineCount = players.filter(p => p.is_online).length;
        if (this.elements.playerCount) {
            this.elements.playerCount.textContent = onlineCount;
        }

        // Limpiar lista
        this.elements.playersList.innerHTML = '';

        // Ordenar: host primero
        const sortedPlayers = [...players].sort((a, b) => {
            if (a.sid === host_sid) return -1;
            if (b.sid === host_sid) return 1;
            return 0;
        });

        // Renderizar cada jugador
        sortedPlayers.forEach(player => {
            const playerElement = this._createPlayerElement(player, host_sid);
            this.elements.playersList.appendChild(playerElement);
        });

        // Actualizar controles de host
        this._updateHostControls(data);
    }

    /**
     * Crea el elemento DOM de un jugador
     * @private
     */
    _createPlayerElement(player, hostSid) {
        const isMe = player.username === window.unoApp?.lobbyClient?.username;
        const isHost = player.sid === hostSid;
        const isOnline = player.is_online;

        const playerDiv = document.createElement('div');
        playerDiv.className = `player-item ${isMe ? 'player-item--me' : ''} ${!isOnline ? 'player-item--offline' : ''}`;

        const statusIcon = isOnline ? '🟢' : '🔴';
        const statusText = isOnline ? 'Conectado' : 'Desconectado';

        playerDiv.innerHTML = `
            <div class="player-item__info">
                <span class="player-item__name">
                    ${player.username}
                    ${isMe ? '<span class="player-item__tag">(Tú)</span>' : ''}
                </span>
                <div class="player-item__badges">
                    ${isHost ? '<span class="player-badge player-badge--host">👑 Host</span>' : ''}
                </div>
            </div>
            <div class="player-item__status" title="${statusText}">
                <span class="player-item__status-icon">${statusIcon}</span>
            </div>
        `;

        return playerDiv;
    }

    /**
     * Actualiza la visibilidad de controles de host
     * @private
     */
    _updateHostControls(data) {
        let isHost = data.you_are_host; // Prioridad 1: Viene del Sync

        // Prioridad 2: Si viene de player_joined/online, 'you_are_host' es undefined.
        // Buscamos en la lista de jugadores quién soy yo y si soy host.
        if (isHost === undefined && data.players) {
            const myUsername = window.unoApp?.lobbyClient?.username;
            const me = data.players.find(p => p.username === myUsername);
            if (me) {
                isHost = me.is_host; // Usamos la propiedad interna del jugador
            }
        }

        // Fallback: Si sigue sin definirse, asumimos falso
        isHost = !!isHost; 

        const onlinePlayers = data.players.filter(p => p.is_online);
        const canStart = onlinePlayers.length >= 2;

        console.log('🏠 Estado Host actualizado:', {
            yo: window.unoApp?.lobbyClient?.username,
            soyHost: isHost,
            jugadoresOnline: onlinePlayers.length
        });

        if (!this.elements.hostControls || !this.elements.waitingMessage) {
            return;
        }

        if (isHost) {
            // Mostrar controles de host
            this.elements.hostControls.style.display = 'block';
            this.elements.waitingMessage.style.display = 'none';

            // Configurar botón de inicio
            if (this.elements.startGameBtn) {
                this.elements.startGameBtn.disabled = !canStart;
                
                if (canStart) {
                    this.elements.startGameBtn.textContent = '🎮 Iniciar Partida';
                    this.elements.startGameBtn.classList.remove('btn--disabled');
                    // Asegurar que el estilo visual coincida
                    this.elements.startGameBtn.style.opacity = '1';
                    this.elements.startGameBtn.style.cursor = 'pointer';
                } else {
                    this.elements.startGameBtn.textContent = `⏳ Esperando jugadores (${onlinePlayers.length}/2)`;
                    this.elements.startGameBtn.classList.add('btn--disabled');
                    this.elements.startGameBtn.style.opacity = '0.6';
                    this.elements.startGameBtn.style.cursor = 'not-allowed';
                }
            }
        } else {
            // Mostrar mensaje de espera
            this.elements.hostControls.style.display = 'none';
            this.elements.waitingMessage.style.display = 'block';
        }
    }

    /**
     * Actualiza el estado de conexión en la UI
     */
    updateConnectionStatus(status, message) {
        if (!this.elements.connectionStatus) return;

        const statusClasses = {
            'connected': 'connection-status--connected',
            'connecting': 'connection-status--connecting',
            'disconnected': 'connection-status--disconnected',
            'error': 'connection-status--error'
        };

        const statusIcons = {
            'connected': '✅',
            'connecting': '⚡',
            'disconnected': '⚠️',
            'error': '❌'
        };

        this.elements.connectionStatus.className = `connection-status ${statusClasses[status] || ''}`;
        
        const icon = this.elements.connectionStatus.querySelector('.connection-status__icon');
        const text = this.elements.connectionStatus.querySelector('.connection-status__text');

        if (icon) icon.textContent = statusIcons[status] || '⚡';
        if (text) text.textContent = message || status;
    }

    /**
     * Muestra un mensaje de error
     */
    showError(message) {
        alert(`Error: ${message}`);
    }

    /**
     * Muestra un mensaje de éxito
     */
    showSuccess(message) {
        // Puedes implementar un toast o notificación
        console.log('✅', message);
    }
}

export default LobbyUI;