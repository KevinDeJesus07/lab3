class UNOClient {

    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.currentRoom = null;
        this.playerHand = [];
        
        this.init();
    }
    
    init() {
        this.connectToServer();
        this.setupEventListeners();
    }
    
    connectToServer() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.handleConnect();
        });
        
        this.socket.on('disconnect', () => {
            this.handleDisconnect();
        });
        
        this.socket.on('connected', (data) => {
            this.handleServerMessage(data);
        });
        
        this.socket.on('room_created', (data) => this.handleRoomCreated(data));
        this.socket.on('player_joined', (data) => this.handlePlayerJoined(data));
        this.socket.on('game_state_update', (data) => this.handleGameStateUpdate(data));
        this.socket.on('join_error', (data) => this.handleJoinError(data));
        this.socket.on('player_joined', (data) => this.handlePlayerJoined(data));
    }
    
    handleConnect() {
        this.isConnected = true;
        this.updateConnectionStatus('Conectado al servidor', 'connected');
        console.log('Conectado al servidor');
    }
    
    handleDisconnect() {
        this.isConnected = false;
        this.updateConnectionStatus('Desconectado del servidor', 'disconnected');
        console.log('Desconectado del servidor');
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
        
        this.socket.emit('create_room', {
            room_name: roomName,
            username: username
        });
    }
    
    joinRoom(roomCode, username) {
        if (!this.isConnected) {
            alert('No estás conectado al servidor');
            return;
        }
        
        this.socket.emit('join_room', {
            room_code: roomCode,
            username: username
        });
    }
    
    handleRoomCreated(data) {
        console.log('Sala creada:', data);
        window.location.href = `/game/${data.room_code}`;
    }

    handleRoomJoined(data) {
        console.log('Unido a sala:', data);
        window.location.href = `/game/${data.room_code}`;
    }

    handleJoinError(data) {
        console.error('Error al unirse:', data);
        alert(`Error: ${data.message}`);
    }
    
    handlePlayerJoined(data) {
        console.log('Jugador unido:', data);
        this.updatePlayersList(data.players);
    }

    updatePlayersList(players) {
        const playerCountElement = document.getElementById('player-count');
        if (playerCountElement) {
            playerCountElement.textContent = players.length;
        }
        
        console.log('Jugadores en sala:', players);
    }
    
    handleGameStateUpdate(data) {
        console.log('Estado del juego actualizado:', data);
        this.playerHand = data.player_hand || [];
        this.updateGameUI(data);
    }
    
    updateGameUI(gameState) {
        console.log('Actualizando UI con:', gameState);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.unoClient = new UNOClient();
    
    // Para depuración: hacer el cliente globalmente accesible
    console.log('UNOClient inicializado. Usa window.unoClient para acceder en la consola.');
});