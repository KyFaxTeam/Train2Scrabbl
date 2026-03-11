# Roadmap : Natural Flow Framework (NFF)

**Statut** : Vision future — pas nécessaire maintenant  
**Date** : 20 juillet 2025

---

## Contexte

L'algorithme Natural Flow actuel (Mode Discovery) est pleinement opérationnel avec un taux de succès de 100% et un score de naturalité moyen de ~184. Cependant, l'analyse critique a révélé que le mode actuel ne couvre qu'une des cinq compétences d'un champion de Scrabble.

### Les 5 compétences d'un champion

| Compétence | Couverture actuelle |
|---|---|
| 1. Vocabulaire (connaître les mots) | ✅ Mode Discovery |
| 2. Board Vision (lire le plateau) | ❌ Non couvert |
| 3. Scoring Optimal (maximiser les points) | ❌ Non couvert |
| 4. Rack Management (gestion du chevalet) | ❌ Non couvert |
| 5. Endgame (fin de partie, sac connu) | ❌ Non couvert |

---

## Architecture proposée : 4 modes

### Mode 1 — Discovery (actuel, opérationnel)

**Objectif** : Apprendre des mots nouveaux en les découvrant sur une grille naturelle.

- Paradigme : "JOUABLE pas PRÉSENT"
- 1 grille = 1 mot cible = 1 objectif pédagogique
- Grilles naturelles (~20% densité, 6-8 mots)
- Pipeline : Anchor → Breathe → Stage

**Statut** : ✅ Implémenté et testé

---

### Mode 2 — Challenge

**Objectif** : Trouver le bon mot parmi des distracteurs sur une grille plus riche.

**Différences avec Discovery** :
- Grilles plus denses (~30-40% densité, 10-15 mots)
- Présence de distracteurs (placements valides mais sous-optimaux)
- Le joueur doit identifier LE placement optimal
- Score du joueur comparé au score optimal

**Compétences travaillées** : Board Vision + Scoring Optimal

**Implémentation envisagée** :
- Réutiliser la phase Anchor et Breathe avec `profondeur_respiration` plus élevée (10-15)
- Ajouter une phase "Distract" qui génère 2-3 placements alternatifs valides
- Scoring comparatif : afficher le % du score optimal

---

### Mode 3 — Arena

**Objectif** : Reproduire des situations mid-game réalistes pour entraîner la lecture complète du plateau.

**Différences avec les autres modes** :
- Grilles très denses (~50-60% densité, 15-25 mots)
- Chevalet réaliste (7 lettres aléatoires pondérées par fréquence)
- Le joueur doit trouver les 3 meilleurs coups
- Pas de mot cible prédéfini — le joueur explore

**Compétences travaillées** : Board Vision + Scoring + Rack Management

**Implémentation envisagée** :
- Générer une grille mid-game complète (replay de parties réelles ou simulation Monte Carlo)
- Utiliser le `MoveGenerator` existant pour calculer tous les placements possibles
- Classer par score et présenter le top-3 comme objectif

---

### Mode 4 — Endgame

**Objectif** : Entraîner les fins de partie avec sac connu.

**Différences** :
- Grille quasi-complète (~70-80% densité)
- Sac de lettres restant connu (2-10 lettres)
- Le joueur doit maximiser le différentiel sur 2-3 tours
- Intègre la stratégie défensive (bloquer l'adversaire)

**Compétences travaillées** : Endgame + Scoring + Board Vision

**Implémentation envisagée** :
- Rejouer les 3-5 derniers tours de parties réelles archivées
- Ou simuler des fins de partie via Monte Carlo
- Arbre de recherche minimax simplifié pour l'évaluation

---

## Progression de difficulté

```
Discovery → Challenge → Arena → Endgame
   (1)         (2)        (3)       (4)
  Facile    Intermédiaire  Avancé   Expert

Densité :  20%      35%       55%      75%
Mots :     6-8     10-15     15-25    20-30+
Objectif : 1 mot   1 optimal  Top-3   Minimax
```

---

## Priorités et dépendances

| Mode | Priorité | Dépendance | Effort estimé |
|---|---|---|---|
| Discovery | ✅ Fait | — | — |
| Challenge | P1 | `profondeur_respiration` paramétrable | Moyen |
| Arena | P2 | Base de parties réelles ou simulateur | Élevé |
| Endgame | P3 | Arena + arbre minimax | Élevé |

### Autres améliorations transversales (P2-P3)

- **FSRS (Free Spaced Repetition Scheduler)** : système de répétition espacée pour le tracking de la progression
- **Gamification** : XP, streaks, niveaux, badges
- **Multi-solution** : afficher toutes les solutions valides avec leurs scores
- **Difficulté adaptative** : ajuster automatiquement le mode selon le niveau du joueur
- **Export/Import** : partager des puzzles entre joueurs

---

## Notes techniques

- Le GADDAG et le `MoveGenerator` existants sont réutilisables pour tous les modes
- Le `ScoreCalculator` est prêt pour le scoring comparatif
- L'API FastAPI peut exposer les modes via des endpoints séparés (`/api/training/discovery`, `/api/training/challenge`, etc.)
- Le frontend dispose déjà d'une architecture Arena/Training qui peut accueillir les nouveaux modes
