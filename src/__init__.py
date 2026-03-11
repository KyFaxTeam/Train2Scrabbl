"""
Train Scrabble - Un générateur de situations d'entraînement au Scrabble.

Utilise Natural Flow pour générer des grilles réalistes.
CBIC (legacy) archivé dans legacy/.
"""
from .models.board import Board
from .models.gaddag import GADDAG
from .models.types import Direction, Move
from .models.graph import ScrabbleGraph, Connection, WordNode

from .modules.natural_flow import (
    generer_situation_naturelle,
    generer_situations_pour_liste
)

from .services.word_validator import WordValidator

__all__ = [
    'Board',
    'GADDAG',
    'Direction',
    'Move',
    'ScrabbleGraph',
    'Connection',
    'WordNode',
    'generer_situation_naturelle',
    'generer_situations_pour_liste',
    'WordValidator'
]
