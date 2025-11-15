class Card:

    def __init__(self, color: str, value: str, special: bool = False):
        self.color = color
        self.value = value
        self.special = special

    def to_dict(self):
        return {
            "color": self.color,
            "value": self.value,
            "special": self.special
        }
    
    def get_display_name(self):
        if self.color == 'black':
            return self.value.replace("_", " ").title()
        
        return f"{self.color} {self.value}"
    
    def __repr__(self):
        return f"Card({self.color}, {self.value}, special={self.special})"