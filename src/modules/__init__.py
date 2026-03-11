"""
Modules pour la génération de situations d'entraînement au Scrabble.

Algorithme principal: Natural Flow (Anchor → Breathe → Stage)
CBIC archivé dans legacy/cbic.py
"""

from .natural_flow import (
    generer_situation_naturelle,
    generer_situations_pour_liste
)
