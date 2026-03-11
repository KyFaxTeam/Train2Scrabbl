"""
Module CBIC (Construction Incrémentale par Contraintes)

Algorithme de génération de grilles Scrabble qui garantit la connexité par construction.
Remplace l'ancien workflow en 3 phases (initialization → connection → optimization).

Principe: Ne placer QUE ce qui connecte.
"""

from dataclasses import dataclass
from typing import List, Dict, Set, Tuple, Optional
import logging
from ..models.board import Board
from ..models.gaddag import GADDAG
from ..models.graph import ScrabbleGraph
from ..models.types import Direction
from ..services.score_calculator import ScoreCalculator

logger = logging.getLogger(__name__)


# Configuration des poids pour la fonction de score unifiée
POIDS_SCORE_BASE = 1.0
POIDS_MOTS_CROISES = 1.5
BONUS_LETTRE_APPUI = 50.0
POIDS_DENSITE = 20.0
POIDS_CENTRALITE = 0.1
POIDS_CONNEXIONS = 30.0

# Configuration CBIC
MAX_ITERATIONS = 1000  # Limite de sécurité pour la boucle while


@dataclass
class Placement:
    """Représente un placement de mot sur la grille avec connexité garantie."""
    mot: str
    position: Tuple[int, int]  # (row, col) starting position
    direction: Direction
    lettres_utilisees: List[str]  # Letters used from rack
    intersection_point: Tuple[int, int]  # Where it connects to existing word
    intersection_letter: str  # Common letter at intersection
    score: float = 0.0  # Cached unified score


def get_occupied_cells(grille: Board) -> List[Tuple[int, int]]:
    """
    Retourne toutes les cases occupées (ancres) sur la grille.
    Ces cases servent de points de connexion pour les nouveaux mots.
    """
    occupied = []
    for row in range(grille.size):
        for col in range(grille.size):
            if grille.get_letter(row, col):
                occupied.append((row, col))
    return occupied


def generer_placements_connexes(
    mot_candidat: str,
    grille: Board,
    gaddag: GADDAG,
    lettres_appui: Dict[str, Dict[str, int]]
) -> List[Placement]:
    """
    CŒUR de l'algorithme CBIC.
    
    Génère tous les placements connexes possibles pour mot_candidat à partir
    des ancres (cellules occupées) de la grille.
    
    Utilise le GADDAG de manière PROACTIVE pour générer des placements valides,
    garantissant la connexité par construction.
    
    Args:
        mot_candidat: Le mot à placer
        grille: La grille actuelle
        gaddag: Structure GADDAG pour validation
        lettres_appui: Dictionnaire des lettres d'appui {mot: {lettre: position}}
    
    Returns:
        Liste de tous les placements valides et connexes
    """
    placements_valides = []
    
    # Get all anchor cells (occupied positions)
    cases_occupees = get_occupied_cells(grille)
    
    if not cases_occupees:
        # Grille vide - impossible (le mot central doit déjà être placé)
        return []
    
    # Pour chaque case occupée (ancre potentielle)
    for anchor_row, anchor_col in cases_occupees:
        lettre_ancre = grille.get_letter(anchor_row, anchor_col)
        
        # Pour chaque lettre du mot_candidat, chercher intersection possible
        for i, lettre_mot in enumerate(mot_candidat):
            if lettre_mot == lettre_ancre:
                # Intersection potentielle trouvée!
                
                # Essayer placement horizontal
                start_col = anchor_col - i
                if 0 <= start_col and start_col + len(mot_candidat) <= grille.size:
                    placement = Placement(
                        mot=mot_candidat,
                        position=(anchor_row, start_col),
                        direction=Direction.HORIZONTAL,
                        lettres_utilisees=[],  # À déterminer plus tard si nécessaire
                        intersection_point=(anchor_row, anchor_col),
                        intersection_letter=lettre_ancre
                    )
                    if est_placement_valide(placement, grille, gaddag):
                        placements_valides.append(placement)
                
                # Essayer placement vertical
                start_row = anchor_row - i
                if 0 <= start_row and start_row + len(mot_candidat) <= grille.size:
                    placement = Placement(
                        mot=mot_candidat,
                        position=(start_row, anchor_col),
                        direction=Direction.VERTICAL,
                        lettres_utilisees=[],
                        intersection_point=(anchor_row, anchor_col),
                        intersection_letter=lettre_ancre
                    )
                    if est_placement_valide(placement, grille, gaddag):
                        placements_valides.append(placement)
    
    return placements_valides


def est_placement_valide(placement: Placement, grille: Board, gaddag: GADDAG) -> bool:
    """
    Valide qu'un placement respecte toutes les contraintes:
    1. Limites de la grille
    2. Pas de chevauchement (sauf au point d'intersection)
    3. Tous les mots croisés formés sont valides
    
    Args:
        placement: Le placement à valider
        grille: La grille actuelle
        gaddag: Structure GADDAG pour validation des mots
    
    Returns:
        True si le placement est valide, False sinon
    """
    mot = placement.mot
    row, col = placement.position
    direction = placement.direction
    
    # Vérifier limites de la grille
    if direction == Direction.HORIZONTAL:
        if col + len(mot) > grille.size:
            return False
    else:  # VERTICAL
        if row + len(mot) > grille.size:
            return False
    
    # Vérifier chaque position de lettre
    for i, lettre in enumerate(mot):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        existing_letter = grille.get_letter(current_row, current_col)
        
        # Si case occupée, doit correspondre (point d'intersection)
        if existing_letter and existing_letter != lettre:
            return False
        
        # Vérifier les mots croisés formés perpendiculairement
        if not existing_letter:  # Nouvelle lettre placée
            cross_word = get_cross_word(grille, current_row, current_col, direction, lettre)
            if cross_word and len(cross_word) > 1:
                # Un mot croisé est formé, il doit être valide
                if not gaddag.contains(cross_word):
                    return False
    
    return True


def get_cross_word(
    grille: Board,
    row: int,
    col: int,
    main_direction: Direction,
    new_letter: str
) -> Optional[str]:
    """
    Extrait le mot croisé formé perpendiculairement au placement principal.
    
    Args:
        grille: La grille actuelle
        row, col: Position de la nouvelle lettre
        main_direction: Direction du mot principal
        new_letter: La lettre à placer
    
    Returns:
        Le mot croisé formé, ou None si aucun
    """
    # Direction perpendiculaire
    cross_direction = Direction.VERTICAL if main_direction == Direction.HORIZONTAL else Direction.HORIZONTAL
    
    # Trouver le début du mot croisé
    if cross_direction == Direction.VERTICAL:
        start_row = row
        # Remonter jusqu'au début du mot
        while start_row > 0 and grille.get_letter(start_row - 1, col):
            start_row -= 1
        
        # Construire le mot
        word = ""
        current_row = start_row
        while current_row < grille.size:
            if current_row == row:
                word += new_letter
            else:
                letter = grille.get_letter(current_row, col)
                if not letter:
                    break
                word += letter
            current_row += 1
        
        return word if len(word) > 1 else None
    
    else:  # HORIZONTAL
        start_col = col
        # Reculer jusqu'au début du mot
        while start_col > 0 and grille.get_letter(row, start_col - 1):
            start_col -= 1
        
        # Construire le mot
        word = ""
        current_col = start_col
        while current_col < grille.size:
            if current_col == col:
                word += new_letter
            else:
                letter = grille.get_letter(row, current_col)
                if not letter:
                    break
                word += letter
            current_col += 1
        
        return word if len(word) > 1 else None


def score_unifie(
    placement: Placement,
    grille: Board,
    lettres_appui: Dict[str, Dict[str, int]]
) -> float:
    """
    Fonction de score unifiée qui évalue la qualité d'un placement.
    
    Remplace les heuristiques fragmentées par une évaluation cohérente basée sur:
    - Score Scrabble de base
    - Mots croisés formés
    - Utilisation des lettres d'appui
    - Densité locale
    - Centralité
    - Nombre de connexions
    
    Args:
        placement: Le placement à évaluer
        grille: La grille actuelle
        lettres_appui: Dictionnaire des lettres d'appui
    
    Returns:
        Score float (plus haut = meilleur)
    """
    score = 0.0
    
    # 1. Score Scrabble de base simplifié (sans simulation complète)
    # Calculer le score des lettres directement
    mot = placement.mot
    row, col = placement.position
    direction = placement.direction
    
    base_score = 0
    for i, letter in enumerate(mot):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        # Si la lettre n'est pas déjà sur la grille
        if not grille.get_letter(current_row, current_col):
            letter_value = ScoreCalculator.LETTER_VALUES.get(letter, 0)
            # Appliquer les multiplicateurs si disponibles
            letter_mult, word_mult = grille.get_multiplier(current_row, current_col)
            base_score += letter_value * letter_mult
    
    score += base_score * POIDS_SCORE_BASE
    
    # 2. Bonus pour les mots croisés formés
    cross_words = find_cross_words(placement, grille)
    for cross_word in cross_words:
        # Estimer le score des mots croisés (simplifié)
        cross_score = sum(ScoreCalculator.LETTER_VALUES.get(letter, 0) for letter in cross_word)
        score += cross_score * POIDS_MOTS_CROISES
    
    # 3. Bonus pour l'utilisation des lettres d'appui
    if placement.mot in lettres_appui:
        appui_dict = lettres_appui[placement.mot]
        if placement.intersection_letter in appui_dict.values():
            score += BONUS_LETTRE_APPUI
    
    # 4. Bonus de densité (favorise les placements créant des zones denses)
    densite = evaluer_densite_locale(placement, grille)
    score += densite * POIDS_DENSITE
    
    # 5. Bonus de centralité (légère préférence pour le centre)
    dist_centre = distance_au_centre(placement, grille)
    score -= dist_centre * POIDS_CENTRALITE
    
    # 6. Bonus de connexions multiples (favorise les placements se connectant à plusieurs mots)
    nb_connexions = count_connections(placement, grille)
    score += nb_connexions * POIDS_CONNEXIONS
    
    return score


def find_cross_words(placement: Placement, grille: Board) -> List[str]:
    """
    Trouve tous les mots croisés qui seraient formés par un placement.
    """
    cross_words = []
    mot = placement.mot
    row, col = placement.position
    direction = placement.direction
    
    for i, lettre in enumerate(mot):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        # Si la case n'est pas déjà occupée, chercher un mot croisé
        if not grille.get_letter(current_row, current_col):
            cross_word = get_cross_word(grille, current_row, current_col, direction, lettre)
            if cross_word and len(cross_word) > 1:
                cross_words.append(cross_word)
    
    return cross_words


def evaluer_densite_locale(placement: Placement, grille: Board) -> float:
    """
    Évalue la densité de lettres autour d'un placement.
    Favorise les placements créant des zones intéressantes.
    """
    row, col = placement.position
    direction = placement.direction
    mot_length = len(placement.mot)
    
    # Zone d'évaluation: autour du mot
    occupied_count = 0
    total_cells = 0
    
    # Parcourir la zone autour du mot
    for i in range(mot_length):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        # Vérifier cellules adjacentes
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                check_row = current_row + dr
                check_col = current_col + dc
                
                if 0 <= check_row < grille.size and 0 <= check_col < grille.size:
                    total_cells += 1
                    if grille.get_letter(check_row, check_col):
                        occupied_count += 1
    
    return occupied_count / max(total_cells, 1)


def distance_au_centre(placement: Placement, grille: Board) -> float:
    """
    Calcule la distance du placement au centre de la grille.
    """
    row, col = placement.position
    center = grille.size // 2
    
    # Distance Manhattan au centre
    return abs(row - center) + abs(col - center)


def count_connections(placement: Placement, grille: Board) -> int:
    """
    Compte le nombre de connexions (intersections) que ce placement créerait.
    """
    connections = 0
    mot = placement.mot
    row, col = placement.position
    direction = placement.direction
    
    for i, lettre in enumerate(mot):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        # Vérifier si cette position crée une intersection
        existing = grille.get_letter(current_row, current_col)
        if existing and existing == lettre:
            connections += 1
        
        # Vérifier adjacences perpendiculaires
        if direction == Direction.HORIZONTAL:
            if (current_row > 0 and grille.get_letter(current_row - 1, current_col)) or \
               (current_row < grille.size - 1 and grille.get_letter(current_row + 1, current_col)):
                connections += 1
        else:  # VERTICAL
            if (current_col > 0 and grille.get_letter(current_row, current_col - 1)) or \
               (current_col < grille.size - 1 and grille.get_letter(current_row, current_col + 1)):
                connections += 1
    
    return connections


def placer_mot(grille: Board, mot: str, placement: Placement, graphe: ScrabbleGraph) -> None:
    """
    Place un mot sur la grille et met à jour le graphe de connexité.
    
    Args:
        grille: La grille de jeu
        mot: Le mot à placer
        placement: Le placement validé
        graphe: Le graphe de connexité à mettre à jour
    """
    row, col = placement.position
    direction = placement.direction
    
    # Placer chaque lettre
    for i, lettre in enumerate(mot):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        # Ne placer que si la case est vide
        if not grille.get_letter(current_row, current_col):
            grille.place_letter(current_row, current_col, lettre)
    
    # Ajouter le mot au graphe
    graphe.add_word(mot, placement.position, direction)
    
    # Trouver et ajouter les connexions avec les mots existants
    # En parcourant la grille pour trouver les intersections
    for i, lettre in enumerate(mot):
        current_row = row + (i if direction == Direction.VERTICAL else 0)
        current_col = col + (i if direction == Direction.HORIZONTAL else 0)
        
        # Chercher les mots qui se croisent à cette position
        for autre_mot in list(graphe.nodes.keys()):
            if autre_mot == mot:
                continue
            
            autre_node = graphe.nodes[autre_mot]
            autre_row, autre_col = autre_node.position
            autre_direction = autre_node.direction
            
            # Vérifier si l'autre mot passe par cette position
            if autre_direction == Direction.HORIZONTAL:
                if (autre_row == current_row and 
                    autre_col <= current_col < autre_col + len(autre_mot)):
                    # Intersection trouvée!
                    from ..models.graph import Connection
                    connection = Connection(
                        mot1=mot,
                        mot2=autre_mot,
                        position=(current_row, current_col),
                        lettre=lettre,
                        est_appui=False,  # À déterminer selon les lettres d'appui
                        distance=1
                    )
                    # Ajouter la connexion dans les deux sens
                    if mot in graphe.nodes and autre_mot in graphe.nodes:
                        graphe.nodes[mot].connections.append(connection)
                        graphe.nodes[mot].degree += 1
                        # Connexion inverse
                        connection_inverse = Connection(
                            mot1=autre_mot,
                            mot2=mot,
                            position=(current_row, current_col),
                            lettre=lettre,
                            est_appui=False,
                            distance=1
                        )
                        graphe.nodes[autre_mot].connections.append(connection_inverse)
                        graphe.nodes[autre_mot].degree += 1
                        # Unir dans UnionFind
                        graphe.union_find.union(mot, autre_mot)
            
            elif autre_direction == Direction.VERTICAL:
                if (autre_col == current_col and 
                    autre_row <= current_row < autre_row + len(autre_mot)):
                    # Intersection trouvée!
                    from ..models.graph import Connection
                    connection = Connection(
                        mot1=mot,
                        mot2=autre_mot,
                        position=(current_row, current_col),
                        lettre=lettre,
                        est_appui=False,
                        distance=1
                    )
                    # Ajouter la connexion dans les deux sens
                    if mot in graphe.nodes and autre_mot in graphe.nodes:
                        graphe.nodes[mot].connections.append(connection)
                        graphe.nodes[mot].degree += 1
                        # Connexion inverse
                        connection_inverse = Connection(
                            mot1=autre_mot,
                            mot2=mot,
                            position=(current_row, current_col),
                            lettre=lettre,
                            est_appui=False,
                            distance=1
                        )
                        graphe.nodes[autre_mot].connections.append(connection_inverse)
                        graphe.nodes[autre_mot].degree += 1
                        # Unir dans UnionFind
                        graphe.union_find.union(mot, autre_mot)


def CBIC_generer_grille(
    mots_a_reviser: List[str],
    gaddag: GADDAG,
    lettres_appui: Dict[str, Dict[str, int]],
    mot_central: str = "DATAIS"
) -> Tuple[Board, ScrabbleGraph, Set[str]]:
    """
    Algorithme principal CBIC: Construction Incrémentale par Contraintes.
    
    Génère une grille de Scrabble en garantissant la connexité par construction.
    Remplace complètement l'ancien workflow en 3 phases.
    
    Args:
        mots_a_reviser: Liste des mots à placer sur la grille
        gaddag: Structure GADDAG pour validation
        lettres_appui: Dictionnaire des lettres d'appui {mot: {lettre: position}}
        mot_central: Mot de départ (par défaut "DATAIS")
    
    Returns:
        Tuple (grille, graphe, mots_places)
    """
    # 1. Initialisation
    grille = Board()
    graphe = ScrabbleGraph(grille)
    
    # Placer le mot central verticalement au centre
    center = grille.size // 2
    start_row = center - len(mot_central) // 2
    
    logger.info("CBIC: Placement du mot central '%s'", mot_central)
    for i, lettre in enumerate(mot_central):
        grille.place_letter(start_row + i, center, lettre)
    
    graphe.add_word(mot_central, (start_row, center), Direction.VERTICAL)
    graphe.central_word = mot_central
    
    mots_places = {mot_central}
    mots_restants = set(mots_a_reviser) - mots_places
    
    # 2. Boucle de construction incrémentale
    iteration = 0
    logger.info("CBIC: Construction incrémentale de %d mots", len(mots_restants))
    
    while mots_restants and iteration < MAX_ITERATIONS:
        iteration += 1
        
        meilleur_placement_global = None
        mot_a_placer_final = None
        meilleur_score_global = float('-inf')
        
        # 3. Itérer sur chaque mot restant pour trouver le meilleur coup possible
        for mot_candidat in mots_restants:
            
            # 4. Générer tous les placements connexes possibles pour ce mot
            placements_possibles = generer_placements_connexes(
                mot_candidat, grille, gaddag, lettres_appui
            )
            
            if not placements_possibles:
                continue
            
            # 5. Évaluer et trouver le meilleur placement pour ce mot_candidat
            for placement in placements_possibles:
                score = score_unifie(placement, grille, lettres_appui)
                if score > meilleur_score_global:
                    meilleur_score_global = score
                    meilleur_placement_global = placement
                    mot_a_placer_final = mot_candidat
        
        # 7. Si un placement a été trouvé, l'appliquer
        if meilleur_placement_global:
            logger.info("  Itération %d: Placement de '%s' (score: %.1f)",
                       iteration, mot_a_placer_final, meilleur_score_global)
            
            placer_mot(grille, mot_a_placer_final, meilleur_placement_global, graphe)
            mots_places.add(mot_a_placer_final)
            mots_restants.remove(mot_a_placer_final)
        else:
            # Aucun mot restant n'a pu être placé
            logger.warning("CBIC: Impossible de placer les mots restants: %s", mots_restants)
            logger.info("     Mots placés avec succès: %d/%d", len(mots_places), len(mots_a_reviser))
            break
    
    if iteration >= MAX_ITERATIONS:
        logger.warning("CBIC: Limite d'itérations atteinte (%d)", MAX_ITERATIONS)
    
    total = len(mots_a_reviser)
    taux = (len(mots_places) / total * 100) if total > 0 else 100.0
    logger.info("CBIC: Construction terminée - Mots placés: %d/%d (%.1f%%)",
                len(mots_places), total, taux)
    
    return grille, graphe, mots_places
