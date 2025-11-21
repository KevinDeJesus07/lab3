import CardRenderer from './CardRenderer.js';

/**
 * Maneja la interfaz de usuario del juego
 */
class GameUI {
    constructor(gameClient) {
        this.game = gameClient;
        this.renderer = new CardRenderer(); // Instanciamos el renderizador
        this.pendingWildIndex = null;
        this._setupEventListeners();
        this._setupUIEvents();
        this._setupColorPicker();
    }

    /**
     * Configura listeners de botones
     * @private
     */
    _setupEventListeners() {
        const drawBtn = document.getElementById('draw-card-btn');
        const unoBtn = document.getElementById('uno-btn');
        const passBtn = document.getElementById('pass-btn');
        const leaveBtn = document.getElementById('leave-game-btn');

        if (drawBtn) drawBtn.addEventListener('click', () => this.game.drawCard());
        if (unoBtn) unoBtn.addEventListener('click', () => this.game.callUno());
        if (passBtn) passBtn.addEventListener('click', () => this.game.passTurn());
        if (leaveBtn) leaveBtn.addEventListener('click', () => this.game.leaveGame());
    }

    /**
     * Escucha eventos del juego para actualizar UI
     * @private
     */
    _setupUIEvents() {
        document.addEventListener('game:state_update', (e) => {
            this.updateFullGameState(e.detail);
            this.updateGameStatus(e.detail);
        });
        
        document.addEventListener('game:turn_changed', (e) => {
            this.updateTurnIndicator(e.detail.current_player);
            this.updateActionButtons();
            this.updateGameStatus(e.detail);
        });

        document.addEventListener('game:card_played', (e) => {
            this.animateCardPlay(e.detail);
            this.updateGameLog(e.detail);
        });

        document.addEventListener('game:player_drew_card', (e) => {
            this.animateCardDraw(e.detail);
            // Añadir entrada de log para robar carta
            const logData = {
                username: e.detail.username,
                type: 'draw'
            };
            this.updateGameLog(logData);
        });

        document.addEventListener('game:uno_called', (e) => {
            // Añadir entrada de log para UNO
            const logData = {
                username: e.detail.username,
                type: 'uno'
            };
            this.updateGameLog(logData);
        });

        document.addEventListener('game:game_ended', (e) => {
            this.updateGameLog(e.detail);
        });
    }

    /**
     * Actualiza todo el estado del juego en la UI
     */
    updateFullGameState(data) {
        // console.log('🎨 Actualizando UI completa:', data); // Reducimos ruido en consola

        if (data.current_card) {
            this.updateCenterCard(data.current_card);
        }
        
        this.updatePlayerHand(data.player_hand);
        this.updatePlayersList(data.players);
        this.updateTurnIndicator(data.current_player);
        this.updateActionButtons();
        this.updateGameDirection(data.direction);
        this.updateGameStatus(data);
    }

    /**
     * Actualiza la carta central usando CardRenderer
     */
    updateCenterCard(card) {
        const centerCardContainer = document.getElementById('current-card');
        this.renderer.renderCenterCard(centerCardContainer, card);
    }

    /**
     * Actualiza la mano del jugador usando CardRenderer
     */
    updatePlayerHand(hand) {
        const handElement = document.getElementById('player-hand');
        if (!handElement) return;

        handElement.innerHTML = '';

        if (!hand || hand.length === 0) {
            // Opcional: Mostrar mensaje vacío o dejar vacío
            return;
        }

        hand.forEach((card, index) => {
            // Delegamos la creación del DOM al renderizador
            const cardElement = this.renderer.createHandCard(card, index, this.game.isMyTurn);
            
            // SIEMPRE escuchamos el click; dentro decidimos
            cardElement.addEventListener('click', () => {
                if (!this.game.isMyTurn) {
                    console.log('No es tu turno');
                    return;
                }
                this.game.playCard(index);
            });
            
            handElement.appendChild(cardElement);
        });
    }

    /**
     * Actualiza lista de jugadores (Sidebar)
     */
    updatePlayersList(players) {
        const playersArea = document.getElementById('players-area');
        const playerCardsCount = document.getElementById('player-cards-count');

        if (!playersArea) return;

        playersArea.innerHTML = '';

        if (!players || players.length === 0) return;

        players.forEach(player => {
            const playerElement = document.createElement('div');
            const isMe = player.username === this.game.username;
            const isCurrentTurn = player.username === this.game.currentPlayer;

            // Clases dinámicas para resaltar turno actual y estado online
            let classes = 'player-game';
            if (player.is_online) classes += ' online';
            else classes += ' offline';
            if (isCurrentTurn) classes += ' current-turn'; // CSS necesario para resaltar borde

            playerElement.className = classes;
            
            playerElement.innerHTML = `
                <div class="player-name">${player.username} ${isMe ? '(Tú)' : ''}</div>
                <div class="player-cards">🎴 ${player.card_count || 0}</div>
                <div class="player-status">${player.is_online ? '⚡' : '💤'}</div>
            `;
            playersArea.appendChild(playerElement);
        });

        // Actualizar lista simple en sidebar
        if (playerCardsCount) {
            playerCardsCount.innerHTML = players.map(p => {
                const isActive = p.username === this.game.currentPlayer;
                return `
                <div class="player-card-count ${isActive ? 'player-card-count--active' : ''}">
                    <span>${p.username}</span>
                    <strong>${p.card_count}</strong>
                </div>
            `}).join('');
        }
    }

    updateTurnIndicator(currentPlayer) {
        const indicator = document.getElementById('current-player');
        if (indicator) {
            const text = currentPlayer === this.game.username ? '¡Es tu turno!' : `Turno de: ${currentPlayer}`;
            indicator.textContent = text;
            
            // Cambio visual si es mi turno
            if (currentPlayer === this.game.username) {
                indicator.style.color = '#2ecc71'; // Verde brillante
                indicator.style.transform = 'scale(1.1)';
            } else {
                indicator.style.color = '';
                indicator.style.transform = 'scale(1)';
            }
        }
    }

    updateActionButtons() {
        const isMyTurn = this.game.isMyTurn;
        const hasPlayableCard = this._hasPlayableCard();

        // Robar carta y UNO: habilitados solo si te toca
        document.getElementById('draw-card-btn').disabled = !isMyTurn;
        document.getElementById('uno-btn').disabled      = !isMyTurn;

        // Pasar turno: habilitado solo si te toca Y no tienes jugada
        document.getElementById('pass-btn').disabled     = !isMyTurn || hasPlayableCard;

        // Abandonar: siempre habilitado (no es una acción de juego)
        // (si quieres deshabilitarlo también fuera de tu turno, añádelo aquí)
    }

    updateGameDirection(direction) {
        const dirElement = document.getElementById('game-direction');
        if (dirElement && direction) {
            const arrow = direction === 'clockwise' ? '⬇️' : '⬆️'; // O iconos de rotación
            const text = direction === 'clockwise' ? 'Horario' : 'Anti-horario';
            dirElement.textContent = `${arrow} Sentido: ${text}`;
        }
    }

    /**
     * Devuelve true si la mano actual tiene al menos una carta jugable
     * @private
     */
    _hasPlayableCard() {
        const top = this.game.currentCard;
        if (!top) return false;

        return this.game.myCards.some(card =>
            card.color === top.color ||
            card.value === top.value ||
            card.color === 'black'   // comodines siempre jugables
        );
    }

    /**
     * Animaciones (Placeholder para futura implementación con CSS transitions)
     */
    animateCardPlay(data) {
        // Aquí podrías añadir lógica para mover una carta del jugador al centro
        // Por ahora, actualizamos el estado completo para asegurar sincronización
        console.log('Animando jugada de', data.username);
    }

    animateCardDraw(data) {
        console.log(data.username, 'robó una carta');
    }

    _setupColorPicker() {
        const panel = document.getElementById('color-picker');
        if (!panel) return;

        panel.addEventListener('click', e => {
            if (e.target.dataset.color) {
                const color = e.target.dataset.color;
                panel.classList.add('hidden');
                this.game.playCardWithColor(this.pendingWildIndex, color);
                this.pendingWildIndex = null;
            }
        });
    }

    _requestColorChoice(cardIndex) {
        this.pendingWildIndex = cardIndex;
        document.getElementById('color-picker').classList.remove('hidden');
    }

    /**
     * Actualiza el log de jugadas
     */
    updateGameLog(data) {
        const logList = document.getElementById('log-list');
        if (!logList) return;

        // Si es una actualización completa del estado, no añadir entrada de log
        if (data.player_hand) return;

        // Crear entrada de log basada en el tipo de evento
        let logEntry = this._createLogEntry(data);
        if (logEntry) {
            const logItem = document.createElement('li');
            logItem.innerHTML = logEntry;
            logItem.style.opacity = '0';
            logList.insertBefore(logItem, logList.firstChild);

            // Animación de entrada
            setTimeout(() => {
                logItem.style.opacity = '1';
                logItem.style.transition = 'opacity 0.3s ease';
            }, 10);

            // Limitar a 10 entradas máximo
            while (logList.children.length > 10) {
                logList.removeChild(logList.lastChild);
            }
        }
    }

    /**
     * Crea una entrada de log basada en el tipo de evento
     * @private
     */
    _createLogEntry(data) {
        const timestamp = new Date().toLocaleTimeString();
        
        if (data.username && data.card) {
            // Jugada de carta
            const card = data.card;
            let cardDisplay = '';
            
            if (card.color === 'black') {
                if (card.declared_color) {
                    cardDisplay = `<span class="log-wild">${card.value} (${card.declared_color})</span>`;
                } else {
                    cardDisplay = `<span class="log-wild">${card.value}</span>`;
                }
            } else {
                const colorClass = `log-color-${card.color}`;
                cardDisplay = `<span class="${colorClass}">${card.value} ${card.color}</span>`;
            }
            
            return `<span class="log-time">[${timestamp}]</span> <strong>${data.username}</strong> jugó ${cardDisplay}`;
        }
        
        if (data.username && data.type === 'draw') {
            // Robar carta
            return `<span class="log-time">[${timestamp}]</span> <strong>${data.username}</strong> robó una carta`;
        }
        
        if (data.username && data.type === 'uno') {
            // Gritar UNO
            return `<span class="log-time">[${timestamp}]</span> <strong>${data.username}</strong> ¡gritó <span class="log-uno">UNO!</span>`;
        }
        
        if (data.winner) {
            // Fin del juego
            return `<span class="log-time">[${timestamp}]</span> 🏆 <strong>${data.winner}</strong> ganó la partida!`;
        }
        
        return null;
    }

    /**
     * Actualiza el estado del juego en el sidebar
     */
    updateGameStatus(data) {
        const statusElement = document.getElementById('game-status');
        if (!statusElement) return;

        let statusMessage = 'Esperando jugada...';
        
        if (this.game.isMyTurn) {
            statusMessage = '¡Es tu turno!';
        } else if (this.game.currentPlayer) {
            statusMessage = `Turno de: ${this.game.currentPlayer}`;
        }
        
        const messageElement = statusElement.querySelector('.game-status__message');
        if (messageElement) {
            messageElement.textContent = statusMessage;
        }
    }
}

export default GameUI;