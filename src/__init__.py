"""
Train Scrabble - Un générateur de situations d'entraînement au Scrabble.

Utilise Natural Flow pour générer des grilles réalistes.
"""
from .models.board import Board
from .models.gaddag import GADDAG
from .models.types import Direction, Move
from .models.graph import ScrabbleGraph, Connection, WordNode

from .modules.cbic import (
    CBIC_generer_grille,
    Placement,
    generer_placements_connexes,
    score_unifie
)

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
    'CBIC_generer_grille',
    'Placement',
    'generer_placements_connexes',
    'score_unifie',
    'generer_situation_naturelle',
    'generer_situations_pour_liste',
    'WordValidator'
]
