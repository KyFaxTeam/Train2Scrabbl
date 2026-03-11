## Algorithme d'Initialisation (Explication Heuristique Mathématique)

**Objectif:** Placer un mot initial sur la grille et placer des mots supplémentaires *isolés* pour démarrer la partie de Scrabble avec une configuration initiale de mots non connectés.

**Approche Heuristique:**
1. Sélectionner aléatoirement un mot valide d'une longueur appropriée (entre 4 et 7 lettres) et le placer aléatoirement soit horizontalement soit verticalement en passant par la case centrale de la grille.
2. Immédiatement après, tenter de placer un ensemble de "mots à réviser" *sans les connecter* au mot central initialement placé. Ces mots sont placés de manière isolée sur la grille.

**Représentation Mathématique:**

1.  **Placement du Mot Central:** (Identique à la version précédente, intégrant le choix aléatoire de la direction)
    1.  **Ensemble des mots valides:** Soit $D$ l'ensemble de tous les mots valides dans le dictionnaire Scrabble.
    2.  **Ensemble des mots centraux valides:** Définissons $D_c$ comme le sous-ensemble de $D$ contenant les mots de longueur appropriée pour le mot central :
        $D_c = \{w \in D \mid 4 \leq \text{longueur}(w) \leq 7\}$
    3.  **Sélection du mot central:** Choisir aléatoirement un mot $w_c$ de l'ensemble $D_c$ :
        $w_c = \text{choix\_aléatoire}(D_c)$
    4.  **Direction de placement:** Choisir aléatoirement une direction parmi horizontale ou verticale pour le mot central :
        $\text{direction}_c = \text{choix\_aléatoire}(\{\text{HORIZONTALE}, \text{VERTICALE}\})$
    5.  **Position centrale:** Définir $pos_{centre}$ comme la coordonnée de la case centrale sur la grille.
    6.  **Position aléatoire de la lettre centrale sur le centre:** Choisir un indice aléatoire $i_c$ dans le mot $w_c$ pour positionner une de ses lettres sur la case centrale :
        $i_c = \text{entier\_aléatoire}(0, \text{longueur}(w_c) - 1)$
    7.  **Calcul de la position de départ du mot central:** Calculer la coordonnée de départ $(x_c, y_c)$ du mot central de sorte que la lettre à l'indice $i_c$ soit placée sur la case centrale, en ajustant selon la direction choisie :
        Si $\text{direction}_c = \text{VERTICALE}$:
            $x_c = pos_{centre} - i_c$
            $y_c = pos_{centre}$
        Sinon ($\text{direction}_c = \text{HORIZONTALE}$):
            $x_c = pos_{centre}$
            $y_c = pos_{centre} - i_c$
    8.  **Placement du mot central sur la grille et mise à jour du graphe:** Placer les lettres du mot $w_c$ sur la grille à partir de la position $(x_c, y_c)$ dans la direction $\text{direction}_c$, et mettre à jour le graphe de mots avec le mot central et ses informations de position.

2.  **Placement des Mots à Réviser (Isolés):**
    1.  **Entrée:** Grille $G$ contenant le mot central $w_c$, ensemble de mots à réviser $W_r$.
    2.  **Itération sur les mots à réviser:** Pour chaque mot $word_r \in W_r$ :
        a.  **Sélection aléatoire de la direction:** Choisir aléatoirement une direction $\text{direction}_r \in \{\text{HORIZONTALE}, \text{VERTICALE}\}$ pour le mot à réviser.
        b.  **Recherche aléatoire d'une position valide:** Tenter de trouver une position de départ $(x_r, y_r)$ aléatoire sur la grille pour placer $word_r$ dans la direction $\text{direction}_r$, en utilisant une fonction `trouver_position_aleatoire_valide(direction_r, word_r, grille)`. Cette fonction doit rechercher une position qui respecte les limites de la grille et n'entre pas en conflit avec des lettres déjà placées (mais *sans chercher à se connecter* à d'autres mots).
        c.  **Placement conditionnel (si position valide trouvée):** Si une position valide $(x_r, y_r)$ est trouvée :
            i.  Placer $word_r$ sur la grille $G$ à la position $(x_r, y_r)$ dans la direction $\text{direction}_r$.
            ii. Mettre à jour le graphe $Graph$ en ajoutant $word_r$ (mais *sans connexion* pour le moment).
            iii.Mettre à jour les orientations $O$ avec l'orientation de $word_r$.
            iv. Si aucune position valide n'est trouvée après plusieurs tentatives, passer au mot à réviser suivant.

**Justification Heuristique de l'Initialisation Complète:**

*   **Simplicité et Rapidité (Mot Central):** Le placement du mot central reste simple et rapide, assurant un démarrage efficace.
*   **Introduction de Mots Supplémentaires (Isolés):** Placer des mots à réviser de manière isolée permet de créer une configuration initiale plus riche en mots sur la grille, augmentant la complexité et l'intérêt du jeu dès le début.
*   **Éviter la Complexité Initiale de la Connexion:** En plaçant les mots à réviser isolément, on évite la complexité de l'algorithme de connexion lors de la phase d'initialisation. La connexion des mots est reportée à la phase de connexion dédiée, permettant de séparer clairement les responsabilités des algorithmes.

## Algorithme de Connexion (Explication Heuristique Mathématique)

**Objectif:** Connecter les mots isolés sur la grille de Scrabble en trouvant et en plaçant des "mots ponts" valides.

**Approche Heuristique:** Connecter itérativement les mots non connectés à la composante connexe principale (initialement formée autour du mot central), en priorisant les mots les plus proches de cette composante et en utilisant des mots ponts trouvés efficacement grâce à la structure de données GADDAG.

**Représentation Mathématique (Étape par Étape):**

**Entrées:**

*   $G$ : Grille de Scrabble (`Board`).
*   $W_r$ : Ensemble des mots à réviser (mots isolés à connecter).
*   $W_p$ : Ensemble des mots placés sur la grille (`mots_places`).
*   $Graph$ : Graphe de mots (`ScrabbleGraph`).
*   $O$ : Orientations des mots (dictionnaire mot -> (position, direction)).
*   $D$ : Dictionnaire de mots valides.
*   $L_s$ : Lettres d'appui (dictionnaire mot -> {lettre -> index}).
*   $L_a$ : Lettres disponibles pour former des mots ponts.
*   $GADDAG$ : Structure de données GADDAG pour la recherche efficace de mots.

**Algorithme:**

1.  **Initialisation du Graphe:** Créer des nœuds dans le graphe $Graph$ pour tous les mots dans $W_p \cup W_r$, en utilisant les orientations $O$ pour définir leur position et direction.

2.  **Identification des Mots Non Connectés:** Utiliser la fonction `Graph.get_unconnected_words()` pour identifier l'ensemble $U$ des mots non connectés à la composante connexe principale (déterminée via `UnionFind` dans le graphe). Cette fonction retourne également un dictionnaire de distances $Distances$ où $Distances[mot]$ représente la distance graphique de chaque mot non connecté au mot central.

    $U, Distances = Graph.get\_unconnected\_words()$

3.  **Priorisation des Mots Non Connectés:** Trier les mots non connectés $U$ en fonction de leur distance à la composante connexe principale (distance graphique), en utilisant les distances obtenues à l'étape précédente. Les mots les plus proches sont priorisés.

    $Sorted\_U = \text{sort}(U, \text{clé}=\lambda w: Distances.get(w, \infty))$

4.  **Itération et Connexion:** Pour chaque mot $mot_1$ dans l'ensemble trié $Sorted\_U$ :

    a.  **Recherche du Mot Connecté le Plus Proche:** Trouver un mot $mot_2$ qui est déjà connecté à la composante connexe principale et qui est le plus proche de $mot_1$ (dans le graphe ou géométriquement). Prioriser le mot central, puis les autres mots connectés.

    b.  **Vérification de la Validité Géométrique:** Calculer la séparation verticale et horizontale entre $mot_1$ et $mot_2$ en utilisant `calculate_separation()`. Vérifier avec `is_valid_word_placement()` si le placement des deux mots est géométriquement valide (distance minimale pour les mots parallèles, respect des limites du plateau). Si le placement n'est pas valide, passer au mot non connecté suivant.

    c.  **Tentative de Connexion par Mot Pont:** Si une connexion directe (intersection) n'existe pas entre $mot_1$ et $mot_2$, tenter de trouver des mots ponts en utilisant la structure GADDAG :

        $Bridge\_words = GADDAG.find\_bridge\_words(mot_1, pos_1, dir_1, mot_2, pos_2, dir_2, L_s, L_a)$

        Cette fonction recherche dans le GADDAG des mots qui peuvent servir de ponts en considérant :

        *   Les combinaisons de lettres possibles entre $mot_1$ et $mot_2$.
        *   La direction requise pour le mot pont (perpendiculaire à $mot_1$ et $mot_2$).
        *   Les lettres disponibles $L_a$.
        *   Elle génère des "squelettes" pour la méthode `gaddag.find_words_with_skeleton()`, représentant les positions des lettres de $mot_1$ et $mot_2$ dans le mot pont potentiel.

    d.  **Sélection du Meilleur Mot Pont:** Si des mots ponts sont trouvés, sélectionner le meilleur candidat $w_b$ parmi $Bridge\_words$ (par exemple, le mot le plus court).

    e.  **Placement du Mot Pont et Mise à Jour du Graphe:**

        *   Placer le mot pont $w_b$ sur la grille $G$ en utilisant `grille.placer_mot()`.
        *   Ajouter le mot pont $w_b$ au graphe $Graph$ avec `graphe.add_word()`.
        *   Déterminer le point d'intersection entre $w_b$ et $mot_1$ et entre $w_b$ et $mot_2$ (ou utiliser les lettres d'appui).
        *   Ajouter deux connexions au graphe : une entre $mot_1$ et $w_b$, et une autre entre $w_b$ et $mot_2$, en utilisant `graphe.add_connection()`.

5.  **Retour:** L'algorithme de connexion retourne `Vrai` si au moins une connexion a été établie, et `Faux` sinon.

**Justification Heuristique:**

*   **Priorisation des mots proches:** En priorisant la connexion des mots non connectés les plus proches de la composante connexe, l'algorithme cherche à étendre le réseau de mots de manière progressive et efficace.
*   **Utilisation du GADDAG:** L'emploi de la structure de données GADDAG permet de rechercher rapidement des mots ponts valides, optimisant le processus de connexion.
*   **Contraintes géométriques:** Les vérifications de validité géométrique assurent que les mots ponts placés respectent les règles du Scrabble et les contraintes spatiales du plateau.
*   **Approche itérative:** L'algorithme itératif permet de connecter progressivement plusieurs mots isolés, améliorant la connectivité globale du réseau de mots sur le plateau.

---

This explanation now correctly describes the initialization algorithm as placing the central word and then placing "mots à réviser" in isolation, and includes the connection algorithm description.
# Guide Avancé de Connexion des Mots Isolés au Scrabble

## Introduction

Ce guide détaille les stratégies pour connecter des mots isolés sur une grille de Scrabble. Un mot est "isolé" s'il n'est adjacent à aucun autre mot (ni horizontalement, ni verticalement, ni en diagonale). L'objectif est de créer des connexions valides en respectant les contraintes géométriques et les règles du Scrabble.

## I. Fondamentaux

### A. Système de Coordonnées et Terminologie

*   **Système de Coordonnées:** La grille est référencée par un système de coordonnées (ligne, colonne), avec l'origine (0, 0) située dans le coin **supérieur gauche**.
    *   Les lignes (numérotées) augmentent en descendant.
    *   Les colonnes (lettrées) augmentent en allant vers la droite.
*   **Terminologie:**
    *   **Mot Isolé:** Mot sans contact avec d'autres mots.
    *   **Mot Pont (Bridge Word):** Un mot créé pour relier deux mots isolés. Un mot pont doit contenir **au moins deux lettres**, une provenant de chacun des deux mots qu'il relie. Ces lettres doivent être sur la même ligne (pour un mot pont horizontal) ou la même colonne (pour un mot pont vertical).
    *   **Séparation Verticale:** Nombre de lignes *vides* entre deux mots horizontaux.
    *   **Séparation Horizontale:** Nombre de colonnes *vides* entre deux mots verticaux.
    *   **Décalage Horizontal (pour mots parallèles horizontaux):** Différence entre les colonnes de la *première* lettre de chaque mot.
    *   **Décalage Vertical (pour mots parallèles verticaux):** Différence entre les lignes de la *première* lettre de chaque mot.
    *   **Chevauchement:** Situation où des lettres de deux mots partagent la même case (interdit).
    *   **Point de Liaison:** Une des deux lettres d'un mot existant utilisée pour former le mot pont.

### B. Principes Clés de Connexion

1.  **Validité:** Toutes les combinaisons de lettres résultant de la connexion *doivent former des mots valides*.
2.  **Géométrie:** La distance, le décalage, et la longueur des mots sont des contraintes physiques.
3.  **Contraintes de la Grille:** Les mots doivent rester dans les limites de la grille 15x15.

## II. Stratégies de Connexion Détaillées

### A. Mots Parallèles Horizontaux

**Exemple:**

```
  A B C D E F G H I J K L M N O
1 . . . . . . . . . . . . . . .
2 . . . . . . . . . . . . . . .
3 . . . . . . . O . . . . . . .
4 . . . . M A I S O N . . . . .
5 . . . . . . . A . . . . . . .
6 . . . . P A P I E R . . . . .
7 . . . . . . . T . . . . . . .
8 . . . . . . . . . . . . . . .
9 . . . . . . . . . . . . . . .
```

*   **MAISON:** Début (4, 5), Fin (4, 10)
*   **PAPIER:** Début (6, 5), Fin (8, 10)
*   **Séparation Verticale:** 1 lignes (5)
*   **Décalage Horizontal:** 0 colonnes

*   Le mot pont **"OSAIT"** utilise:
    * Le 'O' de MAISON
    * Le 'I' de PAPIER
*   Ces lettres sont sur la même colonne (H)

**Procédure Étape par Étape:**

1.  **Analyse Préliminaire:**
    *   Calculer la séparation verticale et le décalage horizontal.
    *   Identifier les paires de lettres potentiellement utilisables (une de chaque mot).
    *   Évaluer la longueur minimale du mot pont.

2.  **Choix des Points de Liaison:**
    *   Sélectionner une lettre du premier mot ("MAISON") et une lettre du second mot ("PAPIER").
    *   Ces lettres doivent être sur la même colonne ou ligne.
    *   Exemple: Le 'O' de "MAISON" et le 'I' de "PAPIER" sont dans la colonne H.

3.  **Construction du Mot Pont:**
    *   Trouver un mot qui utilise les deux lettres sélectionnées.
    *   Le mot doit respecter les contraintes de la grille.
    *   Exemple: "OSAIT" utilise le 'O' et le 'I'.

4.  **Validation:**
    *   Vérifier que tous les mots formés sont valides.
    *   S'assurer que le placement respecte les règles du Scrabble.

5.  **Itération:**
    *   Si la connexion directe n'est pas possible, itérer :
        *   Changer le point de liaison.
        *   Changer le mot pont vertical.
        *   Envisager plusieurs mots ponts.

### B. Mots Parallèles Verticaux

**Exemple:**

```
  A B C D E F G H I J K L M N O
1 . . . . . . . . . . . . . . .
2 . . . . . . . . . . . . . . .
3 . . . . M . . . P . . . . . .
4 . . . . A . . . A . . . . . .
5 . . . D I R A I T . . . . . .
6 . . . . S . . . I . . . . . .
7 . . . . O . . . E . . . . . .
8 . . . . N . . . R . . . . . .
```

*   **MAISON:** Vertical, début (3, 4)
*   **PATIER:** Vertical, début (3, 8)
*   Le mot pont **"DIRAIT"** utilise:
    * Le 'I' de MAISON
    * Le 'T' de PATIER
*   Ces lettres sont sur la même ligne (5)

### C. Mots Perpendiculaires

**Exemple:**

```
   A B C D E F G H I J K L M N O
 1 . . . . . . . . . . . . . . .
 2 . . . . . . . . . . . . . . .
 3 . . . . . . M . . . . . . . .
 4 . . . . M A I S O N . . . . .
 5 . . . . . . L . . . . . . . .
 6 . . . . . . I . . . . . . . .
 7 . . . . . . T . V . . . . . .
 8 . . . . . P A P I E R . . . .
 9 . . . . . . . . O . . . . . .
10 . . . . . . . . L . . . . . .
11 . . . . . . . . E . . . . . .
12 . . . . . . . . E . . . . . .
13 . . . . . . . . . . . . . . .
```

*   **MAISON:** Début (4, 5), Fin (4, 10) Direction: Horizontal
*   **VIOLEE:** Début (7, 9), Fin (12, 9) Direction: Vertical
*   Le double pont MILITA-PAPIER utilise:
    * Le 'I' de MAISON
    * Le 'I' de VIOLEE
*   Un mot est d'abord formé (MILITA) pour revenir dans le sens vertical de VIOLEE en s'assurant d'avoir un décalage horizontal de 0
*   Puis le second PAPIER est formé comme tout bridge word normal entre deux mots parallèles (MILITA et VIOLEE)

**Procédure pour les Mots Perpendiculaires:**

1.  **Choix du Mot de Référence:** celui offrant le plus d'options.

2.  **Identification des Points de Contact Potentiels:** Examiner chaque lettre du mot de référence.

3.  **Construction du Mot Parallèle et Juxtaposé:**
    *   Trouver un mot parallèle au mot de référence, utilisant ses lettres.
    *   Ce mot doit croiser le second mot.
    *   Le croisement doit former un mot valide.

4.  **Construction du deuxième Mot Pont:**
    *   Trouver un mot qui utilise deux lettres, une de chaque mot.
    *   S'assurer que le placement respecte les contraintes de la grille.
    *   Vérifier que tous les mots formés sont valides.

## III. Validation

*   **Vérification Complète:** Vérifier *tous* les mots formés.
*   **Respect des Règles:** S'assurer du placement correct et des limites de la grille.

Ce guide fournit une méthodologie pour connecter des mots isolés au Scrabble. La pratique et l'analyse des situations sont essentielles pour maîtriser cette compétence.
L'algorithme GADDAG (Generalized Directed Acyclic Word Graph) est une structure de données et un algorithme conçus pour générer rapidement tous les mouvements possibles dans le jeu de Scrabble. Il est basé sur une représentation du lexique qui permet une exploration bidirectionnelle des mots, contrairement à l'algorithme DAWG (Directed Acyclic Word Graph) qui fonctionne de manière linéaire, de gauche à droite. Voici une description détaillée de son implémentation dans le contexte du Scrabble :

**1. Représentation du Lexique avec un GADDAG**
*   Le GADDAG est construit à partir d'un lexique de mots, et contrairement au DAWG, il encode un chemin bidirectionnel à partir de chaque lettre de chaque mot.
*   Chaque mot du lexique est représenté plusieurs fois dans le GADDAG, une fois pour chaque lettre du mot. Par exemple, le mot "CARE" aura quatre représentations : "CeARE", "ACeRE", "RACeE" et "ERAC". Le caractère "e" est un délimiteur.
*   Le GADDAG est un graphe acyclique dirigé où les arcs sont étiquetés par des lettres et des ensembles de lettres. Les ensembles de lettres indiquent les lettres qui, si elles sont rencontrées ensuite, forment un mot.
*   Les états du GADDAG ne sont pas explicitement marqués comme finaux ou non finaux. Au lieu de cela, les ensembles de lettres sur les arcs indiquent si un chemin donné forme un mot.

**2. Construction du GADDAG**
*   Pour chaque mot du lexique, le GADDAG crée des chemins en insérant un caractère délimiteur « e » à chaque position possible dans le mot. Cela crée une représentation bidirectionnelle qui facilite la génération de mots à partir de n'importe quelle lettre.
*   Le GADDAG est semi-minimisé lors de sa construction en fusionnant les nœuds qui mènent aux mêmes ensembles de mots possibles. Cela réduit la taille du graphe sans nécessiter une étape de minimisation complète, ce qui accélère la construction du graphe.
*  Dans la semi-minimisation, si `xy = vw`, alors `{z | REV(x)eyz is a path} = {z | REV(v)ewz is a path}`. Cela signifie que le nœud que `REV(x)ey` mène fusionne avec le nœud que `REV(v)ew` mène à.
*   L'algorithme de construction fusionne tous les états menant à des ensembles de mots équivalents, ce qui réduit considérablement la taille du graphe.

**3. Génération des Mouvements**
*   La génération de mouvements est effectuée par une recherche en profondeur avec retour arrière à travers le GADDAG. L'algorithme parcourt le graphe en utilisant les lettres disponibles du chevalet du joueur et en respectant les contraintes du plateau.
*   L'algorithme `Gen(0,NULL,RACK,INIT)` est appelé, où `INIT` est un arc vers l'état initial du GADDAG avec un ensemble de lettres null. La procédure `Gen` est indépendante de la direction.
*   Les tuiles sont placées vers la gauche ou la droite à partir de la case d'ancrage. Une fois le délimiteur « e » rencontré, la direction change de gauche à droite.
*   Une case d'ancrage est une case où un nouveau mot peut être relié à des lettres déjà présentes sur le plateau. L'algorithme GADDAG réduit le nombre de cases d'ancrage nécessaires, car il n'est pas nécessaire de générer des mouvements à partir de toutes les cases d'ancrage internes d'une séquence contiguë de cases d'ancrage.
*   L'algorithme de génération de mouvement explore toutes les manières possibles de jouer un mot sur le plateau en « accrochant » des lettres du chevalet à des lettres existantes, en respectant la structure du GADDAG et les contraintes du plateau.
*   L'algorithme vérifie si la lettre à placer est autorisée sur la case et si la combinaison de lettres forme un mot valide du lexique.

**4. Avantages du GADDAG**
*   **Vitesse** : L'algorithme GADDAG génère des mouvements plus de deux fois plus vite que l'algorithme DAWG. Cela est dû à sa capacité à traiter les préfixes comme des suffixes et à éliminer les préfixes qui ne mènent pas à des mots valides.
*   **Déterminisme** : Le GADDAG réduit le non-déterminisme dans la génération de préfixes présent dans l'algorithme DAWG. Les préfixes sont joués de la même manière que les suffixes, ce qui permet d'appliquer les contraintes du plateau plus tôt.
*   **Ensembles Croisés** : L'algorithme GADDAG permet de calculer les ensembles croisés gauche et droite de manière déterministe et simultanée, ce qui n'est pas le cas avec le DAWG.
*   **Nombre réduit de cases d'ancrage** : Le GADDAG réduit le nombre de cases d'ancrage nécessaires, ce qui diminue le nombre de calculs requis pour la génération des mouvements.

**5. Optimisations**
*   **Minimisation** : Le GADDAG est minimisé pendant sa construction pour réduire la taille de la structure.
*   **Représentation Compressée** : Le GADDAG peut être représenté sous forme compressée pour réduire l'utilisation de la mémoire. Cependant, la représentation compressée peut ralentir légèrement le temps de recherche des arcs par rapport à une représentation non compressée.
*   **Ensembles de lettres** : L'utilisation d'ensembles de lettres au lieu d'états finaux explicites permet de fusionner plus d'états lors de la minimisation.

**6. Gestion des Blanks**
*   L'algorithme GADDAG prend en compte les tuiles blanches (blanks) qui peuvent représenter n'importe quelle lettre.
*   La présence de blancs augmente le nombre de mouvements possibles, mais le GADDAG est plus rapide que le DAWG pour traiter les mouvements avec des blancs.

**7. Performances**
*   L'algorithme GADDAG est plus rapide que l'algorithme DAWG. Il traverse moins d'arcs et atteint moins d'impasses avant de détecter les impasses.
*   Les temps CPU sont plus rapides avec le GADDAG qu'avec le DAWG pour la génération de mouvements. L'algorithme GADDAG traverse environ 22 000 arcs par seconde. Cependant, le GADDAG traverse le même nombre d'arcs pour générer cinq mouvements que le DAWG pour générer deux mouvements.

En résumé, l'algorithme GADDAG est une approche efficace pour générer rapidement tous les mouvements possibles au Scrabble grâce à sa structure bidirectionnelle, sa minimisation lors de la construction et sa gestion efficace des ensembles de lettres et des contraintes du plateau. Il est préférable au DAWG en termes de vitesse, bien qu'il nécessite plus de mémoire.
