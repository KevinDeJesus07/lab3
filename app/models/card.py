class Card:
    def __init__(self, color, value, special=False):
        self.color = color  # red, blue, green, yellow, black (wild)
        self.value = value  # 0-9, skip, reverse, draw2, wild, draw4
        self.special = special or value in ['skip', 'reverse', 'draw2', 'wild', 'draw4']

    def to_dict(self):
        return {
            'color': self.color,
            'value': self.value,
            'special': self.special
        }

    def __repr__(self):
        return f"{self.color}_{self.value}"