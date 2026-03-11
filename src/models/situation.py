"""
Module de modèles pour Natural Flow.

Contient les structures de données pour les situations d'entraînement
générées par l'algorithme Natural Flow.
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .board import Board


@dataclass
class AnchorPoint:
    """Point d'ancrage pour la lettre d'appui."""
    row: int
    col: int
    letter: str


@dataclass
class Placement:
    """Représente un placement de mot sur la grille."""
    mot: str
    position: Tuple[int, int]  # (row, col) position de départ
    direction: str  # 'H' ou 'V'
    score_scrabble: int = 0


@dataclass
class Solution:
    """Solution pour jouer le mot cible."""
    mot: str
    placement: Placement
    tirage: List[str]
    score: int


@dataclass
class NaturalFlowConfig:
    """Configuration pour l'algorithme Natural Flow."""
    profondeur_respiration: int = 8  # Nombre de coups à simuler
    max_retries: int = 3  # Nombre de tentatives si échec
    seuil_naturalite: float = 50.0  # Score minimum accepté


@dataclass
class NaturalityScore:
    """Score multi-dimensionnel de naturalité d'une grille."""
    
    # Ratios structurels
    ratio_mots_courts: float = 0.0      # Idéal: 0.5-0.6
    ratio_mots_moyens: float = 0.0      # Idéal: 0.3-0.35
    ratio_mots_longs: float = 0.0       # Idéal: 0.1-0.15
    
    # Métriques spatiales
    densite_moyenne: float = 0.0        # Idéal: 0.15-0.25 (15-25% de cases occupées)
    variance_densite: float = 0.0       # Idéal: élevée (zones denses ET aérées)
    expansion_score: float = 0.0        # Idéal: élevé (utilise les bords)
    
    # Métriques de connexion
    ratio_croix_vs_collantes: float = 0.0  # Idéal: 0.4-0.6 (équilibré)
    
    # Métriques pédagogiques
    accessibilite_cible: float = 0.0    # Idéal: 1.0 (mot cible clairement jouable)
    lisibilite: float = 0.0             # Idéal: élevée (pas de zone confuse)
    
    def score_global(self) -> float:
        """Calcule un score global de naturalité."""
        score = 0.0
        
        # Pénalité si ratio de mots longs trop élevé
        if self.ratio_mots_longs > 0.3:
            score -= 50 * (self.ratio_mots_longs - 0.3)
        
        # Bonus pour bonne densité
        if 0.15 <= self.densite_moyenne <= 0.25:
            score += 30
        elif self.densite_moyenne < 0.15:
            score += 15  # Acceptable si un peu faible
        
        # Bonus pour variance de densité (zones variées)
        score += self.variance_densite * 20
        
        # Bonus expansion
        score += self.expansion_score * 15
        
        # Bonus équilibre croix/collantes
        if 0.4 <= self.ratio_croix_vs_collantes <= 0.6:
            score += 25
        
        # CRITIQUE: accessibilité du mot cible
        score += self.accessibilite_cible * 100
        
        # Lisibilité
        score += self.lisibilite * 30
        
        return score


@dataclass
class SituationEntrainement:
    """Situation d'entraînement complète générée par Natural Flow."""
    grille: 'Board'
    mot_cible: str
    tirage: List[str]
    solution: Optional[Solution] = None
    score_naturalite: Optional[NaturalityScore] = None
    mots_places: List[str] = field(default_factory=list)
