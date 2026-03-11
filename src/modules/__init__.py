"""
Modules pour la génération de situations d'entraînement au Scrabble.

Migration vers Natural Flow:
- natural_flow: Algorithme principal pour situations réalistes
- cbic: Construction Incrémentale par Contraintes (legacy)
"""

from .cbic import (
    CBIC_generer_grille,
    Placement,
    generer_placements_connexes,
    est_placement_valide,
    score_unifie
)

from .natural_flow import (
    generer_situation_naturelle,
    generer_situations_pour_liste
)

# Note: optimization module removed - functionality integrated into natural_flow
