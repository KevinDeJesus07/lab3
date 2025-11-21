# app/models/game.py
import random
from app.models.deck import Deck
# Definición de colores para el Wild (necesario para el Frontend)
COLORS_LIST = ['red', 'blue', 'green', 'yellow'] 

class UnoGame:
    def __init__(self, room_code, players_data):
        self.room_code = room_code
        self.deck = Deck()
        self.players = players_data  # Lista ordenada de jugadores
        self.players_hands = {}      # SID -> [Cartas Dict]
        self.current_card = None     # La carta superior de la pila de descarte (dict)
        self.current_player_idx = 0  # Índice en self.players
        self.direction = 1           # 1: Horario, -1: Anti-horario
        self.winner = None
        
        self._initialize_game()

    def _initialize_game(self):
        # 1. Repartir cartas
        for p in self.players:
            hand = [self.deck.draw_card().to_dict() for _ in range(7)]
            self.players_hands[p['sid']] = hand

        # 2. Poner primera carta válida
        while True:
            card = self.deck.draw_card()
            # La primera carta debe ser numérica y no Wild
            if card and card.color != 'black' and not card.special:
                self.current_card = card.to_dict()
                break
            
            if card: self.deck.add_to_discard(card)
        
        self.deck.add_to_discard(self.current_card)

        # 3. Elegir primer jugador al azar
        self.current_player_idx = random.randint(0, len(self.players) - 1)

    @property
    def current_player_data(self):
        return self.players[self.current_player_idx]
        
    def get_player_data_by_sid(self, sid):
        """Busca y devuelve el dict de datos del jugador (sid, username) usando su SID."""
        # self.players debería ser la lista de {'sid': sid, 'username': user} que pasó RoomManager
        for p in self.players:
            if p['sid'] == sid:
                return p
        return None # Retorna None si no se encuentra

    def _get_next_player_data(self):
        """Devuelve el objeto del jugador que le toca después."""
        count = len(self.players)
        idx = (self.current_player_idx + self.direction) % count
        return self.players[idx]

    def _advance_turn(self, skip=False):
        """Avanza el turno, opcionalmente saltando un jugador."""
        steps = 2 if skip else 1
        count = len(self.players)
        self.current_player_idx = (self.current_player_idx + (self.direction * steps)) % count

    # --- Lógica de Jugabilidad ---

    def validate_play(self, card_to_play):
        top_card = self.current_card
        
        # 1. Cartas Wild (black) siempre son válidas
        if card_to_play['color'] == 'black': 
            return True
            
        # Determinar el color de comparación (puede ser el color declarado del wild anterior)
        # Si current_card tiene 'declared_color' (porque fue un Wild), usamos ese color.
        color_to_match = top_card.get('declared_color', top_card['color'])
            
        # 2. Mismo Color (o color declarado)
        if card_to_play['color'] == color_to_match: 
            return True
            
        # 3. Mismo Valor (ej. Rojo 5 sobre Azul 5, o Reverse sobre Reverse)
        if card_to_play['value'] == top_card['value']: 
            return True
            
        return False

    def play_card(self, player_sid, card_index, declared_color=None):
        if self.winner: raise ValueError("Juego terminado.")
        if self.current_player_data['sid'] != player_sid:
            raise ValueError("No es tu turno para jugar.")
            
        hand = self.players_hands[player_sid]
        
        if card_index >= len(hand):
            raise ValueError("Carta no existe en tu mano.")
        
        card_played = hand[card_index]
        
        # Validar la jugada
        if not self.validate_play(card_played):
            raise ValueError("Jugada inválida (no coincide color, valor ni es Wild).")

        # 1. Ejecutar jugada: remover de la mano y actualizar carta actual
        hand.pop(card_index)
        self.current_card = card_played
        self.deck.add_to_discard(card_played)

        # 2. Aplicar efectos y determinar avance de turno
        skip_next = False
        
        val = card_played['value']
        
        if val == 'reverse':
            self.direction *= -1
            if len(self.players) == 2: 
                skip_next = True # Reverse actúa como Skip en 2 jugadores

        elif val == 'skip':
            skip_next = True
        
        elif val == 'draw2':
            victim = self._get_next_player_data()
            self._give_cards(victim['sid'], 2)
            skip_next = True

        elif val in ['wild', 'draw4']:
            # La carta Wild debe declarar un color
            if declared_color not in COLORS_LIST:
                raise ValueError("Debes declarar un color válido (red, blue, green, yellow).")
                
            self.current_card['declared_color'] = declared_color
            
            if val == 'draw4':
                if declared_color not in COLORS_LIST:
                    raise ValueError("Debes declarar un color válido (red, blue, green, yellow).")

                victim = self._get_next_player_data()
                self._give_cards(victim['sid'], 4)
                skip_next = True
        else:
            # Si se juega una carta numérica o de acción de color, limpiamos el color declarado si existía
            if 'declared_color' in self.current_card:
                del self.current_card['declared_color']


        # 3. Verificar victoria
        if len(hand) == 0:
            self.winner = self.current_player_data['username']
            return {'status': 'win'}

        # 4. Chequear UNO
        if len(hand) == 1:
            # Aquí podríamos implementar un temporizador para "decir UNO"
            pass

        # 5. Avanzar turno
        self._advance_turn(skip=skip_next)
        
        return {'status': 'play', 'card': card_played}

    def draw_card(self, player_sid):
        if self.winner: raise ValueError("Juego terminado.")
        if self.current_player_data['sid'] != player_sid:
            raise ValueError("No es tu turno para robar.")
            
        card_drawn_obj = self.deck.draw_card()
        if not card_drawn_obj: 
            raise ValueError("Mazo vacío.")

        card_drawn = card_drawn_obj.to_dict()
        self.players_hands[player_sid].append(card_drawn)
        
        # Después de robar, el turno pasa al siguiente jugador
        # Regla simple: Robas y pasas el turno
        self._advance_turn()
        
        return card_drawn

    def _give_cards(self, sid, amount):
        """Da 'amount' cartas al jugador con 'sid'."""
        for _ in range(amount):
            c = self.deck.draw_card()
            if c: self.players_hands[sid].append(c.to_dict())


    # --- Gestión de Estado para el Cliente ---

    def get_game_state_for_player(self, sid):
        """Devuelve el estado del juego, incluyendo la mano privada."""
        player = self.get_player_data_by_sid(sid)
        
        if player is None: # <-- Manejar el caso de jugador no encontrado (ERROR ORIGINAL)
            return {
                'error': 'Player not found or not synchronized.',
                'game_started': False
            }

        # 1. Estado de Jugadores Públicos
        public_players = [
            {
                'username': p['username'], 
                'card_count': len(self.players_hands.get(p['sid'], [])),
                'is_online': p.get('is_online', True),
                'sid': p['sid']
            } 
            for p in self.players
        ]
        
        # 2. Carta Actual (para el display en el Frontend)
        current_card_display = self.current_card.copy()
        # Si la carta actual es Wild, el color de la imagen debe ser el color declarado
        if 'declared_color' in self.current_card:
            # El Frontend usará 'color' = 'red' pero 'value' = 'wild' para la imagen si es Draw4
            # Para la validación, el Frontend necesita el color que debe jugar
            current_card_display['match_color'] = self.current_card['declared_color']
        else:
             current_card_display['match_color'] = self.current_card['color']

        return {
            'room_code': self.room_code,
            'current_card': current_card_display, # Incluye color/valor para renderizar
            'current_player': self.current_player_data['username'],
            'direction': self.direction,
            'players': public_players,
            'player_hand': self.players_hands.get(sid, []), # Mano privada
            'your_username': player['username']
        }

    def update_player_sid(self, old_sid, new_sid):
        """Actualiza el SID de un jugador en todas las estructuras internas del juego."""
        
        # 1. Actualizar en la lista principal de jugadores
        for p in self.players:
            if p['sid'] == old_sid:
                p['sid'] = new_sid # ¡ACTUALIZADO!
                break
        
        # 2. MIGRAR LA MANO: Usamos POP para mover la lista de la mano a la nueva clave
        if old_sid in self.players_hands:
            self.players_hands[new_sid] = self.players_hands.pop(old_sid) # CLAVE CRÍTICA
            
        # 3. Actualizar la información del jugador actual (si el SID es el que tiene el turno)
        # Asumo que self.current_player_data es un diccionario con 'sid'
        if self.current_player_data and self.current_player_data.get('sid') == old_sid:
            self.current_player_data['sid'] = new_sid # ¡ACTUALIZADO!