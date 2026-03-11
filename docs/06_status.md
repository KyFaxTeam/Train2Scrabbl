# Statut Actuel du Projet - train_scrabble

**Date**: 19 juillet 2025 (mis à jour)

---

## Où en sommes-nous ?

### Évolution du Projet

Le projet a traversé **trois phases majeures de conception algorithmique**. La Phase 3 (Natural Flow) est **pleinement implémentée et opérationnelle**.

---

## Phase 1 : Algorithme Initial (Abandonné)

- **Approche** : Placer des mots isolés puis tenter de les connecter
- **Taux de succès** : 1-5%
- **Statut** : OBSOLÈTE - Remplacé par CBIC
- **Doc** : `02_algorithme_initial.md`

---

## Phase 2 : CBIC (Obsolète)

- **Paradigme** : "Ne placer que ce qui connecte"
- **Taux de succès** : >90%
- **Problème** : Grilles artificiellement denses
- **Statut** : OBSOLÈTE - Remplacé par Natural Flow
- **Code** : `src/modules/cbic.py` (conservé)
- **Doc** : `03_critique_initial_et_transition_cbic.md`, `04_solution_cbic.md`

---

## Phase 3 : Natural Flow (OPÉRATIONNEL)

### Concept
- **Nouveau paradigme** : "Comment créer une situation où le joueur peut découvrir UN mot ?"
- Un mot à apprendre doit être JOUABLE, pas PRÉSENT.

### Architecture
1. **Phase Anchor** : Positionner la lettre d'appui stratégiquement
2. **Phase Breathe** : Construire une grille naturelle avec 6-8 mots
3. **Phase Stage** : Vérifier que le mot cible est jouable

### Résultats (stress test)
- **Taux de succès** : 100%
- **Temps moyen** : ~0.26s par puzzle
- **Score naturalité moyen** : ~184 (seuil: 40)
- **Mots par grille** : ~7

### Implémentation
- `src/modules/natural_flow.py` (~930 lignes)
- `src/models/situation.py` (dataclasses)
- `src/services/word_pool.py` (extraction mots ODS8)

### Doc
- `05_natural_flow.md`

---

## État Technique

### Tests : 52/52 passent
```
tests/test_board.py          2/2   ✅
tests/test_cbic.py          22/22  ✅
tests/test_gaddag.py         6/6   ✅
tests/test_game_manager.py   4/4   ✅
tests/test_move_generator.py 5/5   ✅
tests/test_rack.py           1/1   ✅
tests/test_score.py          4/4   ✅
tests/test_skeleton_utils.py 8/8   ✅
```

### Backend (FastAPI)
- API sur port 8099
- Endpoints: `/api/training/generate`, `/api/training/generate-batch`
- GADDAG avec cache pickle (~2s au lieu de ~44s au démarrage)
- Logging structuré (plus de print)

### Code Opérationnel
```
src/
├── models/
│   ├── board.py          ✅ Plateau 15×15, multiplicateurs
│   ├── gaddag.py         ✅ GADDAG + cache pickle
│   ├── graph.py          ✅ Graphe de connexité
│   ├── node.py           ✅ Nœuds GADDAG
│   ├── rack.py           ✅ Chevalet
│   ├── situation.py      ✅ Dataclasses Natural Flow
│   └── types.py          ✅ Direction, Move, SquareType
├── modules/
│   ├── cbic.py           ✅ CBIC (legacy, conservé)
│   └── natural_flow.py   ✅ Natural Flow (algorithme principal)
├── services/
│   ├── game_manager.py   ✅ Gestion de partie
│   ├── move_generator.py ✅ Génération de coups
│   ├── score_calculator.py ✅ Calcul scores + mots croisés
│   ├── word_connector.py ✅ Connexion de mots
│   ├── word_pool.py      ✅ Pool de mots par longueur
│   └── word_validator.py ✅ Validation dictionnaire
├── api/
│   ├── main.py           ✅ FastAPI + CORS + GADDAG cache
│   ├── routes/training.py ✅ Endpoints puzzle
│   └── services/puzzle_generator.py ✅ Service génération
└── utils/
    ├── board_utils.py    ✅ Utilitaires plateau
    ├── dictionary_parser.py ✅ Parseur dictionnaire
    └── skeleton_utils.py ✅ Génération squelettes
```

### Dictionnaires
- `data/ods8.txt` : 411,430 mots (ODS8 complet)
- `data/test_words.txt` : 29 mots de test

### Corrections appliquées (session de finalisation)
1. Bug `lettre_appui` : sélection aléatoire au lieu de première lettre
2. Debug prints → logging structuré dans tous les modules
3. ScoreCalculator : restauration des multiplicateurs dans les mots croisés
4. board_utils : `board.is_empty()` au lieu de `len(board.grid) == 0`
5. CBIC : protection division par zéro sur liste vide
6. GADDAG : cache pickle pour startup rapide
7. Tests : 52/52 passent (réécriture test_score, test_board, etc.)

---

## Frontend

```
frontend_new/
├── src/
│   ├── pages/
│   │   ├── DictionaryPage.tsx    ✅ Lecture passive
│   │   └── TrainingPage.tsx      ✅ Mode entraînement
│   ├── services/
│   │   ├── dictionaryService.ts  ✅ API dictionnaire
│   │   └── trainingService.ts    ⚠️  Génération aléatoire
│   └── store/
│       └── useAppStore.ts        ⚠️  State minimal
```

---

## Prochaines Étapes

1. **Intégrer Natural Flow dans le frontend** : connecter TrainingPage au backend NF
2. **Tracking progression** : système de répétition espacée (FSRS)
3. **Gamification** : XP, streaks, niveaux
4. **Qualité pédagogique** : validation avec vrais utilisateurs

---

**Dernière mise à jour** : 19 juillet 2025
**Statut global** : Natural Flow opérationnel ✅ | 52/52 tests passent ✅ | Frontend basique ⚠️
