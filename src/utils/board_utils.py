from typing import List, Set
from ..models.board import Board
from ..models.types import Direction
from typing import List, Set, Tuple, Optional

class BoardUtils:
    """Utilitaires pour manipuler le plateau de jeu."""
    
    @staticmethod
    def get_prefix(board: Board, row: int, col: int, direction: Direction) -> str:
        """Obtient le préfixe pour une position donnée."""
        prefix = []
        current_row, current_col = row, col
        
        while True:
            if direction == Direction.HORIZONTAL:
                current_col -= 1
            else:
                current_row -= 1
                
            if not (0 <= current_row < board.size and 
                   0 <= current_col < board.size):
                break
                
            letter = board.get_letter(current_row, current_col)
            if not letter:
                break
            prefix.insert(0, letter)
            
        return ''.join(prefix)
    
    @staticmethod
    def get_suffix(board: Board, row: int, col: int, direction: Direction) -> str:
        """Obtient le suffixe pour une position donnée."""
        suffix = []
        current_row, current_col = row, col
        
        while True:
            if direction == Direction.HORIZONTAL:
                current_col += 1
            else:
                current_row += 1
                
            if not (0 <= current_row < board.size and 
                   0 <= current_col < board.size):
                break
                
            letter = board.get_letter(current_row, current_col)
            if not letter:
                break
            suffix.append(letter)
            
        return ''.join(suffix)
    
    def check_word_placement(self, board: Board, word: str, row: int, col: int, direction: Direction) -> bool:
        """Vérifie les règles de base pour le placement d'un mot."""
        # 1. Vérifie les limites du plateau
        word_length = len(word)
        if direction == Direction.HORIZONTAL:
            if col < 0 or col + word_length > board.size:
                return False
        else:  # VERTICAL
            if row < 0 or row + word_length > board.size:
                return False

        # 2. Vérifie le premier coup
        if board.is_empty():
            center = board.size // 2
            if direction == Direction.HORIZONTAL:
                return row == center and (col <= center < col + word_length)
            else:  # VERTICAL
                return col == center and (row <= center < row + word_length)

        # 3. Vérifie les connexions
        found_connection = False
        
        for i, letter in enumerate(word):
            current_row = row + (i if direction == Direction.VERTICAL else 0)
            current_col = col + (i if direction == Direction.HORIZONTAL else 0)
            
            existing = board.get_letter(current_row, current_col)
            if existing:
                if existing != letter:
                    return False
                found_connection = True
            elif board.is_adjacent_to_letter(current_row, current_col):
                found_connection = True

        return found_connection or (board.is_empty() and word_length > 0)

