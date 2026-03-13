"""
Module Natural Flow - Génération de situations d'entraînement naturelles.

Philosophie: "Un mot doit être JOUABLE, pas PRÉSENT."

Génère des grilles de Scrabble réalistes où le joueur peut découvrir
et jouer un mot cible, contrairement à CBIC qui entasse tous les mots.

Architecture:
- Phase 1 (Anchor): Positionner la lettre d'appui stratégiquement
- Phase 2 (Breathe): Construire une grille "naturelle" avec mots variés
- Phase 3 (Stage): Vérifier que le mot cible est jouable

IMPORTANT: Ce module RÉUTILISE les services existants:
- WordValidator pour la validation des placements
- ScoreCalculator pour le calcul des scores
- BoardUtils pour les utilitaires de grille
"""

from dataclasses import dataclass
from typing import List, Dict, Set, Tuple, Optional
import logging
import random
import copy

from ..models.board import Board
from ..models.gaddag import GADDAG
from ..models.types import Direction
from ..models.situation import (
    AnchorPoint, Placement, Solution, 
    NaturalFlowConfig, NaturalityScore, SituationEntrainement
)
from ..services.score_calculator import ScoreCalculator
from ..services.word_validator import WordValidator
from ..services.word_pool import WordPool
from ..utils.board_utils import BoardUtils

logger = logging.getLogger(__name__)


# ============================================================================
# PHASE 1: ANCHOR (Ancrage)
# ============================================================================

def phase_anchor(
    mot_cible: str,
    lettre_appui: str,
    grille: Board
) -> AnchorPoint:
    """
    Détermine OÙ placer la lettre d'appui pour créer une opportunité réaliste.
    
    Critères de placement:
    1. Proximité d'une case multiplicatrice (TW, DW, TL, DL)
    2. Espace suffisant pour poser le mot cible (2 directions)
    3. Position "crédible" (pas en coin isolé)
    """
    positions_candidates = []
    
    for row in range(grille.size):
        for col in range(grille.size):
            score = _evaluer_position_appui(
                grille, row, col, mot_cible, lettre_appui
            )
            if score > 0:
                positions_candidates.append((row, col, score))
    
    # Trier par score décroissant
    positions_candidates.sort(key=lambda x: x[2], reverse=True)
    
    if not positions_candidates:
        # Fallback au centre
        center = grille.size // 2
        return AnchorPoint(row=center, col=center, letter=lettre_appui)
    
    # Choisir parmi les top 5 pour variété
    top_candidates = positions_candidates[:5]
    best = random.choice(top_candidates)
    
    return AnchorPoint(row=best[0], col=best[1], letter=lettre_appui)


def _evaluer_position_appui(
    grille: Board,
    row: int,
    col: int,
    mot_cible: str,
    lettre_appui: str
) -> float:
    """Évalue la qualité d'une position pour l'ancre."""
    score = 0.0
    mot_len = len(mot_cible)
    
    # 1. Espace disponible pour le mot cible
    espace_h = _calculer_espace(grille, row, col, Direction.HORIZONTAL)
    espace_v = _calculer_espace(grille, row, col, Direction.VERTICAL)
    
    if espace_h < mot_len and espace_v < mot_len:
        return 0  # Impossible de jouer le mot ici
    
    score += max(espace_h, espace_v) * 2
    
    # 2. Proximité des multiplicateurs
    multiplicateurs_proches = _compter_multiplicateurs_accessibles(
        grille, row, col, mot_len
    )
    score += multiplicateurs_proches * 15
    
    # 3. Distance au centre (favoriser le milieu de la grille)
    center = grille.size // 2
    distance_centre = abs(row - center) + abs(col - center)
    score -= distance_centre * 0.5
    
    # 4. Naturalité de la position
    if 3 <= row <= 11 and 3 <= col <= 11:
        score += 10  # Zone centrale = naturel
    
    # 5. Bonus si sur ou près d'une case multiplicatrice
    letter_mult, word_mult = grille.get_multiplier(row, col)
    if word_mult > 1:
        score += 20
    if letter_mult > 1:
        score += 10
    
    return score


def _calculer_espace(grille: Board, row: int, col: int, direction: Direction) -> int:
    """Calcule l'espace disponible dans une direction."""
    if direction == Direction.HORIZONTAL:
        return col + (grille.size - 1 - col) + 1
    else:
        return row + (grille.size - 1 - row) + 1


def _compter_multiplicateurs_accessibles(
    grille: Board,
    row: int,
    col: int,
    mot_len: int
) -> int:
    """Compte les multiplicateurs accessibles depuis une position."""
    count = 0
    
    # Vérifier horizontalement
    for c in range(max(0, col - mot_len + 1), min(grille.size, col + mot_len)):
        letter_mult, word_mult = grille.get_multiplier(row, c)
        if word_mult > 1 or letter_mult > 1:
            count += 1
    
    # Vérifier verticalement
    for r in range(max(0, row - mot_len + 1), min(grille.size, row + mot_len)):
        letter_mult, word_mult = grille.get_multiplier(r, col)
        if word_mult > 1 or letter_mult > 1:
            count += 1
    
    return count


# ============================================================================
# PHASE 2: BREATHE (Respiration)
# ============================================================================

def phase_breathe(
    grille: Board,
    anchor: AnchorPoint,
    gaddag: GADDAG,
    word_pool: WordPool,
    mot_cible: str,
    tirage: List[str],
    profondeur: int = 8
) -> Tuple[Board, List[str]]:
    """
    Simule une partie de Scrabble "normale" pour créer le contexte.
    
    Contrainte: La lettre d'appui doit rester accessible ET le mot cible
    doit rester jouable après chaque placement.
    """
    # Distribution naturelle des coups
    distribution = [
        ('court', 0.50),   # 50% de mots courts (2-4 lettres)
        ('moyen', 0.35),   # 35% de mots moyens (5-6 lettres)
        ('long', 0.15)     # 15% de mots longs (7-8 lettres)
    ]
    
    mots_places = []
    validator = WordValidator(grille, gaddag)
    score_calc = ScoreCalculator(grille)
    
    for coup in range(profondeur):
        # Choisir la catégorie de mot selon la distribution
        categorie = _choisir_categorie(distribution)
        
        if categorie == 'court':
            candidats = word_pool.get_mots_courts(100)
        elif categorie == 'moyen':
            candidats = word_pool.get_mots_moyens(80)
        else:
            candidats = word_pool.get_mots_longs(50)
        
        if not candidats:
            continue
        
        # Recréer le validateur avec la grille actuelle
        validator = WordValidator(grille, gaddag)
        
        # Trouver un placement valide
        placement = _trouver_placement_naturel(
            grille, gaddag, validator, candidats, anchor
        )
        
        if placement:
            # Sauvegarder l'état avant
            grille_backup = copy.deepcopy(grille)
            
            # Appliquer le placement
            _appliquer_placement(grille, placement)
            
            # Vérifier que l'ancre est toujours accessible physiquement
            if not _ancre_toujours_accessible(grille, anchor, len(mot_cible)):
                # Annuler le placement
                grille.grid = grille_backup.grid
                continue
            
            # NOUVEAU: Vérifier que le mot cible peut TOUJOURS être joué
            validator_new = WordValidator(grille, gaddag)
            placements_cible = _generer_placements_pour_mot_cible(
                grille, mot_cible, (anchor.row, anchor.col), tirage,
                gaddag, validator_new, score_calc
            )
            
            if not placements_cible:
                # Le placement bloque le mot cible! Annuler
                grille.grid = grille_backup.grid
                continue
            
            mots_places.append(placement.mot)
    
    return grille, mots_places


def _choisir_categorie(distribution: List[Tuple[str, float]]) -> str:
    """Choisit une catégorie selon la distribution de probabilités."""
    r = random.random()
    cumul = 0.0
    
    for categorie, proba in distribution:
        cumul += proba
        if r <= cumul:
            return categorie
    
    return distribution[-1][0]


def _trouver_placement_naturel(
    grille: Board,
    gaddag: GADDAG,
    validator: WordValidator,
    candidats: List[str],
    anchor: AnchorPoint
) -> Optional[Placement]:
    """
    Trouve un placement qui ressemble à un coup de vraie partie.
    
    UTILISE WordValidator.validate_placement_complete() pour la validation.
    """
    placements_valides = []
    
    # Échantillonner les candidats
    sample_size = min(50, len(candidats))
    sampled = random.sample(candidats, sample_size) if len(candidats) > sample_size else candidats
    
    for mot in sampled:
        # Générer les placements possibles pour ce mot
        placements = _generer_placements_pour_mot(mot, grille, gaddag, validator)
        
        for placement in placements:
            # Filtrer: ne pas bloquer l'ancre
            if _bloque_ancre(placement, anchor, grille):
                continue
            
            # Calculer le score de naturalité
            score = _score_naturalite_placement(placement, grille)
            placements_valides.append((placement, score))
    
    if not placements_valides:
        return None
    
    # Sélection pondérée (pas toujours le meilleur, pour la variété)
    placements_valides.sort(key=lambda x: x[1], reverse=True)
    top_k = placements_valides[:5]
    
    return random.choice(top_k)[0]


def _generer_placements_pour_mot(
    mot: str,
    grille: Board,
    gaddag: GADDAG,
    validator: WordValidator
) -> List[Placement]:
    """
    Génère tous les placements VALIDES pour un mot sur la grille.
    
    UTILISE WordValidator.validate_placement_complete() pour garantir
    que TOUS les mots formés (principaux et croisés) sont valides.
    """
    placements = []
    
    # Récupérer les cases occupées
    cases_occupees = _get_occupied_cells(grille)
    
    if not cases_occupees:
        # Grille vide - placer au centre
        center = grille.size // 2
        
        # Horizontal
        start_col = center - len(mot) // 2
        if 0 <= start_col and start_col + len(mot) <= grille.size:
            valid, _, _ = validator.validate_placement_complete(
                mot, center, start_col, Direction.HORIZONTAL, check_connection=False
            )
            if valid:
                placements.append(Placement(
                    mot=mot,
                    position=(center, start_col),
                    direction='H'
                ))
        
        # Vertical
        start_row = center - len(mot) // 2
        if 0 <= start_row and start_row + len(mot) <= grille.size:
            valid, _, _ = validator.validate_placement_complete(
                mot, start_row, center, Direction.VERTICAL, check_connection=False
            )
            if valid:
                placements.append(Placement(
                    mot=mot,
                    position=(start_row, center),
                    direction='V'
                ))
        
        return placements
    
    # Pour chaque case occupée, chercher des intersections
    for anchor_row, anchor_col in cases_occupees:
        lettre_ancre = grille.get_letter(anchor_row, anchor_col)
        
        # Pour chaque lettre du mot qui correspond
        for i, lettre_mot in enumerate(mot):
            if lettre_mot == lettre_ancre:
                # Placement horizontal (intersection)
                start_col = anchor_col - i
                if 0 <= start_col and start_col + len(mot) <= grille.size:
                    valid, mots_formes, msg = validator.validate_placement_complete(
                        mot, anchor_row, start_col, Direction.HORIZONTAL
                    )
                    if valid:
                        placements.append(Placement(
                            mot=mot,
                            position=(anchor_row, start_col),
                            direction='H'
                        ))
                
                # Placement vertical (intersection)
                start_row = anchor_row - i
                if 0 <= start_row and start_row + len(mot) <= grille.size:
                    valid, mots_formes, msg = validator.validate_placement_complete(
                        mot, start_row, anchor_col, Direction.VERTICAL
                    )
                    if valid:
                        placements.append(Placement(
                            mot=mot,
                            position=(start_row, anchor_col),
                            direction='V'
                        ))
    
    return placements


def _get_occupied_cells(grille: Board) -> List[Tuple[int, int]]:
    """Retourne toutes les cases occupées sur la grille."""
    occupied = []
    for row in range(grille.size):
        for col in range(grille.size):
            if grille.get_letter(row, col):
                occupied.append((row, col))
    return occupied


def _bloque_ancre(
    placement: Placement,
    anchor: AnchorPoint,
    grille: Board
) -> bool:
    """Vérifie si un placement bloquerait l'accès à l'ancre."""
    mot = placement.mot
    row, col = placement.position
    direction = placement.direction
    
    for i in range(len(mot)):
        if direction == 'H':
            pos_row, pos_col = row, col + i
        else:
            pos_row, pos_col = row + i, col
        
        # Si le placement est sur l'ancre avec une lettre différente
        if pos_row == anchor.row and pos_col == anchor.col:
            if mot[i] != anchor.letter:
                return True
    
    return False


def _score_naturalite_placement(placement: Placement, grille: Board) -> float:
    """Évalue à quel point un placement ressemble à un coup de vraie partie."""
    score = 0.0
    row, col = placement.position
    direction = placement.direction
    mot_len = len(placement.mot)
    
    dir_enum = Direction.HORIZONTAL if direction == 'H' else Direction.VERTICAL
    
    # 1. Utilisation des multiplicateurs
    for i in range(mot_len):
        if dir_enum == Direction.HORIZONTAL:
            r, c = row, col + i
        else:
            r, c = row + i, col
        
        if not grille.get_letter(r, c):  # Nouvelle lettre
            letter_mult, word_mult = grille.get_multiplier(r, c)
            if word_mult > 1:
                score += 20
            if letter_mult > 1:
                score += 10
    
    # 2. Favorise les mots plus courts (plus naturel)
    if mot_len <= 4:
        score += 15
    elif mot_len <= 6:
        score += 10
    
    # 3. Pénalité pour centre saturé
    center = grille.size // 2
    dist_center = abs(row - center) + abs(col - center)
    if dist_center < 3:
        score -= 5
    
    return score


def _appliquer_placement(grille: Board, placement: Placement) -> None:
    """Applique un placement sur la grille."""
    mot = placement.mot
    row, col = placement.position
    direction = placement.direction
    
    for i, lettre in enumerate(mot):
        if direction == 'H':
            r, c = row, col + i
        else:
            r, c = row + i, col
        
        if not grille.get_letter(r, c):
            grille.place_letter(r, c, lettre)


def _ancre_toujours_accessible(
    grille: Board,
    anchor: AnchorPoint,
    mot_len: int
) -> bool:
    """Vérifie que l'ancre est toujours accessible pour placer le mot cible."""
    row, col = anchor.row, anchor.col
    
    # Vérifier espace horizontal
    espace_h = 0
    c = col
    while c >= 0 and (grille.get_letter(row, c) is None or c == col):
        espace_h += 1
        c -= 1
    c = col + 1
    while c < grille.size and (grille.get_letter(row, c) is None):
        espace_h += 1
        c += 1
    
    # Vérifier espace vertical
    espace_v = 0
    r = row
    while r >= 0 and (grille.get_letter(r, col) is None or r == row):
        espace_v += 1
        r -= 1
    r = row + 1
    while r < grille.size and (grille.get_letter(r, col) is None):
        espace_v += 1
        r += 1
    
    return espace_h >= mot_len or espace_v >= mot_len


# ============================================================================
# PHASE 3: STAGE (Mise en Scène)
# ============================================================================

def phase_stage(
    grille: Board,
    mot_cible: str,
    lettre_appui: str,
    tirage: List[str],
    gaddag: GADDAG
) -> Tuple[Board, bool, Optional[Solution], str]:
    """
    Vérifie et ajuste la grille pour que le mot cible soit jouable.
    """
    validator = WordValidator(grille, gaddag)
    score_calc = ScoreCalculator(grille)
    
    # 1. Trouver les positions de la lettre d'appui
    positions_appui = _trouver_lettre_sur_grille(grille, lettre_appui)
    
    if not positions_appui:
        return grille, False, None, "Lettre d'appui non trouvée"
    
    # 2. Pour chaque position, vérifier si le mot cible peut être joué
    for pos in positions_appui:
        placements_possibles = _generer_placements_pour_mot_cible(
            grille, mot_cible, pos, tirage, gaddag, validator, score_calc
        )
        
        if placements_possibles:
            # Choisir le meilleur placement
            meilleur = max(placements_possibles, key=lambda p: p.score_scrabble)
            
            solution = Solution(
                mot=mot_cible,
                placement=meilleur,
                tirage=tirage,
                score=meilleur.score_scrabble
            )
            
            return grille, True, solution, f"Solution: {mot_cible} en {meilleur.position}"
    
    # 3. Échec
    return grille, False, None, "Impossible de rendre le mot cible jouable"


def _trouver_lettre_sur_grille(
    grille: Board,
    lettre: str
) -> List[Tuple[int, int]]:
    """Trouve toutes les positions d'une lettre sur la grille."""
    positions = []
    for row in range(grille.size):
        for col in range(grille.size):
            if grille.get_letter(row, col) == lettre:
                positions.append((row, col))
    return positions


def _generer_placements_pour_mot_cible(
    grille: Board,
    mot_cible: str,
    pos_appui: Tuple[int, int],
    tirage: List[str],
    gaddag: GADDAG,
    validator: WordValidator,
    score_calc: ScoreCalculator
) -> List[Placement]:
    """
    Génère les placements possibles pour le mot cible utilisant l'appui.
    
    UTILISE WordValidator et ScoreCalculator des services existants.
    """
    placements = []
    row, col = pos_appui
    lettre_appui = grille.get_letter(row, col)
    
    # Trouver où est la lettre d'appui dans le mot cible
    for i, lettre in enumerate(mot_cible):
        if lettre == lettre_appui:
            # Placement horizontal
            start_col = col - i
            if 0 <= start_col and start_col + len(mot_cible) <= grille.size:
                if _peut_jouer_avec_tirage(
                    mot_cible, row, start_col, Direction.HORIZONTAL,
                    grille, tirage, validator
                ):
                    placement = Placement(
                        mot=mot_cible,
                        position=(row, start_col),
                        direction='H'
                    )
                    placement.score_scrabble = _calculer_score(
                        placement, grille, score_calc
                    )
                    placements.append(placement)
            
            # Placement vertical
            start_row = row - i
            if 0 <= start_row and start_row + len(mot_cible) <= grille.size:
                if _peut_jouer_avec_tirage(
                    mot_cible, start_row, col, Direction.VERTICAL,
                    grille, tirage, validator
                ):
                    placement = Placement(
                        mot=mot_cible,
                        position=(start_row, col),
                        direction='V'
                    )
                    placement.score_scrabble = _calculer_score(
                        placement, grille, score_calc
                    )
                    placements.append(placement)
    
    return placements


def _peut_jouer_avec_tirage(
    mot: str,
    row: int,
    col: int,
    direction: Direction,
    grille: Board,
    tirage: List[str],
    validator: WordValidator
) -> bool:
    """
    Vérifie si le placement est possible avec le tirage donné.
    
    UTILISE WordValidator.validate_placement_complete() pour la validation.
    """
    # 1. Validation du placement
    valid, mots_formes, msg = validator.validate_placement_complete(
        mot, row, col, direction
    )
    
    if not valid:
        return False
    
    # 2. Vérifier que le tirage contient les lettres nécessaires
    lettres_necessaires = []
    
    for i, lettre in enumerate(mot):
        if direction == Direction.HORIZONTAL:
            r, c = row, col + i
        else:
            r, c = row + i, col
        
        existing = grille.get_letter(r, c)
        if not existing:
            lettres_necessaires.append(lettre)
    
    # Vérifier que le tirage contient les lettres nécessaires
    tirage_copy = list(tirage)
    for lettre in lettres_necessaires:
        if lettre in tirage_copy:
            tirage_copy.remove(lettre)
        elif '*' in tirage_copy:  # Joker
            tirage_copy.remove('*')
        else:
            return False
    
    return True


def _calculer_score(
    placement: Placement,
    grille: Board,
    score_calc: ScoreCalculator
) -> int:
    """Calcule le score d'un placement en utilisant ScoreCalculator."""
    from ..models.types import Move
    
    dir_enum = Direction.HORIZONTAL if placement.direction == 'H' else Direction.VERTICAL
    
    move = Move(
        word=placement.mot,
        row=placement.position[0],
        col=placement.position[1],
        direction=dir_enum
    )
    
    return score_calc.simulate_move_score(move)


# ============================================================================
# PIPELINE PRINCIPAL
# ============================================================================

def generer_situation_naturelle(
    mot_cible: str,
    lettre_appui: str,
    tirage: List[str],
    gaddag: GADDAG,
    word_pool: Optional[WordPool] = None,
    config: Optional[NaturalFlowConfig] = None
) -> Optional[SituationEntrainement]:
    """
    Génère UNE situation d'entraînement naturelle pour UN mot cible.
    
    Philosophie:
    - Une grille = Un objectif pédagogique
    - Qualité > Quantité
    - Naturel > Dense
    """
    config = config or NaturalFlowConfig()
    
    logger.info("Natural Flow: Génération pour '%s' (appui=%s, tirage=%s)",
                mot_cible, lettre_appui, ''.join(tirage))
    
    # Utiliser le word pool fourni ou erreur
    if word_pool is None:
        logger.warning("WordPool non fourni!")
        return None
    
    for retry in range(config.max_retries):
        logger.debug("Tentative %d/%d", retry + 1, config.max_retries)
        
        # Phase 1: Anchor
        grille = Board()
        anchor = phase_anchor(mot_cible, lettre_appui, grille)
        logger.debug("Phase Anchor: Position (%d, %d)", anchor.row, anchor.col)
        
        # Placer un mot initial contenant l'ancre
        mot_initial = _trouver_mot_initial_avec_ancre(lettre_appui, gaddag, word_pool)
        if mot_initial:
            _placer_mot_initial(grille, mot_initial, anchor, gaddag)
            logger.debug("Mot initial: %s", mot_initial)
        else:
            # Fallback: placer juste la lettre d'appui
            grille.place_letter(anchor.row, anchor.col, anchor.letter)
            logger.debug("Mot initial: (lettre seule %s)", anchor.letter)
        
        # Phase 2: Breathe (passer mot_cible et tirage pour vérifier jouabilité)
        grille, mots_places = phase_breathe(
            grille, anchor, gaddag, word_pool,
            mot_cible=mot_cible, tirage=tirage,
            profondeur=config.profondeur_respiration
        )
        logger.debug("Phase Breathe: %d mots ajoutés", len(mots_places))
        
        # Vérifier l'intégrité de la grille
        validator = WordValidator(grille, gaddag)
        all_valid, invalid_words = validator.validate_board_integrity()
        if not all_valid:
            logger.debug("Mots invalides sur la grille: %s", invalid_words)
            continue  # Retry
        
        # Phase 3: Stage
        grille, succes, solution, message = phase_stage(
            grille, mot_cible, lettre_appui, tirage, gaddag
        )
        logger.debug("Phase Stage: %s", message)
        
        if succes:
            # Calculer le score de naturalité
            score_nat = _evaluer_naturalite(grille, mot_cible, mots_places)
            
            if score_nat.score_global() >= config.seuil_naturalite:
                logger.info("Succès! Score naturalité: %.1f", score_nat.score_global())
                
                return SituationEntrainement(
                    grille=grille,
                    mot_cible=mot_cible,
                    tirage=tirage,
                    solution=solution,
                    score_naturalite=score_nat,
                    mots_places=mots_places + ([mot_initial] if mot_initial else [])
                )
            else:
                logger.debug("Score naturalité insuffisant: %.1f", score_nat.score_global())
    
    logger.warning("Échec après %d tentatives pour '%s'", config.max_retries, mot_cible)
    return None


def _trouver_mot_initial_avec_ancre(
    lettre_appui: str,
    gaddag: GADDAG,
    word_pool: WordPool
) -> Optional[str]:
    """Trouve un mot court contenant la lettre d'appui pour le mot initial."""
    mots = word_pool.get_mots_contenant_lettre(lettre_appui, 3, 5)
    if mots:
        return random.choice(mots[:20])
    return None


def _placer_mot_initial(
    grille: Board,
    mot: str,
    anchor: AnchorPoint,
    gaddag: GADDAG
) -> None:
    """Place le mot initial sur la grille en passant par l'ancre ET le centre (7,7).

    Règle du Scrabble : le premier mot doit traverser la case centrale.
    """
    center = grille.size // 2  # 7

    # Trouver toutes les positions de la lettre d'appui dans le mot
    anchor_positions = [i for i, l in enumerate(mot) if l == anchor.letter]

    if not anchor_positions:
        # Fallback: placer la lettre seule au centre
        grille.place_letter(center, center, anchor.letter)
        anchor.row = center
        anchor.col = center
        return

    # Essayer les deux directions en ordre aléatoire
    directions = ['H', 'V'] if random.random() < 0.5 else ['V', 'H']

    for direction in directions:
        for i in anchor_positions:
            if direction == 'H':
                # Le mot est sur la rangée du centre (center)
                # On veut que row == center ET que le mot couvre col == center
                start_col = anchor.col - i
                # Vérifier que le mot couvre la case centrale (center, center)
                if not (start_col <= center < start_col + len(mot)):
                    # Ajuster pour couvrir le centre
                    start_col = center - random.randint(0, len(mot) - 1)

                row = center
                if start_col >= 0 and start_col + len(mot) <= grille.size:
                    for j, l in enumerate(mot):
                        grille.place_letter(row, start_col + j, l)
                    # Mettre à jour l'ancre pour refléter la vraie position
                    anchor.row = row
                    anchor.col = start_col + i
                    return
            else:
                # Vertical: colonne du centre
                start_row = anchor.row - i
                # Vérifier que le mot couvre la case centrale
                if not (start_row <= center < start_row + len(mot)):
                    start_row = center - random.randint(0, len(mot) - 1)

                col = center
                if start_row >= 0 and start_row + len(mot) <= grille.size:
                    for j, l in enumerate(mot):
                        grille.place_letter(start_row + j, col, l)
                    anchor.row = start_row + i
                    anchor.col = col
                    return

    # Fallback ultime: placer le mot centré horizontalement sur (7,7)
    start_col = center - len(mot) // 2
    if start_col >= 0 and start_col + len(mot) <= grille.size:
        for j, l in enumerate(mot):
            grille.place_letter(center, start_col + j, l)
        # Trouver la position de l'ancre dans le mot
        if anchor_positions:
            anchor.row = center
            anchor.col = start_col + anchor_positions[0]
    else:
        grille.place_letter(center, center, anchor.letter)
        anchor.row = center
        anchor.col = center


def _evaluer_naturalite(
    grille: Board,
    mot_cible: str,
    mots_places: List[str]
) -> NaturalityScore:
    """Évalue le score de naturalité d'une grille."""
    total_mots = len(mots_places)
    if total_mots == 0:
        return NaturalityScore(accessibilite_cible=1.0)
    
    mots_courts = sum(1 for m in mots_places if len(m) <= 4)
    mots_moyens = sum(1 for m in mots_places if 5 <= len(m) <= 6)
    mots_longs = sum(1 for m in mots_places if len(m) >= 7)
    
    # Densité
    cases_occupees = len(_get_occupied_cells(grille))
    densite = cases_occupees / (grille.size * grille.size)
    
    # Expansion
    expansion = _calculer_expansion(grille)
    
    return NaturalityScore(
        ratio_mots_courts=mots_courts / total_mots if total_mots else 0,
        ratio_mots_moyens=mots_moyens / total_mots if total_mots else 0,
        ratio_mots_longs=mots_longs / total_mots if total_mots else 0,
        densite_moyenne=densite,
        variance_densite=0.5,
        expansion_score=expansion,
        ratio_croix_vs_collantes=0.5,
        accessibilite_cible=1.0,
        lisibilite=1.0 - densite
    )


def _calculer_expansion(grille: Board) -> float:
    """Calcule le score d'expansion vers les bords."""
    cases = _get_occupied_cells(grille)
    if not cases:
        return 0.0
    
    min_row = min(c[0] for c in cases)
    max_row = max(c[0] for c in cases)
    min_col = min(c[1] for c in cases)
    max_col = max(c[1] for c in cases)
    
    spread = (max_row - min_row + max_col - min_col) / (grille.size * 2)
    return min(1.0, spread)


def generer_situations_pour_liste(
    mots_a_reviser: List[Tuple[str, str]],  # [(mot, appui), ...]
    gaddag: GADDAG,
    tirages: Optional[Dict[str, List[str]]] = None,
    word_pool: Optional[WordPool] = None,
    config: Optional[NaturalFlowConfig] = None
) -> List[SituationEntrainement]:
    """
    Génère des situations pour une liste de mots.
    
    IMPORTANT: Chaque mot a SA propre grille.
    """
    config = config or NaturalFlowConfig()
    situations = []
    
    logger.info("NATURAL FLOW: Génération de %d situations", len(mots_a_reviser))
    
    for mot, appui in mots_a_reviser:
        # Générer le tirage si non fourni
        if tirages and mot in tirages:
            tirage = tirages[mot]
        else:
            tirage = _generer_tirage_pour_mot(mot, appui)
        
        situation = generer_situation_naturelle(
            mot_cible=mot,
            lettre_appui=appui,
            tirage=tirage,
            gaddag=gaddag,
            word_pool=word_pool,
            config=config
        )
        
        if situation:
            situations.append(situation)
        else:
            logger.warning("Impossible de générer une situation pour %s", mot)
    
    logger.info("RÉSULTAT: %d/%d situations générées", len(situations), len(mots_a_reviser))
    
    return situations


def _generer_tirage_pour_mot(mot: str, lettre_appui: str) -> List[str]:
    """
    Génère un tirage valide pour jouer le mot.
    Le tirage contient les lettres du mot SAUF la lettre d'appui.
    """
    tirage = list(mot)
    # Retirer UNE occurrence de la lettre d'appui
    if lettre_appui in tirage:
        tirage.remove(lettre_appui)
    return tirage
