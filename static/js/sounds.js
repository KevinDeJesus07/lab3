// static/js/sounds.js - VERSIÓN NO-MÓDULO
class SoundManager {
    constructor() {
        this.sounds = {};
        this.isMuted = localStorage.getItem('uno_sound_muted') === 'true';
        this.backgroundMusic = null;
        console.log('🎵 SoundManager creado');
        this.init();
    }

    async init() {
        console.log('🎵 Inicializando SoundManager...');
        
        // Precargar sonidos
        this.sounds = {
            hover: await this.createSound('/static/sounds/hover.mp3'),
            accept: await this.createSound('/static/sounds/accept.mp3'), 
            back: await this.createSound('/static/sounds/regresar.mp3'),
            music: await this.createSound('/static/sounds/music.mp3', true)
        };

        // Configurar música de fondo
        this.backgroundMusic = this.sounds.music;
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = 0.15;

        this.applyMuteState();
        this.setupGlobalListeners();
        
        console.log('✅ SoundManager listo. Sonidos cargados:', Object.keys(this.sounds));
    }

    createSound(src, isMusic = false) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.src = src;
            audio.preload = 'auto';
            
            if (!isMusic) {
                audio.volume = 0.5;
            }
            
            audio.addEventListener('canplaythrough', () => {
                console.log(`✅ Sonido cargado: ${src}`);
                resolve(audio);
            });
            
            audio.addEventListener('error', (e) => {
                console.error(`❌ Error cargando ${src}:`, e);
                resolve(audio);
            });
        });
    }

    play(soundName) {
        if (this.isMuted || !this.sounds[soundName]) {
            console.log(`🔇 Sonido ${soundName} omitido (mute o no cargado)`);
            return;
        }
        
        try {
            const sound = this.sounds[soundName].cloneNode();
            sound.volume = this.sounds[soundName].volume;
            
            const playPromise = sound.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log(`🔊 Reproducido: ${soundName}`);
                    })
                    .catch(error => {
                        console.log(`❌ Error reproduciendo ${soundName}:`, error);
                    });
            }
        } catch (error) {
            console.log(`❌ Excepción con ${soundName}:`, error);
        }
    }

    playMusic() {
        if (this.isMuted || !this.backgroundMusic) return;
        
        const playPromise = this.backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('🎵 Música iniciada');
                })
                .catch(error => {
                    console.log('❌ Música no pudo iniciarse:', error);
                    document.addEventListener('click', () => this.playMusic(), { once: true });
                });
        }
    }

    stopMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
            console.log('⏹️ Música detenida');
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('uno_sound_muted', this.isMuted);
        this.applyMuteState();
        
        if (!this.isMuted) {
            this.playMusic();
        } else {
            this.stopMusic();
        }
        
        console.log(`🔊 Mute: ${this.isMuted}`);
        return this.isMuted;
    }

    applyMuteState() {
        if (this.isMuted) {
            this.stopMusic();
        }
    }

    setupGlobalListeners() {
        // Sonidos para botones y elementos interactivos
        document.addEventListener('mouseover', (e) => {
            if (e.target.matches('button, .btn, a, .card, [data-sound-hover]')) {
                this.play('hover');
            }
        });

        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Determinar tipo de sonido
            if (target.matches('a[href*="/"], .btn--secondary, [data-sound-back]') || 
                target.closest('a[href*="/"], .btn--secondary, [data-sound-back]')) {
                this.play('back');
            } 
            else if (target.matches('button, .btn, .card, [data-sound-accept]') || 
                     target.closest('button, .btn, .card, [data-sound-accept]')) {
                this.play('accept');
            }

            // Intentar iniciar música con la primera interacción
            if (!window.musicInteraction) {
                this.playMusic();
                window.musicInteraction = true;
            }
        });

        // Persistir estado antes de cambiar de página
        window.addEventListener('beforeunload', () => {
            if (this.backgroundMusic && !this.backgroundMusic.paused) {
                localStorage.setItem('uno_music_playing', 'true');
            } else {
                localStorage.removeItem('uno_music_playing');
            }
        });

        // Restaurar música al cargar
        if (localStorage.getItem('uno_music_playing') === 'true' && !this.isMuted) {
            setTimeout(() => this.playMusic(), 1000);
        }
    }
}

// Inicialización global - ESTO ES CLAVE
document.addEventListener('DOMContentLoaded', function() {
    window.soundManager = new SoundManager();
    console.log('🔊 Sistema de sonidos inicializado');
});

// Función global para mute - ESTO ES CLAVE
window.toggleMute = function() {
    if (!window.soundManager) {
        console.log('❌ SoundManager no está disponible');
        return false;
    }
    
    const isMuted = window.soundManager.toggleMute();
    const muteBtn = document.getElementById('mute-btn');
    
    if (muteBtn) {
        if (isMuted) {
            muteBtn.innerHTML = '🔇 Silenciado';
            muteBtn.classList.add('muted');
        } else {
            muteBtn.innerHTML = '🔈 Sonido';
            muteBtn.classList.remove('muted');
        }
    }
    
    return isMuted;
};