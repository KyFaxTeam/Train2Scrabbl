from enum import Enum
from typing import Dict, List, Optional, Tuple, Set
import string
import re
from .types import Direction, Move, SquareType

class Board:
    """Représente le plateau de jeu Scrabble."""
    
    # Taille standard du plateau
    SIZE = 15
    
    # Motif pour valider les coordonnées (ex: 'H8', 'A12')
    COORD_PATTERN = re.compile(r'^([A-O])(\d{1,2})$')
    
    # Multiplicateurs de score
    TRIPLE_WORD_SCORE = [(0, 0), (0, 7), (0, 14), (7, 0), (7, 14), (14, 0), (14, 7), (14, 14)]
    DOUBLE_WORD_SCORE = [(1, 1), (1, 13), (2, 2), (2, 12), (3, 3), (3, 11), (4, 4), (4, 10),
                         (7, 7), (10, 4), (10, 10), (11, 3), (11, 11), (12, 2), (12, 12),
                         (13, 1), (13, 13)]
    TRIPLE_LETTER_SCORE = [(1, 5), (1, 9), (5, 1), (5, 5), (5, 9), (5, 13), (9, 1), (9, 5),
                          (9, 9), (9, 13), (13, 5), (13, 9)]
    DOUBLE_LETTER_SCORE = [(0, 3), (0, 11), (2, 6), (2, 8), (3, 0), (3, 7), (3, 14), (6, 2),
                          (6, 6), (6, 8), (6, 12), (7, 3), (7, 11), (8, 2), (8, 6), (8, 8),
                          (8, 12), (11, 0), (11, 7), (11, 14), (12, 6), (12, 8), (14, 3),
                          (14, 11)]

    def __init__(self):
        """Initialise un plateau vide."""
        self.size = self.SIZE
        self.grid = [[None for _ in range(self.size)] for _ in range(self.size)]  # Changement ici
        self.center = self.size // 2
        self.used_multipliers = set()
        self.total_score = 0
        self.move_history = []
    
    def debug_print(self, message: str = "") -> None:
        """Affiche l'état actuel de la grille avec un message."""
        print(f"\n=== {message} ===")
        for row in range(self.size):
            line = ""
            for col in range(self.size):
                letter = self.get_letter(row, col)
                line += f" {letter if letter else '·'} "
            print(line)
        print("=" * (self.size * 3))
        
    def is_empty(self) -> bool:
        """Vérifie si le plateau est vide."""
        return not any(self.grid[i][j] for i in range(self.size) for j in range(self.size))
    
    def is_center_occupied(self) -> bool:
        """Vérifie si la case centrale est occupée."""
        return (self.center, self.center) in self.grid
    
    def get_letter(self, row: int, col: int) -> Optional[str]:
        """Récupère une lettre de la grille."""
        if 0 <= row < self.size and 0 <= col < self.size:
            return self.grid[row][col]
        return None
    
    def place_letter(self, row: int, col: int, letter: str) -> None:
        """Place une lettre sur la grille."""
        if 0 <= row < self.size and 0 <= col < self.size:
            self.grid[row][col] = letter
        else:
            raise ValueError(f"Position invalide : ({row}, {col})")

    def clear_letter(self, row: int, col: int) -> None:
        """Efface une lettre de la grille."""
        if 0 <= row < self.size and 0 <= col < self.size:
            self.grid[row][col] = None
    
    def parse_coordinates(self, coord_str: str) -> Tuple[int, int]:
        """Convertit une chaîne de coordonnées (ex: 'H8') en indices (row, col)."""
        match = self.COORD_PATTERN.match(coord_str.upper())
        if not match:
            raise ValueError(f"Format de coordonnées invalide: {coord_str}")
            
        row = ord(match.group(1)) - ord('A')
        col = int(match.group(2)) - 1
        
        if not (0 <= row < self.size and 0 <= col < self.size):
            raise ValueError(f"Coordonnées hors limites: {coord_str}")
            
        return row, col
    
    def get_multiplier(self, row: int, col: int) -> Tuple[int, int]:
        """
        Retourne les multiplicateurs (lettre, mot) pour une position.
        Format: (multiplicateur_lettre, multiplicateur_mot)
        """
        pos = (row, col)
        if pos in self.TRIPLE_WORD_SCORE:
            return (1, 3)
        if pos in self.DOUBLE_WORD_SCORE:
            return (1, 2)
        if pos in self.TRIPLE_LETTER_SCORE:
            return (3, 1)
        if pos in self.DOUBLE_LETTER_SCORE:
            return (2, 1)
        return (1, 1)
    
    def place_word(self, row: int, col: int, word: str, direction: str) -> bool:
        """Place un mot sur le plateau dans une direction donnée."""
        # Vérifie les limites du plateau
        if direction == 'H':
            if col + len(word) > self.size:
                return False
        elif direction == 'V':  # 'V'
            if row + len(word) > self.size:
                return False
        else:
            raise ValueError(f"Invalid direction: {direction}")

        # Vérifie si les positions sont libres
        for i, letter in enumerate(word):
            curr_row = row + (i if direction == 'V' else 0)
            curr_col = col + (i if direction == 'H' else 0)
            
            if self.get_letter(curr_row, curr_col):
                return False

        # Place les lettres
        for i, letter in enumerate(word):
            curr_row = row + (i if direction == 'V' else 0)
            curr_col = col + (i if direction == 'H' else 0)
            self.place_letter(curr_row, curr_col, letter)

        return True

    def get_square_type(self, row: int, col: int) -> SquareType:
        """Retourne le type de case à une position donnée."""
        pos = (row, col)
        if pos in self.TRIPLE_WORD_SCORE:
            return SquareType.TRIPLE_WORD
        if pos in self.DOUBLE_WORD_SCORE:
            return SquareType.DOUBLE_WORD
        if pos in self.TRIPLE_LETTER_SCORE:
            return SquareType.TRIPLE_LETTER
        if pos in self.DOUBLE_LETTER_SCORE:
            return SquareType.DOUBLE_LETTER
        if pos == (self.center, self.center):
            return SquareType.START
        return SquareType.NORMAL

    def is_adjacent_to_letter(self, row: int, col: int) -> bool:
        """Vérifie si une case est adjacente à une lettre placée."""
        # Vérifie les quatre directions
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            r, c = row + dr, col + dc
            if 0 <= r < self.size and 0 <= c < self.size:
                if self.get_letter(r, c):
                    return True
        return False

    def is_valid_position(self, row: int, col: int) -> bool:
        """Vérifie si une position est valide sur le plateau."""
        return 0 <= row < self.size and 0 <= col < self.size
    
    def reset_multipliers(self) -> None:
        """Réinitialise les multiplicateurs utilisés."""
        self.used_multipliers.clear()

    def use_multiplier(self, row: int, col: int) -> None:
        """Marque un multiplicateur comme utilisé."""
        self.used_multipliers.add((row, col))

    def get_square_multipliers(self, row: int, col: int) -> Tuple[int, int]:
        """
        Retourne les multiplicateurs actifs pour une case.
        Format: (multiplicateur_lettre, multiplicateur_mot)
        """
        pos = (row, col)
        if pos in self.used_multipliers:
            return (1, 1)  # Multiplicateurs déjà utilisés
        return self.get_multiplier(row, col)

    def get_last_move(self) -> Optional[Tuple[Move, int]]:
        """Retourne le dernier coup joué et son score."""
        return self.move_history[-1] if self.move_history else None

    def get_total_score(self) -> int:
        """Retourne le score total."""
        return self.total_score

    def apply_move(self, move: Move, score: int) -> None:
        """Applique un coup sur le plateau et enregistre son score."""
        # Place les lettres
        for i, letter in enumerate(move.word):
            row = move.row + (i if move.direction == Direction.VERTICAL else 0)
            col = move.col + (i if move.direction == Direction.HORIZONTAL else 0)
            self.place_letter(row, col, letter)
            # Marque les multiplicateurs comme utilisés
            self.use_multiplier(row, col)
        
        # Met à jour l'historique et le score
        self.move_history.append((move, score))
        self.total_score += score
        
    def undo_last_move(self) -> Optional[Tuple[Move, int]]:
        """Remove last move and its score."""
        if not self.move_history:
            return None
            
        last_move, score = self.move_history.pop()
        self.total_score -= score
        
        # Remove letters
        for i, _ in enumerate(last_move.word):
            row = last_move.row + (i if last_move.direction == Direction.VERTICAL else 0)
            col = last_move.col + (i if last_move.direction == Direction.HORIZONTAL else 0)
            self.grid[row][col] = None
            
        return last_move, score

    def get_move_history(self) -> List[Tuple[Move, int]]:
        """Returns the history of moves and their scores."""
        return self.move_history.copy()

    def __str__(self) -> str:
        """Retourne une représentation visuelle du plateau."""
        result = ["   " + " ".join(f"{i+1:2}" for i in range(self.size))]
        result.append("   " + "-" * (self.size * 3 + 2))
        
        for row in range(self.size):
            line = [f"{chr(65+row)} |"]
            for col in range(self.size):
                letter = self.grid[row][col] or "·"
                line.append(f" {letter} ")
            result.append("".join(line))
            
        return "\n".join(result)
