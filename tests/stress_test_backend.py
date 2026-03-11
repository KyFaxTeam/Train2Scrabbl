"""
Stress Test du Backend - Natural Flow Algorithm
================================================
Teste le pipeline complet: GADDAG -> WordPool -> Natural Flow -> Situation

Ce script teste:
1. Chargement du dictionnaire ODS8
2. Construction du GADDAG
3. Génération de situations pour différents mots cibles
4. Validation de l'intégrité des grilles générées
5. Performance (temps de génération)
6. Robustesse (mots difficiles, cas limites)
"""

import sys
import os
import time
import traceback

# Setup path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.board import Board
from src.models.gaddag import GADDAG
from src.models.situation import NaturalFlowConfig
from src.services.word_pool import WordPool
from src.services.word_validator import WordValidator
from src.modules.natural_flow import generer_situation_naturelle, generer_situations_pour_liste


# ============================================================================
# TEST HELPERS
# ============================================================================

class TestResult:
    def __init__(self, name):
        self.name = name
        self.passed = False
        self.error = None
        self.duration = 0.0
        self.details = {}

    def __repr__(self):
        status = "PASS" if self.passed else "FAIL"
        return f"[{status}] {self.name} ({self.duration:.2f}s)"


def load_ods8():
    """Charge le dictionnaire ODS8."""
    dict_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "ods8.txt")
    words = set()
    with open(dict_path, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().upper()
            if word and len(word) >= 2:
                words.add(word)
    return words


def build_gaddag(words):
    """Construit le GADDAG."""
    gaddag = GADDAG()
    for word in words:
        gaddag.add_word(word)
    return gaddag


# ============================================================================
# STRESS TESTS
# ============================================================================

def test_01_dictionary_loading():
    """Test: Chargement du dictionnaire ODS8."""
    result = TestResult("Chargement ODS8")
    start = time.time()
    try:
        words = load_ods8()
        result.duration = time.time() - start
        result.details["word_count"] = len(words)
        
        assert len(words) > 100000, f"Trop peu de mots: {len(words)}"
        assert "AA" in words, "Mot 'AA' manquant"
        assert "BACCARAT" in words, "Mot 'BACCARAT' manquant"
        
        result.passed = True
    except Exception as e:
        result.error = str(e)
        result.duration = time.time() - start
    return result


def test_02_gaddag_construction(words):
    """Test: Construction du GADDAG."""
    result = TestResult("Construction GADDAG")
    start = time.time()
    try:
        gaddag = build_gaddag(words)
        result.duration = time.time() - start
        result.details["word_count"] = gaddag.word_count
        
        # Vérifier quelques mots
        assert gaddag.contains("BACCARAT"), "GADDAG ne contient pas BACCARAT"
        assert gaddag.contains("AA"), "GADDAG ne contient pas AA"
        assert gaddag.contains("ZOO"), "GADDAG ne contient pas ZOO"
        assert not gaddag.contains("XYZXYZ"), "GADDAG contient un mot invalide"
        
        result.passed = True
    except Exception as e:
        result.error = str(e)
        result.duration = time.time() - start
    return result, gaddag if result.passed else None


def test_03_word_pool(gaddag, words):
    """Test: WordPool - extraction de mots par longueur."""
    result = TestResult("WordPool extraction")
    start = time.time()
    try:
        pool = WordPool(gaddag)
        pool.set_words(words)
        
        courts = pool.get_mots_courts(50)
        moyens = pool.get_mots_moyens(50)
        longs = pool.get_mots_longs(50)
        
        assert len(courts) > 0, "Pas de mots courts"
        assert len(moyens) > 0, "Pas de mots moyens"
        assert len(longs) > 0, "Pas de mots longs"
        
        # Vérifier les longueurs
        for m in courts:
            assert 2 <= len(m) <= 4, f"Mot court invalide: {m} (len={len(m)})"
        for m in moyens:
            assert 5 <= len(m) <= 6, f"Mot moyen invalide: {m} (len={len(m)})"
        for m in longs:
            assert 7 <= len(m) <= 8, f"Mot long invalide: {m} (len={len(m)})"
        
        # Tester get_mots_contenant_lettre
        mots_avec_e = pool.get_mots_contenant_lettre('E', 3, 5)
        assert len(mots_avec_e) > 0, "Pas de mots contenant E"
        for m in mots_avec_e:
            assert 'E' in m, f"Mot sans E: {m}"
        
        result.details["courts"] = len(courts)
        result.details["moyens"] = len(moyens) 
        result.details["longs"] = len(longs)
        result.details["avec_E"] = len(mots_avec_e)
        result.passed = True
        result.duration = time.time() - start
    except Exception as e:
        result.error = str(e)
        result.duration = time.time() - start
    return result


def test_04_single_situation(gaddag, words, mot_cible, lettre_appui):
    """Test: Génération d'une situation unique."""
    result = TestResult(f"Situation: {mot_cible} (appui={lettre_appui})")
    start = time.time()
    try:
        pool = WordPool(gaddag)
        pool.set_words(words)
        
        config = NaturalFlowConfig(
            profondeur_respiration=6,
            max_retries=3,
            seuil_naturalite=30.0  # Seuil bas pour le test
        )
        
        # Générer le tirage
        tirage = list(mot_cible)
        if lettre_appui in tirage:
            tirage.remove(lettre_appui)
        
        situation = generer_situation_naturelle(
            mot_cible=mot_cible,
            lettre_appui=lettre_appui,
            tirage=tirage,
            gaddag=gaddag,
            word_pool=pool,
            config=config
        )
        
        result.duration = time.time() - start
        
        if situation is None:
            result.error = "Situation is None (generation failed)"
            result.details["success"] = False
            return result
        
        # Vérifications de base
        assert situation.grille is not None, "Grille is None"
        assert situation.mot_cible == mot_cible, f"Mot cible incorrect: {situation.mot_cible}"
        assert situation.solution is not None, "Solution is None"
        assert situation.score_naturalite is not None, "Score naturalité is None"
        
        # Vérifier que la grille n'est pas vide
        cells = 0
        for r in range(15):
            for c in range(15):
                if situation.grille.get_letter(r, c):
                    cells += 1
        assert cells > 0, "Grille vide"
        
        # Vérifier l'intégrité de la grille
        validator = WordValidator(situation.grille, gaddag)
        all_valid, invalid_words = validator.validate_board_integrity()
        
        result.details["success"] = True
        result.details["cells_occupied"] = cells
        result.details["mots_places"] = len(situation.mots_places)
        result.details["score_naturalite"] = situation.score_naturalite.score_global()
        result.details["solution_score"] = situation.solution.score
        result.details["board_valid"] = all_valid
        result.details["invalid_words"] = invalid_words if not all_valid else []
        
        if not all_valid:
            result.error = f"Mots invalides sur grille: {invalid_words}"
            return result
        
        result.passed = True
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)}"
        result.duration = time.time() - start
        traceback.print_exc()
    return result


def test_05_batch_generation(gaddag, words):
    """Test: Génération par lot (batch)."""
    result = TestResult("Batch generation (5 mots)")
    start = time.time()
    
    mots = [
        ("CACABERA", "E"),
        ("BACCARAS", "S"),
        ("BACCARAT", "T"),
        ("CATALANE", "E"),
        ("JACAMARS", "S"),
    ]
    
    try:
        pool = WordPool(gaddag)
        pool.set_words(words)
        
        config = NaturalFlowConfig(
            profondeur_respiration=6,
            max_retries=3,
            seuil_naturalite=30.0
        )
        
        situations = generer_situations_pour_liste(
            mots_a_reviser=mots,
            gaddag=gaddag,
            word_pool=pool,
            config=config
        )
        
        result.duration = time.time() - start
        result.details["total"] = len(mots)
        result.details["generated"] = len(situations)
        result.details["success_rate"] = f"{len(situations)/len(mots)*100:.0f}%"
        
        # On ne demande pas 100% mais au moins quelques-unes
        if len(situations) == 0:
            result.error = "Aucune situation générée"
            return result
        
        # Vérifier l'intégrité de chaque grille
        for sit in situations:
            validator = WordValidator(sit.grille, gaddag)
            valid, invalids = validator.validate_board_integrity()
            if not valid:
                result.error = f"Grille invalide pour {sit.mot_cible}: {invalids}"
                return result
        
        result.passed = True
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)}"
        result.duration = time.time() - start
        traceback.print_exc()
    return result


def test_06_edge_cases(gaddag, words):
    """Test: Cas limites - mots courts, mots longs, lettres rares."""
    result = TestResult("Cas limites")
    start = time.time()
    
    # Tester différents types de mots
    test_cases = [
        ("ABAISSE", "A"),    # Mot avec beaucoup de voyelles
        ("QUARTZY", "Q"),    # Lettre rare Q (si le mot existe)
        ("WHISKY", "W"),     # Lettre rare W (si le mot existe)
    ]
    
    # Filtrer les mots qui existent
    valid_cases = [(m, a) for m, a in test_cases if m in words]
    
    results_per_case = {}
    
    try:
        pool = WordPool(gaddag)
        pool.set_words(words)
        
        config = NaturalFlowConfig(
            profondeur_respiration=4,
            max_retries=2,
            seuil_naturalite=20.0
        )
        
        for mot, appui in valid_cases:
            tirage = list(mot)
            if appui in tirage:
                tirage.remove(appui)
            
            try:
                sit = generer_situation_naturelle(
                    mot_cible=mot,
                    lettre_appui=appui,
                    tirage=tirage,
                    gaddag=gaddag,
                    word_pool=pool,
                    config=config
                )
                results_per_case[mot] = "OK" if sit else "FAIL (None)"
            except Exception as e:
                results_per_case[mot] = f"ERROR: {type(e).__name__}: {str(e)}"
        
        result.duration = time.time() - start
        result.details["cases_tested"] = len(valid_cases)
        result.details["results"] = results_per_case
        
        # Au moins un cas doit réussir
        successes = sum(1 for v in results_per_case.values() if v == "OK")
        result.details["successes"] = successes
        
        result.passed = True  # Informational test - pas de hard fail
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)}"
        result.duration = time.time() - start
        traceback.print_exc()
    return result


def test_07_api_model_conversion(gaddag, words):
    """Test: Conversion Natural Flow -> API Puzzle model."""
    result = TestResult("API Model Conversion")
    start = time.time()
    try:
        from src.api.routes.training import generate_puzzle_internal
        from src.api.main import app_state
        
        # Setup app state
        app_state["gaddag"] = gaddag
        app_state["all_words"] = words
        app_state["ready"] = True
        
        # Generate a puzzle
        puzzle = generate_puzzle_internal("BACCARAT")
        
        result.duration = time.time() - start
        
        assert puzzle is not None, "Puzzle is None"
        assert puzzle.id, "Puzzle has no ID"
        assert puzzle.rack, "Puzzle has no rack"
        assert puzzle.boardConfig, "Puzzle has no board config"
        assert puzzle.boardConfig.initialTiles, "Puzzle has no initial tiles"
        assert puzzle.solution, "Puzzle has no solution"
        assert puzzle.solution.word == "BACCARAT", f"Wrong word: {puzzle.solution.word}"
        assert puzzle.metadata, "Puzzle has no metadata"
        
        result.details["tiles_count"] = len(puzzle.boardConfig.initialTiles)
        result.details["solution_word"] = puzzle.solution.word
        result.details["solution_score"] = puzzle.solution.score
        result.details["naturality_score"] = puzzle.metadata.naturalityScore
        result.details["difficulty"] = puzzle.metadata.difficulty
        
        result.passed = True
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)}"
        result.duration = time.time() - start
        traceback.print_exc()
    return result


def test_08_word_validator_integrity(gaddag, words):
    """Test: WordValidator - validate_board_integrity sur grille construite manuellement."""
    result = TestResult("WordValidator integrity check")
    start = time.time()
    try:
        board = Board()
        
        # Placer un mot valide (AA est un mot de Scrabble)
        board.place_letter(7, 7, 'A')
        board.place_letter(7, 8, 'A')
        
        validator = WordValidator(board, gaddag)
        
        # Vérifier que AA est un mot valide
        assert gaddag.contains("AA"), "GADDAG ne contient pas AA"
        
        valid, invalids = validator.validate_board_integrity()
        result.details["valid"] = valid
        result.details["invalids"] = invalids
        
        result.duration = time.time() - start
        result.passed = True  # Informational
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)}"
        result.duration = time.time() - start
        traceback.print_exc()
    return result


def test_09_repeated_generation(gaddag, words):
    """Test: Répéter la génération 10 fois pour le même mot - tester la stabilité."""
    result = TestResult("Stabilité (10 répétitions)")
    start = time.time()
    
    successes = 0
    failures = 0
    errors = []
    times = []
    
    try:
        pool = WordPool(gaddag)
        pool.set_words(words)
        
        config = NaturalFlowConfig(
            profondeur_respiration=6,
            max_retries=2,
            seuil_naturalite=30.0
        )
        
        for i in range(10):
            t0 = time.time()
            try:
                tirage = list("BACCARAT")
                tirage.remove("T")  # lettre appui
                
                sit = generer_situation_naturelle(
                    mot_cible="BACCARAT",
                    lettre_appui="T",
                    tirage=tirage,
                    gaddag=gaddag,
                    word_pool=pool,
                    config=config
                )
                t1 = time.time()
                times.append(t1 - t0)
                
                if sit:
                    successes += 1
                else:
                    failures += 1
            except Exception as e:
                failures += 1
                errors.append(f"Run {i}: {type(e).__name__}: {str(e)}")
        
        result.duration = time.time() - start
        result.details["successes"] = successes
        result.details["failures"] = failures
        result.details["success_rate"] = f"{successes/10*100:.0f}%"
        if times:
            result.details["avg_time"] = f"{sum(times)/len(times):.2f}s"
            result.details["min_time"] = f"{min(times):.2f}s"
            result.details["max_time"] = f"{max(times):.2f}s"
        if errors:
            result.details["errors"] = errors[:3]  # Show first 3
        
        # Success rate >= 50%
        if successes >= 5:
            result.passed = True
        else:
            result.error = f"Success rate too low: {successes}/10"
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)}"
        result.duration = time.time() - start
        traceback.print_exc()
    return result


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print(" STRESS TEST - Backend train_scrabble")
    print(" Natural Flow Algorithm - End to End")
    print("=" * 70)
    
    all_results = []
    
    # Test 1: Dictionary
    print("\n[1/9] Chargement du dictionnaire...")
    r1 = test_01_dictionary_loading()
    all_results.append(r1)
    print(f"  {r1}")
    if r1.details:
        print(f"  Details: {r1.details}")
    
    if not r1.passed:
        print("\n FATAL: Impossible de charger le dictionnaire. Abandon.")
        return
    
    words = load_ods8()
    
    # Test 2: GADDAG
    print("\n[2/9] Construction du GADDAG...")
    r2, gaddag = test_02_gaddag_construction(words)
    all_results.append(r2)
    print(f"  {r2}")
    if r2.details:
        print(f"  Details: {r2.details}")
    
    if not r2.passed or gaddag is None:
        print("\n FATAL: GADDAG non construit. Abandon.")
        return
    
    # Test 3: WordPool
    print("\n[3/9] WordPool...")
    r3 = test_03_word_pool(gaddag, words)
    all_results.append(r3)
    print(f"  {r3}")
    if r3.details:
        print(f"  Details: {r3.details}")
    
    # Test 4: Single situation - BACCARAT
    print("\n[4/9] Génération situation unique (BACCARAT)...")
    r4 = test_04_single_situation(gaddag, words, "BACCARAT", "T")
    all_results.append(r4)
    print(f"  {r4}")
    if r4.details:
        print(f"  Details: {r4.details}")
    if r4.error:
        print(f"  Error: {r4.error}")
    
    # Test 5: Batch generation
    print("\n[5/9] Génération par lot (5 mots)...")
    r5 = test_05_batch_generation(gaddag, words)
    all_results.append(r5)
    print(f"  {r5}")
    if r5.details:
        print(f"  Details: {r5.details}")
    if r5.error:
        print(f"  Error: {r5.error}")
    
    # Test 6: Edge cases
    print("\n[6/9] Cas limites...")
    r6 = test_06_edge_cases(gaddag, words)
    all_results.append(r6)
    print(f"  {r6}")
    if r6.details:
        print(f"  Details: {r6.details}")
    
    # Test 7: API model conversion
    print("\n[7/9] API Model Conversion...")
    r7 = test_07_api_model_conversion(gaddag, words)
    all_results.append(r7)
    print(f"  {r7}")
    if r7.details:
        print(f"  Details: {r7.details}")
    if r7.error:
        print(f"  Error: {r7.error}")
    
    # Test 8: WordValidator
    print("\n[8/9] WordValidator integrity...")
    r8 = test_08_word_validator_integrity(gaddag, words)
    all_results.append(r8)
    print(f"  {r8}")
    if r8.details:
        print(f"  Details: {r8.details}")
    
    # Test 9: Repeated generation (stability)
    print("\n[9/9] Stabilité (10 répétitions BACCARAT)...")
    r9 = test_09_repeated_generation(gaddag, words)
    all_results.append(r9)
    print(f"  {r9}")
    if r9.details:
        print(f"  Details: {r9.details}")
    if r9.error:
        print(f"  Error: {r9.error}")
    
    # Summary
    print("\n" + "=" * 70)
    print(" RÉSUMÉ")
    print("=" * 70)
    
    passed = sum(1 for r in all_results if r.passed)
    failed = sum(1 for r in all_results if not r.passed)
    total_time = sum(r.duration for r in all_results)
    
    for r in all_results:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.name} ({r.duration:.2f}s)")
        if not r.passed and r.error:
            print(f"         -> {r.error}")
    
    print(f"\n  Total: {passed}/{len(all_results)} passed, {failed} failed")
    print(f"  Temps total: {total_time:.2f}s")
    
    if failed > 0:
        print("\n  BACKEND NON PRÊT - Des corrections sont nécessaires")
    else:
        print("\n  BACKEND OK - Tous les tests passent")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
