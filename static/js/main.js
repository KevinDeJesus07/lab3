/**
 * Punto de entrada principal de la aplicación UNO
 * Inicializa los módulos según el contexto de la página
 */

import StorageManager from './utils/StorageManager.js';
import URLManager from './utils/URLManager.js';
import SocketManager from './core/SocketManager.js';
import HeartbeatService from './core/HeartbeatService.js';
import ReconnectionHandler from './core/ReconnectionHandler.js';
import LobbyClient from './lobby/LobbyClient.js';
import GameClient from './game/GameClient.js';
import GameUI from './game/GameUI.js';

class UNOApp {
    constructor() {
        // Inicializar managers
        this.storage = new StorageManager();
        this.urlManager = new URLManager(this.storage);
        this.socketManager = new SocketManager(this.urlManager, this.storage);
        
        // Variables de estado
        this.lobbyClient = null;
        this.gameClient = null;
        this.gameUI = null;
        this.heartbeat = null;
        this.reconnectionHandler = null;
        
        console.log('🎮 UNO App inicializada');
    }

    initialize() {
        this.socketManager.connect();
        this._setupGlobalListeners();
        
        if (this.socketManager.socket && this.socketManager.socket.connected) {
             this._updateConnectionStatus(true);
        }
    }

    _setupGlobalListeners() {
        // Escuchar cambios de conexión
        document.addEventListener('socket:connected', (e) => {
            console.log('✅ Evento socket:connected recibido en UI');
            this._updateConnectionStatus(true, e.detail);
        });

        document.addEventListener('socket:disconnected', () => {
            console.log('Mq Evento socket:disconnected recibido en UI');
            this._updateConnectionStatus(false);
        });
    }

    _updateConnectionStatus(isConnected, sid = null) {
        const statusElements = document.querySelectorAll('.connection-status');
        
        statusElements.forEach(el => {
            if (isConnected) {
                el.className = 'connection-status connection-status--connected';
                el.innerHTML = `
                    <span class="connection-status__icon">🟢</span>
                    <span class="connection-status__text">Conectado</span>
                `;
                // Opcional: Mostrar SID chiquito para debug
                // el.title = `SID: ${sid}`;
            } else {
                el.className = 'connection-status connection-status--disconnected';
                el.innerHTML = `
                    <span class="connection-status__icon">🔴</span>
                    <span class="connection-status__text">Desconectado</span>
                `;
            }
        });
    }

    /**
     * Inicia la aplicación
     */
    async start() {
        // Conectar al servidor
        this.socketManager.connect();
        
        this._setupGlobalListeners(); 

        // Iniciar heartbeat
        this.heartbeat = new HeartbeatService(this.socketManager.getSocket());
        
        // Configurar reconexión
        this.reconnectionHandler = new ReconnectionHandler(
            this.socketManager.getSocket(),
            this.urlManager
        );
        this.reconnectionHandler.setupReconnectionEvents();
        
        // Exponer para debugging y reconexión manual
        window.reconnectionHandler = this.reconnectionHandler;
        
        // Esperar a estar conectado
        await this._waitForConnection();
        
        // Forzar actualización visual del footer ahora que estamos conectados
        this._updateConnectionStatus(true);
        // 👆👆 
        
        // Iniciar heartbeat
        this.heartbeat.start();
        
        // Inicializar según contexto
        const context = this.urlManager.getContextFromURL();
        await this._initializeContext(context);
    }

    /**
     * Espera a que el socket esté conectado
     * @private
     */
    _waitForConnection() {
        return new Promise((resolve) => {
            if (this.socketManager.isSocketConnected()) {
                resolve();
                return;
            }

            this.socketManager.once('connected', () => {
                console.log('✅ Aplicación conectada al servidor');
                resolve();
            });

            // Timeout de seguridad
            setTimeout(() => {
                if (!this.socketManager.isSocketConnected()) {
                    console.error('❌ Timeout esperando conexión inicial');
                    alert('No se pudo conectar al servidor. Por favor recarga la página.');
                }
                resolve();
            }, 10000);
        });
    }

    /**
     * Inicializa la aplicación según el contexto de la página
     * @private
     */
    async _initializeContext(context) {
        console.log('📍 Inicializando contexto:', context);

        switch (context.context) {
            case 'lobby':
                this._initializeLobby(context);
                break;
            
            case 'play':
                await this._initializeGame(context);
                break;
            
            case 'create':
            case 'join':
            case 'home':
                this._initializeLobby(context);
                break;
            
            default:
                console.log('ℹ️ Contexto no reconocido, modo lobby por defecto');
                this._initializeLobby(context);
        }
    }

    /**
     * Inicializa el cliente del lobby
     * @private
     */
    _initializeLobby(context) {
        console.log('🏠 Inicializando Lobby Client');
        
        this.lobbyClient = new LobbyClient(
            this.socketManager,
            this.urlManager,
            this.storage
        );
        
        this.lobbyClient.init(
            context.username,
            context.roomCode,
            context.isHost
        );

        // Exponer para uso desde HTML
        window.lobbyClient = this.lobbyClient;
    }

    /**
     * Inicializa el cliente del juego
     * @private
     */
    async _initializeGame(context) {
        console.log('🎮 Inicializando Game Client');

        if (!context.roomCode || !context.username) {
            console.error('❌ Faltan datos para iniciar el juego');
            alert('Error: Faltan datos para iniciar el juego');
            window.location.href = '/';
            return;
        }

        this.gameClient = new GameClient(
            this.socketManager,
            context.roomCode,
            context.username
        );

        // Crear UI del juego
        this.gameUI = new GameUI(this.gameClient);

        this.gameClient.setGameUI(this.gameUI);

        // Inicializar el juego (async)
        await this.gameClient.init();

        // Exponer para debugging
        window.gameClient = this.gameClient;
        window.gameUI = this.gameUI;
    }

    /**
     * Métodos públicos para usar desde HTML
     */
    createRoom(roomName, username) {
        if (this.lobbyClient) {
            this.lobbyClient.createRoom(roomName, username);
        } else {
            console.error('❌ LobbyClient no inicializado');
        }
    }

    joinRoom(roomCode, username) {
        if (this.lobbyClient) {
            this.lobbyClient.joinRoom(roomCode, username);
        } else {
            console.error('❌ LobbyClient no inicializado');
        }
    }

    startGame(roomCode) {
        if (this.lobbyClient) {
            this.lobbyClient.startGame(roomCode);
        } else {
            console.error('❌ LobbyClient no inicializado');
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando aplicación UNO...');
    
    window.unoApp = new UNOApp();
    await window.unoApp.start();
    
    console.log('✅ Aplicación UNO lista');
    console.log('💡 Usa window.unoApp en la consola para debugging');
});

// Exportar para uso desde HTML (compatibilidad)
window.UNOApp = UNOApp;