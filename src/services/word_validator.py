from typing import List, Set, Tuple, Optional
from ..models.board import Board
from ..models.gaddag import GADDAG
from ..models.types import Direction
from ..utils.board_utils import BoardUtils

class WordValidator:
    """Valide les mots et les coups au Scrabble."""
    
    def __init__(self, board: Board, gaddag: GADDAG):
        self.board = board
        self.gaddag = gaddag
        self.board_utils = BoardUtils()
        
    def is_valid_word(self, word: str) -> bool:
        """Vérifie si un mot existe dans le dictionnaire."""
        return self.gaddag.contains(word)
    
    def validate_placement_complete(
        self, 
        word: str, 
        row: int, 
        col: int, 
        direction: Direction,
        check_connection: bool = True
    ) -> Tuple[bool, List[str], str]:
        """
        Validation COMPLÈTE d'un placement selon les règles du Scrabble.
        
        Vérifie:
        1. Limites du plateau
        2. Compatibilité avec lettres existantes
        3. TOUS les mots croisés formés (perpendiculaires)
        4. Extension du mot principal (lettres avant/après)
        5. Connexion à un mot existant (optionnel pour premier mot)
        
        Args:
            word: Le mot à placer
            row, col: Position de départ
            direction: Direction (HORIZONTAL ou VERTICAL)
            check_connection: Si True, vérifie qu'il y a une connexion
            
        Returns:
            Tuple (valide, liste_mots_formes, message_erreur)
        """
        mots_formes = []
        
        # 1. Vérifier les limites
        if direction == Direction.HORIZONTAL:
            if col < 0 or col + len(word) > self.board.size:
                return False, [], "Dépasse les limites horizontales"
        else:
            if row < 0 or row + len(word) > self.board.size:
                return False, [], "Dépasse les limites verticales"
        
        # 2. Vérifier le mot principal existe
        if not self.is_valid_word(word):
            return False, [], f"'{word}' n'existe pas dans le dictionnaire"
        
        # 3. Vérifier que le mot ne fusionne pas avec des lettres avant/après
        # pour créer un mot plus long invalide
        mot_etendu = self._get_extended_word(word, row, col, direction)
        if mot_etendu != word:
            if not self.is_valid_word(mot_etendu):
                return False, [], f"Extension invalide: '{mot_etendu}'"
            mots_formes.append(mot_etendu)
        else:
            mots_formes.append(word)
        
        has_connection = False
        
        # 4. Vérifier chaque position
        for i, letter in enumerate(word):
            if direction == Direction.HORIZONTAL:
                curr_row, curr_col = row, col + i
            else:
                curr_row, curr_col = row + i, col
            
            existing = self.board.get_letter(curr_row, curr_col)
            
            if existing:
                # Case déjà occupée
                if existing != letter:
                    return False, [], f"Conflit: '{existing}' != '{letter}' en ({curr_row},{curr_col})"
                has_connection = True
            else:
                # Nouvelle lettre - vérifier le mot croisé formé
                cross_word = self._get_formed_cross_word(curr_row, curr_col, direction, letter)
                
                if cross_word and len(cross_word) > 1:
                    if not self.is_valid_word(cross_word):
                        return False, [], f"Mot croisé invalide: '{cross_word}' en ({curr_row},{curr_col})"
                    mots_formes.append(cross_word)
                    has_connection = True
        
        # 5. Vérifier adjacence aux extrémités (avant/après le mot dans la même direction)
        if not has_connection and check_connection:
            # Check for letters before the word
            if direction == Direction.HORIZONTAL:
                if col > 0 and self.board.get_letter(row, col - 1):
                    has_connection = True
                if col + len(word) < self.board.size and self.board.get_letter(row, col + len(word)):
                    has_connection = True
            else:
                if row > 0 and self.board.get_letter(row - 1, col):
                    has_connection = True
                if row + len(word) < self.board.size and self.board.get_letter(row + len(word), col):
                    has_connection = True
        
        # 6. Vérifier adjacence perpendiculaire (sans former de mot)
        if not has_connection and check_connection:
            for i in range(len(word)):
                if direction == Direction.HORIZONTAL:
                    curr_row, curr_col = row, col + i
                else:
                    curr_row, curr_col = row + i, col
                
                if self._has_adjacent_letter(curr_row, curr_col, direction):
                    has_connection = True
                    break
        
        # 7. Vérifier qu'il y a une connexion (sauf premier mot)
        if check_connection and not has_connection:
            # Vérifier si c'est le premier mot (grille vide)
            if self._is_board_empty():
                # Premier mot - doit passer par le centre
                center = self.board.size // 2
                passes_center = False
                for i in range(len(word)):
                    if direction == Direction.HORIZONTAL:
                        if row == center and col <= center < col + len(word):
                            passes_center = True
                            break
                    else:
                        if col == center and row <= center < row + len(word):
                            passes_center = True
                            break
                if not passes_center:
                    return False, [], "Premier mot doit passer par le centre"
            else:
                return False, [], "Pas de connexion avec les mots existants"
        
        return True, mots_formes, "OK"
    
    def _get_extended_word(
        self,
        word: str,
        row: int,
        col: int,
        direction: Direction
    ) -> str:
        """
        Récupère le mot COMPLET qui serait formé en tenant compte des lettres
        existantes AVANT et APRÈS le placement.
        
        Exemple: Si on place "RAP" et qu'il y a déjà "T" après, retourne "RAPT".
        Si on place "AT" et qu'il y a "C" avant, retourne "CAT".
        """
        # Lettres avant le mot
        prefix = ""
        if direction == Direction.HORIZONTAL:
            c = col - 1
            while c >= 0 and self.board.get_letter(row, c):
                prefix = self.board.get_letter(row, c) + prefix
                c -= 1
        else:
            r = row - 1
            while r >= 0 and self.board.get_letter(r, col):
                prefix = self.board.get_letter(r, col) + prefix
                r -= 1
        
        # Lettres après le mot
        suffix = ""
        if direction == Direction.HORIZONTAL:
            c = col + len(word)
            while c < self.board.size and self.board.get_letter(row, c):
                suffix += self.board.get_letter(row, c)
                c += 1
        else:
            r = row + len(word)
            while r < self.board.size and self.board.get_letter(r, col):
                suffix += self.board.get_letter(r, col)
                r += 1
        
        return prefix + word + suffix
    
    def _get_formed_cross_word(
        self, 
        row: int, 
        col: int, 
        main_direction: Direction, 
        new_letter: str
    ) -> Optional[str]:
        """
        Récupère le mot croisé COMPLET formé quand on place une lettre.
        
        Exemple: Si on place 'A' et il y a 'B' au-dessus et 'T' en dessous,
        retourne 'BAT'.
        """
        cross_direction = Direction.VERTICAL if main_direction == Direction.HORIZONTAL else Direction.HORIZONTAL
        
        prefix = self.board_utils.get_prefix(self.board, row, col, cross_direction)
        suffix = self.board_utils.get_suffix(self.board, row, col, cross_direction)
        
        if not prefix and not suffix:
            return None
        
        return prefix + new_letter + suffix
    
    def _has_adjacent_letter(self, row: int, col: int, main_direction: Direction) -> bool:
        """Vérifie s'il y a une lettre adjacente (perpendiculairement)."""
        if main_direction == Direction.HORIZONTAL:
            # Vérifier au-dessus et en-dessous
            if row > 0 and self.board.get_letter(row - 1, col):
                return True
            if row < self.board.size - 1 and self.board.get_letter(row + 1, col):
                return True
        else:
            # Vérifier à gauche et à droite
            if col > 0 and self.board.get_letter(row, col - 1):
                return True
            if col < self.board.size - 1 and self.board.get_letter(row, col + 1):
                return True
        return False
    
    def _is_board_empty(self) -> bool:
        """Vérifie si la grille est vide."""
        return len(self.board.grid) == 0
        
    def is_valid_move(self, word: str, row: int, col: int, direction: Direction, graphe=None) -> bool:
        """
        Vérifie si un coup est valide localement (sans vérifier la connectivité globale).
        Vérifie uniquement :
        1. Si le mot existe dans le dictionnaire
        2. Si le placement est possible physiquement (limites, chevauchements)
        3. Si les mots croisés formés sont valides
        
        DEPRECATED: Utiliser validate_placement_complete() pour une validation complète.
        """
        # 1. Vérifie le mot principal
        if not self.is_valid_word(word):
            return False
            
        # 2. Vérifie les limites et chevauchements
        if direction == Direction.HORIZONTAL:
            if col + len(word) > self.board.size:
                return False
        else:
            if row + len(word) > self.board.size:
                return False
                
        # Vérifie les chevauchements
        for i in range(len(word)):
            curr_row = row + (i if direction == Direction.VERTICAL else 0)
            curr_col = col + (i if direction == Direction.HORIZONTAL else 0)
            
            existing = self.board.get_letter(curr_row, curr_col)
            if existing and existing != word[i]:
                return False
        
        # 3. Vérifie les mots croisés formés
        for i, letter in enumerate(word):
            current_row = row + (i if direction == Direction.VERTICAL else 0)
            current_col = col + (i if direction == Direction.HORIZONTAL else 0)
            
            if not self.board.get_letter(current_row, current_col):
                if not self._is_valid_cross_word(current_row, current_col, direction, letter, graphe):
                    return False

        return True
        
    def _is_valid_cross_word(self, row: int, col: int, main_direction: Direction, letter: str, graphe) -> bool:
        """Vérifie si le placement d'une lettre forme des mots croisés valides."""
        cross_word = self._get_formed_cross_word(row, col, main_direction, letter)
        
        if not cross_word or len(cross_word) <= 1:
            return True
        
        # Skip check if adjacent cell is part of an existing word (graphe fourni)
        if graphe and graphe.is_cell_occupied(row, col):
            return True

        return self.is_valid_word(cross_word)

    def get_all_words_on_board(self) -> List[Tuple[str, int, int, Direction]]:
        """
        Extrait TOUS les mots présents sur la grille.
        
        Returns:
            Liste de tuples (mot, row, col, direction)
        """
        words = []
        visited_h = set()
        visited_v = set()
        
        for row in range(self.board.size):
            for col in range(self.board.size):
                letter = self.board.get_letter(row, col)
                if not letter:
                    continue
                
                # Mot horizontal
                if (row, col) not in visited_h:
                    word_h, start_col = self._extract_word_at(row, col, Direction.HORIZONTAL)
                    if word_h and len(word_h) > 1:
                        words.append((word_h, row, start_col, Direction.HORIZONTAL))
                        for i in range(len(word_h)):
                            visited_h.add((row, start_col + i))
                
                # Mot vertical
                if (row, col) not in visited_v:
                    word_v, start_row = self._extract_word_at(row, col, Direction.VERTICAL)
                    if word_v and len(word_v) > 1:
                        words.append((word_v, start_row, col, Direction.VERTICAL))
                        for i in range(len(word_v)):
                            visited_v.add((start_row + i, col))
        
        return words
    
    def _extract_word_at(self, row: int, col: int, direction: Direction) -> Tuple[Optional[str], int]:
        """Extrait le mot complet passant par une position."""
        # Trouver le début du mot
        if direction == Direction.HORIZONTAL:
            start = col
            while start > 0 and self.board.get_letter(row, start - 1):
                start -= 1
            
            # Lire le mot
            word = ""
            c = start
            while c < self.board.size and self.board.get_letter(row, c):
                word += self.board.get_letter(row, c)
                c += 1
            
            return (word, start) if len(word) > 1 else (None, start)
        else:
            start = row
            while start > 0 and self.board.get_letter(start - 1, col):
                start -= 1
            
            # Lire le mot
            word = ""
            r = start
            while r < self.board.size and self.board.get_letter(r, col):
                word += self.board.get_letter(r, col)
                r += 1
            
            return (word, start) if len(word) > 1 else (None, start)
    
    def validate_board_integrity(self) -> Tuple[bool, List[str]]:
        """
        Vérifie que TOUS les mots sur la grille sont valides.
        
        Returns:
            Tuple (tous_valides, liste_mots_invalides)
        """
        words = self.get_all_words_on_board()
        invalid_words = []
        
        for word, row, col, direction in words:
            if not self.is_valid_word(word):
                invalid_words.append(f"{word} at ({row},{col}) {direction.value}")
        
        return len(invalid_words) == 0, invalid_words
