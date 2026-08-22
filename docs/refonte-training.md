# Refonte du mode Entraînement — brief de travail

> Ce fichier est un **prompt** : à coller tel quel en début de session pour lancer
> la refonte. Il contient l'état vérifié du code au 22/08/2026 pour qu'aucune
> session n'ait à re-diagnostiquer ce qui l'est déjà.

---

## Le prompt

Tu travailles sur le mode **Entraînement** de Train2Scrabbl (`/training`), une
application React + Vite déployée sur GitHub Pages, sans backend. Le moteur de
jeu (GADDAG, génération de plateaux) tourne dans un Web Worker côté client.

Ta mission : **repenser ce mode sur trois axes — logique pédagogique, efficacité
technique, expérience — puis implémenter ce que tu auras décidé.**

Ne commence pas par coder. Commence par **mesurer et décider**, en t'appuyant sur
l'état ci-dessous, puis expose tes arbitrages avant de les appliquer. Chaque
décision doit s'appuyer sur un chiffre ou sur une raison pédagogique explicite,
jamais sur une préférence esthétique.

### Contraintes non négociables

- **Pas de backend.** L'hébergement est GitHub Pages : fichiers statiques, aucun
  contrôle sur les en-têtes HTTP (`max-age=600` imposé partout). Une API
  distante a déjà été écartée, mesures à l'appui : la génération d'un exercice
  coûte 29 ms en local, un aller-retour réseau coûterait plus cher que le calcul.
  Si tu veux rouvrir ce débat, apporte des mesures.
- **Le mode doit rester jouable hors ligne** une fois les données en cache.
- **Aucun échec silencieux.** Toute branche qui peut échouer doit soit afficher
  un message actionnable, soit lever. C'est la règle qui a été violée par les
  trois bugs corrigés ci-dessous.

### État vérifié du code (ne pas re-diagnostiquer)

**Ce qui vient d'être réparé** (commit `10470ab`, en production) :

1. `WorkerClient` résolvait `{ payload, timeMs }` quand `trainingService` lisait
   `const { result } = …`. Tous les exercices étaient donc rejetés, le lot
   revenait vide, et un lot vide ne levait aucune erreur : la page restait sur
   « Chargement… » indéfiniment.
2. Le worker construisait son `WordPool` à partir de `scrabble_dict.txt`, qui
   n'est pas une liste de mots mais un index de tirages (`AEINOTU`, `-AOUTIEN`,
   `+Q ATONIQUE`). Aucune ligne ne faisant 2 à 6 caractères, `getMotsCourts()`
   et `getMotsMoyens()` renvoyaient des listes vides, la phase de « respiration »
   de `NaturalFlow` ne posait aucun mot, et l'exercice se réduisait à **une seule
   lettre** sur un plateau nu. Corrigé par un vivier dédié
   (`scripts/export_word_pool.py` → `public/data/word_pool.txt`, 61 538 mots de
   2 à 7 lettres, 136 Ko gzip). Mesure après : 8 à 39 jetons sur le plateau,
   3 exercices en 247 ms.
3. Aucun `worker.onerror`, aucun délai maximal : un worker mort laissait la
   promesse d'init pendante à vie. Corrigé, avec barre de progression et mise en
   cache du GADDAG dans le Cache Storage.

**Chiffres de référence mesurés en production :**

| | |
|---|---|
| `gaddag.bin` | 5,74 Mo bruts / **3,23 Mo transférés** / **~18 s** |
| `word_pool.txt` | 437 Ko bruts / ~136 Ko gzip |
| Génération d'un exercice | **29 ms** |
| Lot de 3 exercices | 247 ms |
| Cache-Control imposé par Pages | `max-age=600`, non modifiable |

### Axe 1 — La logique pédagogique (le plus important)

L'exercice actuel est : *un plateau réaliste + un chevalet contenant exactement
les 7 lettres de la solution → place le mot au bon endroit.* Il est valable
(c'est l'exercice classique du collage), mais trois choses ne tiennent pas :

- **Le chevalet donne la réponse.** Le joueur sait qu'un scrabble existe et avec
  quelles lettres. En partie réelle, la difficulté est d'abord de *voir* qu'il y
  en a un. Faut-il ajouter des lettres parasites ? Proposer des tirages sans
  solution ? Cela change la nature de l'exercice — argumente.
- **La validation est un test de chaîne, pas un test de coup.** Lis
  `checkAnswer` dans `TrainingPage.tsx` : elle trie les jetons posés par ligne
  puis colonne, les concatène et compare au mot attendu. Elle ne vérifie **ni**
  la contiguïté, **ni** l'alignement sur une seule ligne, **ni** le raccordement
  au plateau existant, **ni** la validité des mots transversaux formés. On peut
  éparpiller les sept jetons n'importe où dans l'ordre de lecture et décrocher
  les confettis. Le moteur expose déjà `WordValidator` : décide du niveau
  d'exigence (placement exact attendu ? tout coup légal formant le mot ? tout
  coup légal tout court ?) et implémente-le.
- **`metadata.naturelScore` vaut toujours `1`.** Rien ne mesure le réalisme du
  plateau produit. Soit on le calcule vraiment (densité, connexité, longueur
  moyenne des mots, plausibilité des zones ouvertes), soit on retire le champ —
  mais un score constant qui prétend mesurer quelque chose est pire que rien.

Questions à trancher explicitement : qu'est-ce que ce mode entraîne exactement,
et en quoi diffère-t-il du **Réflexe** (monde Morphologie) et du **mode Étude** ?
Quelle progression de difficulté ? Comment les trois modes se répartissent-ils
le travail du joueur ?

### Axe 2 — L'efficacité

- Le GADDAG (3,2 Mo transférés, ~18 s) reste le seul vrai poids. Il est
  désormais mis en cache après la première visite. Peut-on faire mieux **sur le
  format lui-même** (encodage plus compact, DAWG plutôt que GADDAG, chargement
  partiel) ? Chiffre le gain avant de te lancer.
- Le bundle principal fait 715 Ko décodés / 241 Ko gzip et embarque le moteur de
  jeu **alors que l'Arène ne s'en sert pas**. Un découpage par route est
  probablement le meilleur rapport gain/effort de tout le projet — vérifie-le.
- `generateOfflineBatch` génère les 5 exercices **en série** avant d'afficher
  quoi que ce soit. Générer le premier, l'afficher, puis préparer les suivants
  en fond diviserait le temps perçu.
- `WordPool.getRandomSample` fait `[...arr].sort(() => 0.5 - Math.random())` :
  tri complet d'un tableau de plusieurs milliers d'éléments à chaque appel, pour
  n'en garder que 50 à 100, et le mélange obtenu est biaisé. Un Fisher–Yates
  partiel fait le même travail correctement.

### Axe 3 — L'expérience

- Que voit le joueur pendant les ~18 s de premier chargement ? (Une barre de
  progression existe maintenant — suffit-elle ?)
- Le plateau 15×15 sur un écran de 375 px : la grille est-elle lisible, les
  jetons assez grands, le glisser-déposer tactile fiable ? Vérifie-le
  réellement à 375 px, ne le suppose pas.
- Après validation : le joueur comprend-il *pourquoi* c'était faux ? Voir la
  bonne réponse suffit-il, ou faut-il montrer le coup sur le plateau ?
- Un mode qui s'appelle « Entraînement » mais dont l'en-tête affiche « Arena »
  (ligne ~220 de `TrainingPage.tsx`) : cohérence du vocabulaire dans toute
  l'application.

### Méthode attendue

1. Lis le code concerné : `src/pages/TrainingPage.tsx`,
   `src/services/trainingService.ts`, `src/engine/WorkerClient.ts`,
   `src/engine/engine.worker.ts`, `src/engine/modules/NaturalFlow.ts`,
   `src/engine/services/WordPool.ts`, `src/engine/services/WordValidator.ts`.
2. **Mesure avant de conclure** : lance l'application, génère de vrais
   exercices, chronomètre, inspecte les plateaux produits. Le piège de ce module
   est précisément que tout « avait l'air » de marcher.
3. Présente tes arbitrages par axe, avec pour chacun ce que tu changes, ce que
   tu ne changes pas, et pourquoi.
4. Implémente, vérifie dans le navigateur à 375 px **et** en desktop, puis
   déploie.

### Attention particulière

Les fichiers du moteur portent `// @ts-nocheck` en première ligne
(`Board.ts`, `NaturalFlow.ts`, `MoveGenerator.ts`, `ScoreCalculator.ts`,
`engine.worker.ts`, `trainingService.ts`). **Ni `tsc` ni le build ne vérifient
quoi que ce soit dans ces fichiers.** Une variable supprimée mais encore lue y
passe le build sans un mot et explose à l'exécution — c'est déjà arrivé. Si tu y
touches, retire le `@ts-nocheck` et corrige les erreurs, ou vérifie chaque
identifiant à la main.

---

## Ce qui a été fait — 22/08/2026

> Section ajoutée après exécution du brief ci-dessus. Elle remplace l'état
> « vérifié » du haut là où les mesures l'ont contredit : ne pas re-diagnostiquer.

### Ce que le brief disait de faux

- **La génération ne coûtait pas 29 ms mais 201 ms** (médiane 207, p95 397 sur
  40 exercices, banc Node sur le chemin de code du worker).
- **Le moteur n'était pas dans le bundle principal** : Vite sort déjà le worker
  en morceau séparé (6 Ko gzip). Le poids venait de `recharts` + `d3-*`
  (~75 Ko gzip), utilisés par les seules pages de statistiques.
- **Le GADDAG ne servait à rien.** En dehors de `MoveGenerator` — cassé et
  jamais appelé — la seule opération du moteur sur lui était `contains()`.

### Deux défauts non listés par le brief, et qui dominaient tout

1. **`validatePlacementComplete` ne prolongeait pas le mot principal.** Poser
   `ADA` après `FOUR` : mot principal `ADA` (valide), transversaux (aucun),
   connexité (OK) → placement accepté, alors que le coup forme `FOURADA`.
   Mesuré : **18 plateaux sur 40 contenaient un mot inexistant**, et
   **3 exercices sur 40 avaient une solution attendue illégale** — impossible à
   trouver puisqu'elle n'existe pas.
2. **La clé de répétition espacée était mal formée.** `updateAfterTest` découpe
   `tirage-lettre-mot` en trois champs ; l'Entraînement n'en écrivait que deux
   (`TIRAGE-MOT`), donc le mot enregistré était la chaîne vide. Chaque révision
   qui revenait demandait au moteur de construire un exercice pour `''`, qui
   échouait quinze fois puis disparaissait sans un mot. Clé désormais :
   `TIRAGE--MOT` (champ d'extension vide, mais présent).

### Décisions

**Axe 1 — pédagogie.** Le mode entraîne *le collage* : transformer un mot connu
en coup légal et bien placé. L'Arène apprend les tirages, le Réflexe entraîne le
déclenchement ; l'Entraînement, lui, se joue sur le plateau.

- Le chevalet garde les sept lettres de la solution : c'est l'exercice classique
  du collage, et la recherche du mot est le travail de l'Arène.
- La validation est devenue un **arbitrage de coup** (`MoveChecker`) :
  alignement, contiguïté, raccordement au plateau, mot principal prolongé, mots
  transversaux, score. **Tout collage légal du mot est accepté** — la médiane
  mesurée est de 3 collages légaux par exercice, exiger une position précise
  aurait refusé la plupart des bonnes réponses.
- Un coup illégal n'est plus une mauvaise réponse : il est **refusé avec sa
  raison**, sans rien inscrire dans la répétition espacée.
- `naturelScore` (constant à 1) est supprimé. Les métadonnées sont désormais
  mesurées : jetons sur le plateau, mots réellement lisibles, nombre de collages
  légaux, difficulté déduite de ce nombre. Un plateau de moins de 12 jetons est
  rejeté et régénéré.

**Axe 2 — efficacité** (tout est mesuré) :

| | avant | après |
|---|---|---|
| Génération d'un exercice | 201 ms | **35 ms** (médiane 25) |
| Données du moteur, transférées | 3,23 Mo + 136 Ko | **235 Ko** |
| Dictionnaire imposé à `/training` | 757 Ko gzip | **0** |
| JS du premier écran | 244 Ko gzip | **121 Ko gzip** |
| Plateaux avec un mot inexistant | 18/40 | **0/40** |
| Solutions illégales | 3/40 | **0/40** |

- `WordPool.getRandomSample` représentait **84 % du temps de génération**
  (8 appels, ~21 ms chacun). Fisher–Yates partiel : 0,04 ms, et non biaisé.
- `gaddag.bin` est remplacé par `public/data/lexicon.txt` : l'ODS8 ≤ 15 lettres,
  trié et front-codé, 1 534 Ko bruts / **235 Ko gzip** (`scripts/export_lexicon.py`).
  Interrogé par dichotomie dans un bloc de texte (≈ 6,5 Mo de mémoire, contre
  85 Mo pour un `Set<string>`). `word_pool.txt` disparaît : le vivier de décor se
  découpe dans le lexique.
- `/training` ne lit plus `scrabble_dict.txt` : cet index contient exactement
  32 230 solutions de sept lettres, soit exactement les 32 230 mots de sept
  lettres de l'ODS8, et un tirage n'est que le mot trié. Le `<link rel="preload">`
  du dictionnaire est devenu conditionnel à la route.
- Découpage par route (`React.lazy`) : `recharts` et `d3-*` partent dans le
  morceau des statistiques.
- Le lot s'affiche **au premier exercice prêt**, les suivants se calculent
  pendant que le joueur cherche.

**Axe 3 — expérience :**

- En-tête « Arena » → « Entraînement », plus un badge de difficulté.
- Plateau fluide : à 375 px les cases passent de 17,3 px (grille dessinée en
  fixe puis réduite par `scale-[0.78]`) à **22,2 px**, sans débordement
  horizontal ; 31,9 px en desktop. Les tailles de texte suivent en `cqw`.
- Après une erreur, **le coup attendu est montré en vert sur le plateau** ; la
  fenêtre de résultat ne saute plus à l'exercice suivant.
- Le débriefing donne le score du coup joué **et** celui du meilleur collage,
  ainsi que tous les mots formés.
- « Voir la solution » remplace « Passer » et enregistre un échec — ne pas
  trouver est une information pour la répétition espacée.

### Supprimé

`src/engine/services/MoveGenerator.ts` (cassé : `getTransition(node, char)`
recevait une chaîne là où la signature attend un code, `getTransitions()`
renvoyait un tableau sur lequel il appelait `.keys()`), `models/Gaddag.ts`,
`models/Rack.ts`, `public/data/gaddag.bin`, `public/data/word_pool.txt`.
Le générateur de coups reste à réécrire si le besoin revient — il n'a jamais
fonctionné.

### `@ts-nocheck`

Retiré de **tous** les fichiers du moteur (`Board`, `NaturalFlow`,
`ScoreCalculator`, `engine.worker`, `trainingService`). `tsc -b` et `eslint`
passent sans erreur sur ces fichiers.
