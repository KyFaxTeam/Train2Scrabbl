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
