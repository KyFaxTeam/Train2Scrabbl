## Problématique : Génération de Situations d'Entraînement au Scrabble

**Contexte :**

Le Scrabble est un jeu de société où les joueurs forment des mots entrecroisés sur une grille de 15x15 cases à l'aide de lettres tirées aléatoirement. Les joueurs de haut niveau mémorisent des listes de mots pour améliorer leur performance.

**Problème :**

Les joueurs de Scrabble, en particulier ceux qui cherchent à progresser, ont besoin de s'entraîner à **retrouver les mots qu'ils ont appris** (leur "liste de mots") **à partir d'un tirage de 7 lettres et d'une configuration de grille réaliste**. Il est actuellement difficile de générer manuellement des situations d'entraînement qui soient à la fois :

1. **Réalistes :** La grille doit correspondre à une configuration de jeu plausible, avec des mots déjà placés qui respectent les règles du Scrabble et une certaine logique de placement.
2. **Pertinentes :** La grille et le tirage doivent permettre de former un ou plusieurs mots de la liste apprise par le joueur.
3. **Variées :** Les situations d'entraînement doivent être suffisamment diversifiées pour couvrir un large éventail de configurations de grille, de tirages et de mots à trouver.
4. **Adaptables :** Il doit être possible de paramétrer la difficulté des situations générées (par exemple, en ajustant le nombre de mots déjà placés sur la grille, la longueur des mots à trouver, ou la complexité des connexions).

**Objectif :**

Concevoir et implémenter un algorithme capable de **générer automatiquement des situations d'entraînement au Scrabble** qui répondent aux critères de réalisme, de pertinence, de variété et d'adaptabilité. L'algorithme prendra en entrée une liste de mots à apprendre (`M`), et générera des grilles de Scrabble partiellement remplies, ainsi qu'un tirage de 7 lettres, permettant aux joueurs de s'exercer à retrouver les mots de leur liste dans un contexte de jeu simulé. 
Générer une grille de Scrabble d'entraînement avec une liste de mots à réviser `M`, en maximisant la connexité et la qualité du placement, **et en respectant la contrainte de connexion des mots de `M` par leur lettre d'appui uniquement.**

**Contraintes :**

*   Respecter les règles du Scrabble (placement des mots, validité des mots, utilisation des lettres disponibles).
*   Utiliser un dictionnaire de référence (par exemple, l'Officiel du Scrabble) pour la validation des mots.
*   Intégrer la notion de "lettres d'appui" (lettres privilégiées pour les connexions) pour orienter la génération vers des situations plus pertinentes pour l'apprentissage.
*   Optimiser l'algorithme pour une génération efficace des situations d'entraînement.


**En résumé, le défi est de créer un outil qui génère des "puzzles" de Scrabble sur mesure pour l'entraînement, en tenant compte à la fois des contraintes du jeu et des besoins d'apprentissage des joueurs.**

EXEMPLES DE TIRAGES DE 7 LETTRES ET LEURS APPUIS

AAABCCR
+ BACCARA
+ E CACABERA
+ S BACCARAS
+ T BACCARAT

AAACJMR
- JACAMAR
+ S JACAMARS
+ U MARACUJA

AAACLNT
- CATALAN
+ B BALANÇAT
+ B BATALCAN
+ B CABALANT
+ E ANALECTA
+ E CATALANE
+ H ACHALANT
+ S CATALANS
+ V CAVALANT

AAACLPS
- APLACAS
+ S CALAPAS

AAAIPSS
- APAISA
+ I APAISAIS
+ V PASSAVA

AAAJNSV
- NAVAJAS
+ I JAVANAIS

AAABBELL
- ABAILLE
+ I DIABELLE
+ S BASEBALLS
+ T BLABLATE

AABBSST
- SABBATS
+ E BARBATES
+ S BARBATES

AABCELU
- ABACULE
- CABLEAU
+ R CABLEUR
+ S ABACULES
+ X CABLEAUX


# Train Scrabble

Un générateur automatique de situations d'entraînement au Scrabble utilisant l'algorithme **Natural Flow**.

## Vue d'ensemble

Ce projet génère des grilles de Scrabble d'entraînement pour aider les joueurs à mémoriser et retrouver des mots spécifiques. L'algorithme Natural Flow crée des grilles réalistes où le mot cible est **jouable**, pas simplement présent.

### Caractéristiques principales

- ✅ **Taux de succès 100%** : Chaque mot produit une situation d'entraînement valide
- ✅ **Grilles naturelles** : Densité ~20%, ressemblant à de vraies parties
- ✅ **Génération rapide** : ~0.26 seconde par puzzle
- ✅ **Score de naturalité** : Évaluation objective de la qualité de chaque grille (~184 en moyenne)
- ✅ **API REST** : Backend FastAPI prêt à l'emploi
- ✅ **Frontend React** : Interface d'entraînement interactive

## Algorithme Natural Flow

### Philosophie

> **"JOUABLE pas PRÉSENT"** — Un mot à apprendre doit être jouable par le joueur à partir de son tirage et de la grille, pas simplement affiché sur le plateau.

Natural Flow génère **une grille par mot cible**, avec un seul objectif pédagogique par situation. La grille contient 6-8 mots formant un contexte naturel.

### Architecture en 3 phases

```
Phase 1: ANCHOR    → Positionner la lettre d'appui stratégiquement sur le plateau
Phase 2: BREATHE   → Construire une grille naturelle avec 6-8 mots interconnectés
Phase 3: STAGE     → Vérifier que le mot cible est jouable depuis le tirage
```

### Résultats (stress test sur mots aléatoires)

| Métrique | Valeur |
|----------|--------|
| Taux de succès | **100%** |
| Temps moyen | **~0.26s** par puzzle |
| Score naturalité moyen | **~184** (seuil: 40) |
| Mots par grille | **~7** |
| Densité moyenne | **~20%** |

### Évolution algorithmique

| Phase | Algorithme | Taux de succès | Statut |
|-------|-----------|---------------|--------|
| 1 | Algo initial (3 phases) | ~1-5% | Abandonné |
| 2 | CBIC | >90% | Archivé (`legacy/`) |
| 3 | **Natural Flow** | **100%** | **Actif** |

Voir `docs/05_natural_flow.md` pour la spécification complète.

## Structure du Projet

```
train_scrabble/
├── data/                    # Dictionnaires
│   └── ods8.txt             # ODS8 complet (411 430 mots)
├── src/                     # Code source
│   ├── models/              # Structures de données
│   │   ├── board.py         # Plateau 15×15 avec multiplicateurs
│   │   ├── gaddag.py        # GADDAG + cache pickle
│   │   ├── graph.py         # Graphe de connexité
│   │   ├── situation.py     # Dataclasses Natural Flow
│   │   └── types.py         # Direction, Move, SquareType
│   ├── modules/
│   │   └── natural_flow.py  # Algorithme Natural Flow (~930 lignes)
│   ├── services/            # Services de jeu
│   │   ├── move_generator.py
│   │   ├── score_calculator.py
│   │   ├── word_pool.py
│   │   └── word_validator.py
│   ├── api/                 # Backend FastAPI
│   │   ├── main.py          # App + CORS + lifespan
│   │   └── routes/training.py  # Endpoints puzzle
│   └── utils/               # Utilitaires
├── frontend_new/            # Frontend React/Vite/TypeScript
│   └── src/
│       ├── pages/TrainingPage.tsx  # Page d'entraînement
│       ├── services/trainingService.ts
│       └── components/Arena/       # Composants de jeu
├── tests/                   # 32 tests unitaires
├── legacy/                  # Algorithmes archivés (CBIC)
└── docs/                    # Documentation technique
```

## Installation et Exécution

### Prérequis

- Python 3.12+
- Node.js 18+ (pour le frontend)
- Dictionnaire ODS8 dans `data/ods8.txt`

### Backend

```bash
# Installer les dépendances Python
pip install -r requirements.txt

# Lancer le CLI pour tester la génération
py -m src.main

# Lancer l'API (port 8000)
py -m src.api.main
```

### Frontend

```bash
cd frontend_new
npm install
npm run dev    # Démarre sur http://localhost:5173
```

Le frontend se connecte automatiquement au backend via le proxy Vite (`/api → localhost:8000`).

### Exemple concret de sortie (Natural Flow)

```
SITUATIONS D'ENTRAINEMENT GENEREES: 3
--- Situation 1: CACABERA ---
Tirage: AABCCRE
Solution: CACABERA en (7, 3) (Direction.HORIZONTAL)
Score: 64 points
Score naturalite: 186.2
Mots sur la grille: ['RONGEA', 'ABJECT', 'REMISA', 'URGE', 'NEVI', 'ETAI']

--- Situation 2: BACCARAS ---
Tirage: AABCCRS
Solution: BACCARAS en (4, 5) (Direction.VERTICAL)
Score: 72 points
Score naturalite: 191.5
Mots sur la grille: ['SAVONS', 'HABILE', 'TAMISE', 'LUXE', 'ORGE', 'ETUI']
```

Chaque situation contient :
- Une grille avec ~7 mots déjà placés (contexte naturel)
- Un tirage de 7 lettres pour le joueur
- La solution (mot cible jouable depuis le tirage)
- Un score de naturalité (qualité de la grille)

## Utilisation Programmatique

```python
from src.models.gaddag import GADDAG
from src.modules.natural_flow import generer_situation_naturelle
from src.models.situation import NaturalFlowConfig
from src.services.word_pool import WordPool

# Charger le GADDAG (avec cache pickle)
gaddag = GADDAG.load_with_cache("data/ods8.txt")

# Préparer le pool de mots
word_pool = WordPool(gaddag)
word_pool.set_words(gaddag.get_all_words())

# Configurer Natural Flow
config = NaturalFlowConfig(
    profondeur_respiration=6,  # Nombre de mots de contexte
    max_retries=3,
    seuil_naturalite=40.0
)

# Générer une situation pour le mot BACCARAT avec appui T
situation = generer_situation_naturelle(
    mot_cible="BACCARAT",
    lettre_appui="T",
    gaddag=gaddag,
    word_pool=word_pool,
    config=config
)

# Résultats
print(f"Tirage: {''.join(situation.tirage)}")
print(f"Mots sur la grille: {situation.mots_places}")
print(f"Score naturalité: {situation.score_naturalite.score_global():.1f}")
situation.grille.debug_print()
```

## API REST

### Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | État de l'API (dictionnaire, GADDAG) |
| GET | `/api/training/puzzle` | Puzzle aléatoire |
| POST | `/api/training/generate` | Puzzle pour un mot spécifique |
| GET | `/api/training/batch?size=5` | Batch de puzzles |

### Exemple d'appel

```bash
# Santé de l'API
curl http://localhost:8000/api/health

# Générer un puzzle pour BACCARAT
curl -X POST http://localhost:8000/api/training/generate \
  -H "Content-Type: application/json" \
  -d '{"word": "BACCARAT"}'

# Batch de 5 puzzles aléatoires
curl http://localhost:8000/api/training/batch?size=5
```

## Tests

```bash
# Lancer tous les tests (32 tests)
py -m pytest tests/ -v

# Tests avec couverture
py -m pytest tests/ --cov=src
```

## Documentation

| Document | Contenu |
|----------|---------|
| `docs/01_problematique.md` | Problématique et contraintes |
| `docs/05_natural_flow.md` | Spécification complète de Natural Flow |
| `docs/06_status.md` | État actuel du projet |
| `docs/09_roadmap_nff.md` | Feuille de route future (4 modes) |

## Roadmap

Le projet évolue vers un **Natural Flow Framework** avec 4 modes d'entraînement :

1. **Discovery** (actuel) — Apprendre de nouveaux mots
2. **Challenge** — Trouver le placement optimal parmi des distracteurs
3. **Arena** — Situations mid-game réalistes, top-3 scoring
4. **Endgame** — Fins de partie avec sac connu

Voir `docs/09_roadmap_nff.md` pour les détails.
4. **Parallélisation** : Génération parallèle pour grandes listes de mots

## Licence

Ce projet est sous licence MIT. Voir LICENSE pour plus de détails.


**Note** : Ce projet a été développé comme un exercice d'ingénierie algorithmique pour résoudre un problème NP-difficile en changeant de paradigme mathématique.