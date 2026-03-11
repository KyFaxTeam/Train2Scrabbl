# Diagnostic Backend - train_scrabble

**Date:** 2025-07-09  
**Scope:** Tests unitaires, Stress test Natural Flow, Test API  

---

## 1. Résumé Exécutif

| Composant | Statut | Détails |
|-----------|--------|---------|
| **Natural Flow (cœur)** | ✅ **FONCTIONNE** | 100% succès sur 10 répétitions, ~0.26s/puzzle |
| **API FastAPI** | ✅ **FONCTIONNE** | /puzzle, /generate, /batch OK mais bug lettre_appui |
| **GADDAG + Dictionnaire** | ✅ **FONCTIONNE** | 411,430 mots chargés, 43s build |
| **WordPool** | ✅ **FONCTIONNE** | Extraction par longueur OK |
| **WordValidator** | ✅ **FONCTIONNE** | Intégrité grille validée |
| **Tests unitaires** | ⚠️ **41/54 passent** | 6 FAILED + 7 ERROR (fixtures/tests cassés) |
| **ScoreCalculator** | ⚠️ **Bugs** | Mots croisés score=0, debug prints partout |

**Verdict:** Le pipeline principal (Natural Flow → Puzzle) fonctionne et est stable. Les bugs sont dans les tests, l'API lettre_appui, et le ScoreCalculator.

---

## 2. Stress Test Natural Flow — Résultats

```
[PASS] Chargement ODS8             (0.22s) — 411,430 mots
[PASS] Construction GADDAG         (43.94s) — structure complète
[PASS] WordPool extraction         (1.29s) — courts/moyens/longs OK
[PASS] Situation BACCARAT (T)      (0.17s) — grille valide
[PASS] Batch 5 mots                (3.79s) — 5/5 générées
[PASS] Cas limites                 (0.81s) — ABAISSE OK
[FAIL] API Model Conversion        (0.76s) — circular import
[PASS] WordValidator integrity     (0.00s) — AA validé
[PASS] Stabilité (10x BACCARAT)    (2.59s) — 100% succès
```

**Performance:**
- Temps moyen par puzzle: **0.26s** (min: 0.15s, max: 0.42s)
- Batch 5 mots: **3.79s** (0.76s/puzzle)
- Score naturalité moyen: **183-185** (seuil: 50)
- Taux de succès: **100%** (10/10 répétitions)

---

## 3. Test API — Résultats

| Endpoint | Status | Temps |
|----------|--------|-------|
| `GET /api/health` | ✅ 200 OK | instant |
| `POST /api/training/generate` (BACCARAT) | ✅ 200 OK | 347ms |
| `GET /api/training/puzzle` (random) | ✅ 200 OK | 764ms |
| `GET /api/training/batch?size=3` | ✅ 200 OK | 1720ms |

**Exemples de puzzles générés:**
- BACCARAT → 16 tuiles, score 18, naturalité 183.8
- NOMINIEZ → 21 tuiles, random word OK
- Batch: DIGERES (score 61), LARDIONS (score 11), TOURIES (score 59)

---

## 4. Bugs Identifiés

### BUG-1: Lettre d'appui incorrecte dans l'API (CRITIQUE)

**Fichiers:** `src/api/routes/training.py` L79, `src/api/services/puzzle_generator.py`  
**Le problème:** `lettre_appui = target_word[0]` utilise la première lettre du mot au lieu de la vraie lettre d'appui du dictionnaire d'entraînement.

**Exemple:** Pour BACCARAT, la lettre d'appui devrait être `T` (BACCARAT→T) mais l'API utilise `B` (première lettre).  
**Conséquence:** Le tirage renvoyé est `[A,C,C,A,R,A,T]` au lieu de `[B,A,C,C,A,R,A]`. Le joueur ne reçoit pas le bon tirage pour résoudre le puzzle.

**Impact:** Le frontend reçoit un puzzle incohérent — la lettre d'appui sur la grille ne correspond pas à la logique de tirage.

### BUG-2: Debug prints polluent la production (MOYEN)

**Fichiers:**
- `src/models/board.py` L66: `print(f"Placing {letter} at ({row}, {col})")` dans `place_letter()`
- `src/services/score_calculator.py` L55-75: Multiples `print()` dans `_calculate_word_score()`
- `src/services/score_calculator.py` L84-112: Multiples `print()` dans `_calculate_crossing_words_score()`
- `src/modules/natural_flow.py`: ~20 print() dans le flux de génération

**Conséquence:** Chaque génération de puzzle produit des dizaines de lignes de debug dans la console. En production, cela dégrade la performance I/O et masque les erreurs réelles.

### BUG-3: ScoreCalculator — Score mots croisés = 0 systématiquement (MOYEN)

**Observation stress test:** `Score total des mots croisés: 0` apparaît à chaque génération.  
**Analyse:** La méthode `_calculate_crossing_words_score()` restaure la grille temporaire MAIS elle modifie `used_multipliers` via `_calculate_word_score()` sans les restaurer. De plus, le calcul de prefix/suffix peut ne pas détecter les mots croisés car la grille temporaire est manipulée.

**Impact:** Les scores de placement pendant Natural Flow sont potentiellement sous-estimés. Le score final du puzzle solution pourrait être incorrect.

### BUG-4: Circular import API ↔ tests (FAIBLE)

**Description:** `from src.api.routes.training import generate_puzzle_internal` déclenche une circular import quand appelé depuis un script hors API car `training.py` importe `app_state` de `src.api.main`.

**Impact:** Empêche les tests unitaires d'appeler directement `generate_puzzle_internal()`.

### BUG-5: Board.undo — le plateau n'est pas nettoyé correctement (FAIBLE)

**Test:** `test_undo_move` — `assert len(game.board.grid) == 0` échoue parce que `board.grid` est toujours une liste 15x15 (jamais vide, juste remplie de None).

**Analyse:** Le test vérifie `len(board.grid) == 0` ce qui sera toujours 15. C'est un bug de test, pas de code.

---

## 5. Tests Cassés — Analyse

### Catégorie A: Fixture/fichier manquant (7 erreurs)

| Test | Cause |
|------|-------|
| `test_gaddag::test_recherche_mots` | `data/test_words.txt` n'existe pas |
| `test_gaddag::test_ajout_mot` | idem |
| `test_gaddag::test_normalisation` | idem |
| `test_gaddag::test_skeleton_pattern_matching` | idem |
| `test_gaddag::test_bridge_word_finding` | idem |
| `test_board::test_coordonnees` | Le test prend `board: Board` en argument mais pytest ne fournit pas ce fixture |
| `test_move_generator::test_generation_coups` | Le test prend `gaddag, board, rack` en arguments non fournis |

**Solution:** Créer `data/test_words.txt` avec les mots attendus par les tests. Convertir `test_coordonnees` en test autonome. Corriger `test_generation_coups`.

### Catégorie B: Vrais bugs (4 failures)

| Test | Cause réelle |
|------|-------------|
| `test_gaddag::test_load_dictionary` | Fichier `data/test_words.txt` manquant |
| `test_score::test_multiplicateurs_mots_croises` | Calcul de score incorrect (voir BUG-3) |
| `test_score::test_score_simulation` | `assert len(board.grid) == 3` — `grid` est toujours une liste 15x15 |
| `test_move_generator::test_word_generation` | Le MoveGenerator ne trouve pas assez de coups avec le petit GADDAG |

### Catégorie C: Legacy/CBIC (1 failure)

| Test | Cause |
|------|-------|
| `test_cbic::test_empty_word_list` | `CBIC_generer_grille([])` — le mot central "DATAIS" n'est pas ajouté à `mots_places` quand la liste est vide. Bug mineur du module CBIC legacy. |

---

## 6. Problèmes Architecturaux

1. **Pas de système de logging** — Tout le code utilise `print()`. Il faudrait `logging` avec niveaux DEBUG/INFO/WARNING.

2. **Pas de lettre_appui dans l'API** — L'API ne prend pas en entrée la lettre d'appui. Le endpoint `/generate` devrait accepter `{word, lettre_appui}`.

3. **GADDAG build time = 44s** — Acceptable au démarrage du serveur mais bloquant pour les tests. Pas de sérialisation/cache du GADDAG construit.

4. **Pas de cache de puzzles** — Chaque requête génère un nouveau puzzle. Pour la production, un cache/pré-génération serait utile.

5. **ScoreCalculator side effects** — `calculate_move_score()` modifie `board.used_multipliers` même sans le flag `simulate`. Le design est fragile.

---

## 7. Ce Qui Fonctionne Bien

- **Natural Flow core algorithm** — Stable, performant (0.15-0.42s/puzzle), 100% success rate
- **Qualité des grilles** — Score naturalité 183-185 (seuil 50), mots variés (courts/moyens/longs)
- **Intégrité des grilles** — WordValidator confirme que tous les mots sont valides (dans le GADDAG)
- **API REST** — Tous les endpoints fonctionnent, réponse JSON correcte, CORS configuré
- **GADDAG** — Chargement complet du dictionnaire ODS8, recherche rapide
- **WordPool** — Distribution réaliste des mots par longueur
