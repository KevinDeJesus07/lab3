import random
from .card import Card

class Deck:

    def __init__(self):
        self.cards = []
        self.discard_pile = []
        self.build_standard_uno_deck()
        self.shuffle()
    
    def build_standard_uno_deck(self):
        colors = ["red", "blue", "green", "yellow"]
        numbers = [str(i) for i in range(10)]
        action_cards = ["skip", "reverse", "draw_two"]
        
        for color in colors:
            self.cards.append(Card(color, "0"))
            
            for number in numbers[1:]:
                self.cards.append(Card(color, number))
                self.cards.append(Card(color, number))
            
            for action in action_cards:
                self.cards.append(Card(color, action, special=True))
                self.cards.append(Card(color, action, special=True))
        
        for _ in range(4):
            self.cards.append(Card("black", "wild", special=True))
            self.cards.append(Card("black", "wild_draw_four", special=True))
    
    def shuffle(self):
        random.shuffle(self.cards)
    
    def draw_card(self):
        if not self.cards:
            self.reshuffle_discard()
        return self.cards.pop() if self.cards else None
    
    def reshuffle_discard(self):
        if self.discard_pile:
            last_card = self.discard_pile.pop()
            self.cards = self.discard_pile
            self.discard_pile = [last_card]
            self.shuffle()
    
    def add_to_discard(self, card):
        self.discard_pile.append(card)
    
    def __len__(self):
        return len(self.cards)