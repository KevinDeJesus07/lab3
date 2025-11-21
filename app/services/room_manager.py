# app/services/room_manager.py

import threading
import time
import random
import string
from app.models.game import UnoGame

class RoomManager:
    def __init__(self, socketio_instance):
        self.rooms = {}
        self.lock = threading.Lock() # Control de concurrencia
        self.player_heartbeats = {}
        self.heartbeat_interval = 5
        self.socketio = socketio_instance
        self._start_heartbeat_checker()

    def _start_heartbeat_checker(self):
        """Hilo en segundo plano para verificar conexiones"""
        def check():
            while True:
                # Intervalo de chequeo
                time.sleep(self.heartbeat_interval) 
                
                with self.lock: # Sección crítica
                    now = time.time()
                    # Consideramos offline si no se recibe HB en 2.5 veces el intervalo
                    offline_sids = [
                        sid for sid, last in self.player_heartbeats.items() 
                        if now - last > self.heartbeat_interval * 2.5
                    ]
                    
                    for sid in offline_sids:
                        self._handle_disconnect(sid)
                        # Removemos solo después de manejar la desconexión
                        if sid in self.player_heartbeats:
                            del self.player_heartbeats[sid]

        threading.Thread(target=check, daemon=True).start()

    def create_room(self, room_name, host_sid, username):
        with self.lock:
            code = self._generate_code()
            self.rooms[code] = {
                'code': code,
                'name': room_name,
                'host_sid': host_sid,
                'players': [{'sid': host_sid, 'username': username, 'is_online': True}],
                'game': None, # Aquí irá la instancia de UnoGame
                'game_started': False, # Flag para saber si se debe redirigir
                'last_activity': time.time()
            }
            return code

    def join_room(self, room_code, sid, username):
        with self.lock:
            room = self.rooms.get(room_code)
            if not room: return False, "Sala no existe"
            
            # --- Lógica de reconexión/actualización de SID ---
            for p in room['players']:
                if p['username'] == username:
                    old_sid = p['sid']
                    p['sid'] = sid
                    p['is_online'] = True
                    
                    # Migrar mano si el juego ya empezó (CRUCIAL para la reconexión en juego)
                    if room['game']:
                        game = room['game']
                        
                        # 1. Migrar la mano del jugador
                        hand = game.players_hands.pop(old_sid, None)
                        if hand is not None:
                            game.players_hands[sid] = hand
                        
                        # 2. Actualizar el SID en la lista interna de jugadores del juego
                        for gp in game.players:
                            if gp['username'] == username: 
                                gp['sid'] = sid
                                break
                    
                    # Si el jugador reconectado era el host, actualizamos el host_sid
                    if room['host_sid'] == old_sid:
                         room['host_sid'] = sid
                        
                    return True, "Reconectado"

            # --- Lógica de nuevo jugador ---
            if room.get('game_started', False): return False, "Juego ya iniciado"
            if len(room['players']) >= 4: return False, "Sala llena (Máx 4)"
            
            room['players'].append({'sid': sid, 'username': username, 'is_online': True})
            return True, "Unido"

    def start_game(self, room_code, request_sid):
        """Instancia UnoGame, establece el flag de inicio y verifica permisos."""
        with self.lock:
            room = self.rooms.get(room_code)
            if not room: return False, "Error: Sala no encontrada."
            
            # Verificación CRÍTICA del Host
            if room['host_sid'] != request_sid: return False, "Solo Host puede iniciar el juego."
            
            if len(room['players']) < 2: return False, "Mínimo 2 jugadores para iniciar."
            
            # Si el juego ya está iniciado, no se puede iniciar de nuevo.
            if room.get('game_started', False): return False, "El juego ya ha comenzado."

            # Instanciar el modelo de juego
            room['game'] = UnoGame(room_code, room['players'])
            room['game_started'] = True # <--- Este flag es la clave
            
            return True, "Juego iniciado"

    def get_room(self, code):
        """Devuelve una sala, no protegido por lock para llamadas de lectura simples."""
        return self.rooms.get(code)

    def get_room_by_sid(self, sid):
        """Busca la sala a la que pertenece un SID. Usado por el checker."""
        for room in self.rooms.values():
            for p in room['players']:
                if p['sid'] == sid: return room
        return None

    def update_heartbeat(self, sid):
        self.player_heartbeats[sid] = time.time()

    def _handle_disconnect(self, sid):
        """Lógica interna cuando el hilo detecta desconexión"""
        room = self.get_room_by_sid(sid)
        if room:
            for p in room['players']:
                if p['sid'] == sid:
                    p['is_online'] = False
                    print(f"⚠️ {p['username']} en sala {room['code']} se ha desconectado.")
                    
                    # Notificar a los demás jugadores de la desconexión
                    self.socketio.emit('player_offline', 
                        {
                            'username': p['username'], 
                            # Podrías enviar el estado completo actualizado si la UI lo requiere
                            'players': room['players'] 
                        }, 
                        room=room['code']
                    )
                    break

    def _generate_code(self):
        """Genera un código de sala único de 6 caracteres."""
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))