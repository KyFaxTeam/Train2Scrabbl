# Plan de Finalisation — train_scrabble

**Date:** 2025-07-09  
**Basé sur:** Diagnostic backend complet (09_diagnostic_backend.md)  
**Conclusion principale:** L'algorithme Natural Flow fonctionne parfaitement. Les problèmes restants sont périphériques.

---

## État actuel vs État cible

| Composant | Actuel | Cible |
|-----------|--------|-------|
| Natural Flow | ✅ 100% succès, 0.26s/puzzle | ✅ Inchangé |
| API | ⚠️ Fonctionne mais bug lettre_appui | ✅ Lettre d'appui correcte |
| Tests | ⚠️ 41/54 passent (tests cassés) | ✅ ≥50/54 passent |
| Logs | ⚠️ print() partout | ✅ logging structuré |
| ScoreCalculator | ⚠️ Mots croisés = 0 | ✅ Scores corrects |
| Frontend ↔ Backend | ⚠️ Non testé ensemble | ✅ Intégration validée |
| GADDAG cache | ❌ 44s à chaque démarrage | ✅ Sérialisé (pickle) |

---

## Phase 1 — Corrections critiques (Quick Wins)

### 1.1 Corriger la lettre d'appui dans l'API

**Fichiers:** `src/api/routes/training.py`, `src/api/services/puzzle_generator.py`

**Problème:** `lettre_appui = target_word[0]` → devrait utiliser un dictionnaire d'entraînement ou une logique de sélection.

**Solution:** Passer `lettre_appui` en paramètre optionnel dans l'endpoint POST. Sinon, choisir une lettre aléatoire parmi les lettres du mot (pas systématiquement la première).

```python
# Avant (BUG)
lettre_appui = target_word[0]

# Après (CORRECT) — Option A: paramètre explicite
lettre_appui = request.lettre_appui or random.choice(target_word)

# Après (CORRECT) — Option B: dernière lettre (convention)
lettre_appui = target_word[-1]
```

**Effort:** ~30 min

### 1.2 Nettoyer les debug prints

**Fichiers:** `board.py`, `score_calculator.py`

**Action:** Remplacer `print()` par `logging.debug()` dans:
- `board.py:66` — `place_letter()`
- `score_calculator.py:55-112` — 6× print dans `_calculate_word_score` et `_calculate_crossing_words_score`

**Effort:** ~15 min

### 1.3 Créer `data/test_words.txt`

**Action:** Créer le fichier fixture avec les mots attendus par les tests GADDAG:

```
MAISON
JARDIN
CHAT
CHIEN
ARBRE
TABLE
ROUTE
SOLEIL
MASION
JRADIN
```

**Impact:** 7 tests ERROR → PASS immédiatement.

**Effort:** ~5 min

---

## Phase 2 — Corrections des tests unittest

### 2.1 Corriger les tests Board et Score

| Test | Fix |
|------|-----|
| `test_board::test_coordonnees` | Instancier Board() dans le test au lieu d'attendre un argument |
| `test_game_manager::test_undo_move` | Changer `len(board.grid) == 0` → vérifier que les cellules sont None |
| `test_score::test_score_simulation` | Changer `len(board.grid) == 3` → vérifier le nombre de cellules non-None |
| `test_score::test_multiplicateurs_mots_croises` | Recalculer les scores attendus avec le vrai ScoreCalculator |
| `test_move_generator::test_generation_coups` | Convertir en test autonome avec fixtures internes |

**Effort:** ~2h

### 2.2 Ajouter des tests Natural Flow

Créer `tests/test_natural_flow.py` avec:
- Test de base: générer une situation pour "BACCARAT"
- Test batch: générer 3 situations
- Test edge case: mot pas dans le dictionnaire
- Test config: seuil de naturalité

**Effort:** ~1h

---

## Phase 3 — Optimisations ScoreCalculator

### 3.1 Investiguer le score mots croisés = 0

**Hypothèse:** `_calculate_crossing_words_score()` ne détecte pas les mots croisés car la grille temporaire dans `simulate_move_score()` n'est pas correctement propagée.

**Action:**
1. Ajouter un test isolé avec un cas simple (2 mots qui se croisent)
2. Tracer l'exécution de `_calculate_crossing_words_score()` étape par étape
3. Vérifier que `prefix + letter + suffix` forme un mot dans le GADDAG

**Effort:** ~2-3h

### 3.2 Nettoyer simulate_move_score()

- Supprimer le paramètre `simulate` inutilisé dans `calculate_move_score()`
- Ou l'utiliser pour contrôler si `use_multiplier()` est appelé  
- Ajouter un test de non-régression (le score simulé doit être identique avant/après)

**Effort:** ~1h

---

## Phase 4 — Améliorations architecture

### 4.1 Sérialiser le GADDAG (pickle)

```python
import pickle, os

GADDAG_CACHE = "data/gaddag_ods8.pkl"

def load_or_build_gaddag(dict_path):
    if os.path.exists(GADDAG_CACHE):
        with open(GADDAG_CACHE, "rb") as f:
            return pickle.load(f)
    gaddag = GADDAG()
    gaddag.load_dictionary(dict_path)
    with open(GADDAG_CACHE, "wb") as f:
        pickle.dump(gaddag, f)
    return gaddag
```

**Impact:** Démarrage API de 44s → ~2-3s

**Effort:** ~30 min

### 4.2 Remplacer print → logging

```python
import logging
logger = logging.getLogger(__name__)

# Dans natural_flow.py
logger.info("Phase Anchor: lettre_appui=%s", lettre_appui)
logger.debug("Testing position (%d, %d)", row, col)
```

**Configuration** dans `src/api/main.py`:
```python
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
```

**Effort:** ~1h

### 4.3 Résoudre le circular import API

**Solution:** Extraire `generate_puzzle_internal()` dans un module séparé (`src/api/services/puzzle_generator.py` ou similaire) qui ne dépend pas de `app_state`.

Passer `gaddag` et `all_words` en paramètres plutôt que les lire depuis le module `main`.

**Effort:** ~1h

---

## Phase 5 — Intégration Frontend

### 5.1 Tester frontend ↔ backend ensemble

1. Lancer le backend: `uvicorn src.api.main:app --port 8099`
2. Configurer le frontend: `VITE_API_URL=http://localhost:8099`
3. Lancer le frontend: `npm run dev`
4. Tester le flux complet: générer un puzzle, afficher la grille, résoudre

### 5.2 Valider le format des données

Le frontend attend:
- `puzzle.boardConfig.initialTiles[]` → tuiles sur la grille
- `puzzle.rack[]` → lettres du tirage
- `puzzle.solution` → mot + position + direction
- `puzzle.metadata.naturalityScore` → score

Vérifier que le backend fournit exactement ce format.

**Effort:** ~2-3h

---

## Phase 6 — Mise à jour documentation

### 6.1 Mettre à jour `docs/06_status.md`

Le fichier dit que Natural Flow est "Non créé" alors qu'il est pleinement implémenté et testé.

### 6.2 Nettoyer le fichier `TO DO`

Remplacer par une version à jour reflétant les vrais items restants.

---

## Planning estimé

| Phase | Description | Priorité | Complexité |
|-------|-------------|----------|------------|
| **Phase 1** | Quick wins (lettre_appui, prints, test_words.txt) | 🔴 Haute | Facile |
| **Phase 2** | Corriger les tests | 🟡 Moyenne | Facile |
| **Phase 3** | ScoreCalculator fixes | 🟡 Moyenne | Moyenne |
| **Phase 4** | Architecture (GADDAG cache, logging, imports) | 🟡 Moyenne | Facile |
| **Phase 5** | Intégration frontend | 🔴 Haute | Moyenne |
| **Phase 6** | Documentation | 🟢 Basse | Facile |

---

## Prochaine action recommandée

**Commencer par Phase 1** — Les 3 quick wins qui débloquent le plus de valeur en moins de temps. Ensuite Phase 5 (intégration frontend) car c'est ce qui rend le projet utilisable.
