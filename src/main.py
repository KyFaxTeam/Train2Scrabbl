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
        print(f"Fichier non trouve: {full_path}")
    return words


def main():
    """Point d'entree du programme."""
    # 1. Charger le dictionnaire d'extensions (pour les mots a reviser)
    dico_entries = charger_dictionnaire("scrabble_dict_ext1.txt")
    print(f"\nDictionnaire extensions charge avec {len(dico_entries)} entrees")
    
    # 2. Extraire les mots du dictionnaire d'extensions
    mots_extensions = extraire_tous_mots(dico_entries)
    print(f"Extraction de {len(mots_extensions)} mots d'extensions (7-8 lettres)")
    
    # 3. Charger le dictionnaire complet ODS8 (pour Natural Flow)
    print("Chargement du dictionnaire complet ODS8...")
    mots_ods = charger_dictionnaire_ods("ods8.txt")
    print(f"Dictionnaire ODS8: {len(mots_ods)} mots")
    
    # 4. Combiner tous les mots
    all_words = mots_extensions | mots_ods
    print(f"Total: {len(all_words)} mots uniques")
    
    # 5. Creer le GADDAG
    print("Construction du GADDAG...")
    gaddag = GADDAG()
    for word in all_words:
        gaddag.add_word(word)
    print(f"GADDAG cree avec {gaddag.word_count} mots")
    
    # 6. Definir les mots a reviser avec leurs lettres d'appui
    mots_a_reviser = [
        ("CACABERA", "E"),
        ("BACCARAS", "S"),
        ("BACCARAT", "T"),
    ]
    print(f"\nMots a reviser : {[m[0] for m in mots_a_reviser]}")
    
    # 4. Configuration Natural Flow
    config = NaturalFlowConfig(
        profondeur_respiration=6,
        max_retries=3,
        seuil_naturalite=40.0
    )
    
    # 5. Generer les situations d'entrainement avec Natural Flow
    situations = generer_situation_entrainement_natural_flow(
        mots_a_reviser=mots_a_reviser,
        gaddag=gaddag,
        all_words=all_words,
        config=config
    )
    
    # 6. Afficher les resultats
    print(f"\n{'='*60}")
    print(f"SITUATIONS D'ENTRAINEMENT GENEREES: {len(situations)}")
    print(f"{'='*60}")
    
    for i, situation in enumerate(situations, 1):
        print(f"\n--- Situation {i}: {situation.mot_cible} ---")
        print(f"Tirage: {''.join(situation.tirage)}")
        if situation.solution:
            print(f"Solution: {situation.solution.mot} "
                  f"en {situation.solution.placement.position} "
                  f"({situation.solution.placement.direction})")
            print(f"Score: {situation.solution.score} points")
        if situation.score_naturalite:
            print(f"Score naturalite: {situation.score_naturalite.score_global():.1f}")
        print(f"Mots sur la grille: {situation.mots_places}")
        print("\nGrille:")
        situation.grille.debug_print()
    
    # 7. Resume
    print(f"\n{'='*60}")
    print(f"RESUME NATURAL FLOW")
    print(f"{'='*60}")
    print(f"  Paradigme: 1 grille = 1 mot cible = 1 objectif pedagogique")
    print(f"  Situations generees: {len(situations)}/{len(mots_a_reviser)}")
    if situations:
        avg_mots = sum(len(s.mots_places) for s in situations) / len(situations)
        print(f"  Moyenne mots par grille: {avg_mots:.1f}")
        avg_nat = sum(s.score_naturalite.score_global() for s in situations if s.score_naturalite) / len(situations)
        print(f"  Score naturalite moyen: {avg_nat:.1f}")


if __name__ == "__main__":
    main()
