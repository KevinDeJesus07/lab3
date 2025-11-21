import random
from .card import Card

class Deck:
    def __init__(self):
        self.cards = []
        self.discard_pile = []
        self._build()
        self.shuffle()

    def _build(self):
        colors = ['red', 'blue', 'green', 'yellow']
        
        for color in colors:
            # 0 solo hay una vez por color
            self.cards.append(Card(color, '0'))
            
            # 1-9 hay dos veces por color
            for i in range(1, 10):
                self.cards.append(Card(color, str(i)))
                self.cards.append(Card(color, str(i)))
            
            # Acciones (2 de cada una por color)
            actions = ['skip', 'reverse', 'draw2']
            for action in actions:
                self.cards.append(Card(color, action, special=True))
                self.cards.append(Card(color, action, special=True))
        
        # Comodines (4 de cada uno)
        for _ in range(4):
            self.cards.append(Card('black', 'wild', special=True))
            self.cards.append(Card('black', 'draw4', special=True))

    def shuffle(self):
        random.shuffle(self.cards)

    def draw_card(self):
        if not self.cards:
            if not self.discard_pile:
                return None
            
            # Reciclar descarte si se acaba el mazo
            # Dejamos la última carta (índice -1) en la mesa/descarte para que siga siendo visible
            self.cards = self.discard_pile[:-1] 
            self.discard_pile = [self.discard_pile[-1]]
            self.shuffle()
            
            if not self.cards: return None # Doble chequeo por si no hay nada
            
        return self.cards.pop()

    def add_to_discard(self, card):
        # Aseguramos que solo guardamos la representación de diccionario en el descarte
        if isinstance(card, Card):
            card_dict = card.to_dict()
        else: # Si ya es un dict
            card_dict = card
            
        self.discard_pile.append(card_dict)