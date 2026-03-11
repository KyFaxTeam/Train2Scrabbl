"""
Train Scrabble - Point d'entrée principal.

Utilise exclusivement Natural Flow pour la génération de situations.
"""
import logging
from typing import Set, Dict, List, Tuple
import random

from src.models.board import Board
from src.models.gaddag import GADDAG
from src.models.graph import ScrabbleGraph
from src.models.types import Direction
from src.modules.natural_flow import (
    generer_situation_naturelle,
    generer_situations_pour_liste
)
from src.models.situation import NaturalFlowConfig
from src.services.word_pool import WordPool

from src.utils.dictionary_parser import parse_dictionary, DictionaryEntry

logger = logging.getLogger(__name__)


def charger_dictionnaire(chemin_fichier: str) -> Dict[str, DictionaryEntry]:
    """Charge le dictionnaire depuis un fichier."""
    full_path = f"data/{chemin_fichier}"
    return parse_dictionary(full_path)


def initialiser_sac_lettres() -> Dict[str, int]:
    """Initialises le sac de lettres avec la distribution du Scrabble francais."""
    return {
        'A': 9, 'B': 2, 'C': 2, 'D': 3, 'E': 15, 'F': 2, 'G': 2, 'H': 2,
        'I': 8, 'J': 1, 'K': 1, 'L': 5, 'M': 3, 'N': 6, 'O': 6, 'P': 2,
        'Q': 1, 'R': 6, 'S': 6, 'T': 6, 'U': 6, 'V': 2, 'W': 1, 'X': 1,
        'Y': 1, 'Z': 1, '*': 2  # Jokers
    }


def extraire_tous_mots(dico_entries: Dict[str, DictionaryEntry]) -> Set[str]:
    """Extrait tous les mots du dictionnaire (base + extensions)."""
    all_words = set()
    for entry in dico_entries.values():
        for word in entry.base_words:
            all_words.add(word)
        for ext_list in entry.extensions_1.values():
            for word in ext_list:
                all_words.add(word)
    return all_words


def generer_situation_entrainement_natural_flow(
    mots_a_reviser: List[Tuple[str, str]],
    gaddag: GADDAG,
    all_words: Set[str],
    config: NaturalFlowConfig = None
) -> List:
    """
    Genere des situations d'entrainement avec Natural Flow.
    
    Philosophie Natural Flow:
    - UNE grille par mot cible (pas tous les mots sur une grille)
    - Grille naturelle avec densite ~20%
    - Mot cible JOUABLE, pas simplement PRESENT
    """
    config = config or NaturalFlowConfig()
    
    # Creer un WordPool avec tous les mots
    word_pool = WordPool(gaddag)
    word_pool.set_words(all_words)
    
    # Generer les situations
    situations = generer_situations_pour_liste(
        mots_a_reviser=mots_a_reviser,
        gaddag=gaddag,
        tirages=None,
        word_pool=word_pool,
        config=config
    )
    
    return situations


def charger_dictionnaire_ods(chemin_fichier: str) -> Set[str]:
    """Charge un dictionnaire simple (une mot par ligne)."""
    full_path = f"data/{chemin_fichier}"
    words = set()
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip().upper()
                if word and len(word) >= 2:
                    words.add(word)
    except FileNotFoundError:
        logger.error("Fichier non trouve: %s", full_path)
    return words


def main():
    """Point d'entree du programme."""
    logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

    # 1. Charger le dictionnaire d'extensions (pour les mots a reviser)
    dico_entries = charger_dictionnaire("scrabble_dict_ext1.txt")
    logger.info("Dictionnaire extensions charge avec %d entrees", len(dico_entries))
    
    # 2. Extraire les mots du dictionnaire d'extensions
    mots_extensions = extraire_tous_mots(dico_entries)
    logger.info("Extraction de %d mots d'extensions (7-8 lettres)", len(mots_extensions))
    
    # 3. Charger le dictionnaire complet ODS8 (pour Natural Flow)
    logger.info("Chargement du dictionnaire complet ODS8...")
    mots_ods = charger_dictionnaire_ods("ods8.txt")
    logger.info("Dictionnaire ODS8: %d mots", len(mots_ods))
    
    # 4. Combiner tous les mots
    all_words = mots_extensions | mots_ods
    logger.info("Total: %d mots uniques", len(all_words))
    
    # 5. Creer le GADDAG
    logger.info("Construction du GADDAG...")
    gaddag = GADDAG()
    for word in all_words:
        gaddag.add_word(word)
    logger.info("GADDAG cree avec %d mots", gaddag.word_count)
    
    # 6. Definir les mots a reviser avec leurs lettres d'appui
    mots_a_reviser = [
        ("CACABERA", "E"),
        ("BACCARAS", "S"),
        ("BACCARAT", "T"),
    ]
    logger.info("Mots a reviser : %s", [m[0] for m in mots_a_reviser])
    
    # 7. Configuration Natural Flow
    config = NaturalFlowConfig(
        profondeur_respiration=6,
        max_retries=3,
        seuil_naturalite=40.0
    )
    
    # 8. Generer les situations d'entrainement avec Natural Flow
    situations = generer_situation_entrainement_natural_flow(
        mots_a_reviser=mots_a_reviser,
        gaddag=gaddag,
        all_words=all_words,
        config=config
    )
    
    # 9. Afficher les resultats
    logger.info("=" * 60)
    logger.info("SITUATIONS D'ENTRAINEMENT GENEREES: %d", len(situations))
    logger.info("=" * 60)
    
    for i, situation in enumerate(situations, 1):
        logger.info("--- Situation %d: %s ---", i, situation.mot_cible)
        logger.info("Tirage: %s", ''.join(situation.tirage))
        if situation.solution:
            logger.info("Solution: %s en %s (%s)",
                       situation.solution.mot,
                       situation.solution.placement.position,
                       situation.solution.placement.direction)
            logger.info("Score: %d points", situation.solution.score)
        if situation.score_naturalite:
            logger.info("Score naturalite: %.1f", situation.score_naturalite.score_global())
        logger.info("Mots sur la grille: %s", situation.mots_places)
        situation.grille.debug_print()
    
    # 10. Resume
    logger.info("=" * 60)
    logger.info("RESUME NATURAL FLOW")
    logger.info("=" * 60)
    logger.info("  Paradigme: 1 grille = 1 mot cible = 1 objectif pedagogique")
    logger.info("  Situations generees: %d/%d", len(situations), len(mots_a_reviser))
    if situations:
        avg_mots = sum(len(s.mots_places) for s in situations) / len(situations)
        logger.info("  Moyenne mots par grille: %.1f", avg_mots)
        avg_nat = sum(s.score_naturalite.score_global() for s in situations if s.score_naturalite) / len(situations)
        logger.info("  Score naturalite moyen: %.1f", avg_nat)


if __name__ == "__main__":
    main()
