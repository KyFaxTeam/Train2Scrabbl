# -*- coding: utf-8 -*-
"""
Classement des affixes lexicaux pour l'entrainement Scrabble (ODS8).

v2 - corrige trois defauts methodologiques de la v1 :

  1. MATCHING NAIF -> le pattern 'R' de la famille "RE- / RA-" capturait les
     2492 mots commencant par R (RHENIUM, RHETEUR...), soit 659 faux positifs
     purs. On valide desormais chaque decomposition contre l'ODS8 complet.

  2. SCORE SATURE -> l'ancien ROI etait `min(100, ...)`. Les trois premiers
     prefixes sortaient tous a 100.0 : la metrique perdait tout pouvoir
     discriminant exactement la ou on en a besoin. Le score v2 est normalise
     par rapport au maximum observe, donc jamais clippe.

  3. UNE SEULE DIMENSION -> la couverture brute confond "le motif est
     improductif" et "les lettres sont rares". -EUX finissait 26e a cause du X
     unique du sac, alors que le jour ou on a E+U+X le motif est en or.
     On separe donc DECLENCHEMENT (a quelle frequence on a les lettres) et
     FIABILITE (quand on les a, est-ce que ca paie).

Trois metriques independantes, chacune repond a une question de joueur :

  PORTEE      couverture des tirages, ponderee par la probabilite du sac.
              -> "a quelle frequence ce motif va-t-il concerner mes tirages ?"

  FIABILITE   P(une solution appartient a la famille | le tirage permet de
              tenter au moins un membre de la famille).
              -> "quand j'ai les lettres, est-ce que le reflexe paie ?"
                 C'est ce qui transforme une intuition en automatisme.

  LEVIER      nombre de couples (W, W+S) tous deux valides dans l'ODS8.
              -> "combien de mots UNE regle me debloque-t-elle ?"
                 C'est le retour sur investissement memoriel.

Deux lectures d'un affixe, volontairement separees :
  MOTIF   = simple terminaison (heuristique de chevalet : "je tente -EUR")
  CROCHET = decomposition validee W + S, les deux dans l'ODS8
            (jeu sur plateau : je connais W, donc W+S existe)

Usage :
  py scripts/lexical_morphology_ranking.py
  py scripts/lexical_morphology_ranking.py --include-verbal

Regeneration complete des trois artefacts consommes par l'application
(a relancer des que SUFFIX_FAMILIES ou PREFIX_FAMILIES change) :

  py scripts/lexical_morphology_ranking.py       --json   data/morphology_ranking.json       --ts     frontend_new/src/data/morphologyFamilies.ts       --drills frontend_new/public/data/morphology_drills.json
"""

import argparse
import json
import math
import random
import re
import sys
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# CONSTANTES DU SAC
# ---------------------------------------------------------------------------

BAG = {
    'E': 15, 'A': 9, 'I': 8, 'N': 6, 'O': 6, 'R': 6, 'S': 6, 'T': 6, 'U': 6, 'L': 5,
    'D': 3, 'M': 3, 'G': 2, 'B': 2, 'C': 2, 'P': 2, 'F': 2, 'H': 2, 'V': 2,
    'J': 1, 'Q': 1, 'K': 1, 'W': 1, 'X': 1, 'Y': 1, 'Z': 1,
}
TOTAL_TILES = sum(BAG.values())          # 100 (jokers exclus)
DRAWS_TOTAL = math.comb(TOTAL_TILES, 7)  # tirages de 7 lettres possibles

MIN_STEM = 3   # longueur minimale d'un radical pour valider un crochet

ODS_PATH = "data/ods8.txt"
DICT_PATH = "frontend_new/public/data/scrabble_dict.txt"

# ---------------------------------------------------------------------------
# FAMILLES D'AFFIXES
#
# Chaque famille = (libelle, role, [patterns]). Le premier pattern est le
# pattern canonique : c'est lui qui sert au calcul de FIABILITE, parce que
# c'est la forme que le joueur vise mentalement ("je tente EUR", pas "EUSES").
# ---------------------------------------------------------------------------

SUFFIX_FAMILIES = [
    ("EUR / EUSE",   "Agent, metier, machine",        ['EUR', 'EURS', 'EUSE', 'EUSES']),
    ("IER / IERE",   "Metier, arbre, contenant",      ['IER', 'IERS', 'IERE', 'IERES']),
    ("IEN / IENNE",  "Origine, domaine, adjectif",    ['IEN', 'IENS', 'IENNE', 'IENNES']),
    ("AGE",          "Action, resultat, collectif",   ['AGE', 'AGES']),
    ("URE",          "Matiere, resultat d'action",    ['URE', 'URES']),
    ("ISTE",         "Adepte, profession",            ['ISTE', 'ISTES']),
    ("AL / AUX",     "Adjectif de relation",          ['AL', 'AUX', 'ALE', 'ALES']),
    ("ERIE",         "Activite, lieu, qualite",       ['ERIE', 'ERIES']),
    ("AIRE",         "Fonction, relatif a",           ['AIRE', 'AIRES']),
    ("ETTE / OTTE",  "Diminutif feminin",             ['ETTE', 'ETTES', 'OTTE', 'OTTES']),
    ("ELLE / ELET",  "Diminutif",                     ['ELLE', 'ELLES', 'ELET', 'ELETS']),
    ("AIN / AINE",   "Origine, collectif",            ['AIN', 'AINS', 'AINE', 'AINES']),
    ("IN / INE",     "Diminutif, matiere, chimie",    ['IN', 'INS', 'INE', 'INES']),
    ("OIS / OISE",   "Gentile, origine",              ['OIS', 'OISE', 'OISES']),
    ("ISME",         "Courant, doctrine, etat",       ['ISME', 'ISMES']),
    ("IQUE",         "Science, propriete",            ['IQUE', 'IQUES']),
    ("ABLE / IBLE",  "Possibilite, capacite",         ['ABLE', 'ABLES', 'IBLE', 'IBLES']),
    ("ARD / ARDE",   "Pejoratif, caracteristique",    ['ARD', 'ARDS', 'ARDE', 'ARDES']),
    ("EUX",          "Propriete, caracteristique",    ['EUX']),
    ("OIR / OIRE",   "Instrument, lieu",              ['OIR', 'OIRS', 'OIRE', 'OIRES']),
    ("TION / SION",  "Nom d'action deverbal",         ['TION', 'TIONS', 'SION', 'SIONS']),
    ("MENT",         "Nom d'action, adverbe",         ['MENT', 'MENTS']),
    ("IDE",          "Mineral, chimie, adjectif",     ['IDE', 'IDES']),
    ("ANCE / ENCE",  "Action, etat, propriete",       ['ANCE', 'ANCES', 'ENCE', 'ENCES']),
    ("ITE / ITUDE",  "Qualite abstraite",             ['ITE', 'ITES', 'ITUDE', 'ITUDES']),
    ("ESSE",         "Qualite abstraite, feminin",    ['ESSE', 'ESSES']),
    ("AUD / AUDE",   "Pejoratif, caractere",          ['AUD', 'AUDS', 'AUDE', 'AUDES']),
    ("EAU / EAUX",   "Diminutif, objet",              ['EAU', 'EAUX']),
    ("ADE",          "Action, produit",               ['ADE', 'ADES']),
    ("EL / ELS",     "Adjectif de relation",          ['EL', 'ELS']),
]

# Desinences verbales : hors perimetre par defaut (choix assume - on classe
# des familles LEXICALES). Activables via --include-verbal pour comparer.
VERBAL_FAMILIES = [
    ("ERAIT / ERAIS", "Conditionnel present",      ['ERAIT', 'ERAIS', 'ERAIENT']),
    ("ERONT / ERAS",  "Futur simple",              ['ERONT', 'ERAS', 'ERONS', 'EREZ', 'ERAI', 'ERA']),
    ("AIENT / AIT",   "Imparfait",                 ['AIENT', 'AIT', 'AIS', 'IONS', 'IEZ']),
    ("ASSENT / ATES", "Subjonctif / passe simple", ['ASSENT', 'ATES', 'AMES', 'ASSE', 'ASSES']),
    ("ISSENT / ISSE", "Verbes du 2e groupe",       ['ISSENT', 'ISSE', 'ISSES', 'ISSAIT', 'ISSANT']),
]

# Le pattern nu 'R' de la v1 est supprime : il capturait tout mot en R.
PREFIX_FAMILIES = [
    ("RE- / RA-",         "Repetition, retour, intensif", ['RE', 'RA']),
    ("DE- / DES-",        "Separation, privation",        ['DE', 'DES', 'DIS']),
    ("EN- / EM-",         "Interiorite, mise en etat",    ['EN', 'EM']),
    ("IN- / IM-",         "Negation, privation",          ['IN', 'IM']),
    ("CO- / CON-",        "Association, ensemble",        ['CO', 'CON', 'COM']),
    ("SUR- / SOU-",       "Position, degre, hierarchie",  ['SUR', 'SOU', 'SUB']),
    ("PRE- / PRO-",       "Anteriorite, en avant",        ['PRE', 'PRO']),
    ("TRI- / BI-",        "Numerique, multiple",          ['TRI', 'BI']),
    ("PAR- / PER-",       "Completude, a travers",        ['PAR', 'PER']),
    ("AUTO- / TELE-",     "Autonomie, distance",          ['AUTO', 'TELE']),
    ("NON- / MAL- / ME-", "Pejoratif, negation",          ['NON', 'MAL', 'ME']),
    ("ANTI- / CONTRE-",   "Opposition, protection",       ['ANTI', 'CONTRE']),
    ("TRANS- / EXTRA-",   "Au-dela, traversee",           ['TRANS', 'EXTRA']),
    ("MICRO- / POLY-",    "Grandeur, multiplicite",       ['MICRO', 'MACRO', 'POLY']),
]

# ---------------------------------------------------------------------------
# CHARGEMENT
# ---------------------------------------------------------------------------


def draw_probability(draw):
    """P(tirer exactement ces 7 lettres au premier coup), jokers exclus."""
    ways = 1
    for char, need in Counter(draw).items():
        avail = BAG.get(char, 0)
        if avail < need:
            return 0.0
        ways *= math.comb(avail, need)
    return ways / DRAWS_TOTAL


def load_ods(path):
    with open(path, encoding="utf-8") as fh:
        return {line.strip() for line in fh if line.strip()}


def load_draws(path):
    """Parse le dictionnaire de tirages -> [(draw, prob, sols7, exts8)]."""
    dataset = []
    state = {"draw": None, "sols": [], "exts": []}
    draw_re = re.compile(r"^[A-Z]{7}$")

    def flush():
        if state["draw"] is None:
            return
        prob = draw_probability(state["draw"])
        if prob > 0:
            dataset.append((state["draw"], prob, state["sols"], state["exts"]))

    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            if draw_re.match(line):
                flush()
                state = {"draw": line, "sols": [], "exts": []}
            elif line.startswith("-") and state["draw"]:
                word = line[1:].strip()
                if len(word) == 7:
                    state["sols"].append(word)
            elif line.startswith("+") and not line.startswith("++") and state["draw"]:
                parts = line[1:].strip().split()
                if len(parts) >= 2 and len(parts[1]) == 8:
                    state["exts"].append(parts[1])
    flush()
    return dataset

# ---------------------------------------------------------------------------
# INDEXATION DES AFFIXES
# ---------------------------------------------------------------------------


def build_pattern_index(families):
    """pattern -> index de famille. En cas de collision, la premiere famille
    declaree gagne (l'ordre de SUFFIX_FAMILIES fait donc foi)."""
    index = {}
    for i, (_, _, patterns) in enumerate(families):
        for pat in patterns:
            index.setdefault(pat, i)
    return index


def match_families(word, pattern_index, lengths, mode):
    """Familles dont un pattern matche ce mot (par terminaison ou par debut)."""
    hits = set()
    for size in lengths:
        if size >= len(word):
            continue
        frag = word[-size:] if mode == "suffix" else word[:size]
        fam = pattern_index.get(frag)
        if fam is not None:
            hits.add(fam)
    return hits

# ---------------------------------------------------------------------------
# CALCUL DES METRIQUES
# ---------------------------------------------------------------------------


def contains(rack_counts, need_counts):
    """Le tirage contient-il toutes les lettres du pattern ?"""
    for char, need in need_counts.items():
        if rack_counts.get(char, 0) < need:
            return False
    return True


PREMIUM = set("JKQWXYZ")

# Terminaisons qui trahissent une forme flechie. Un radical affiche dans un
# exercice doit ressembler a un mot qu'on prononce : "BATAT" ou "DOTAI" sont
# des formes valides de l'ODS8, mais les montrer comme radical de reference
# desoriente le joueur plus qu'elle ne l'entraine.
INFLECTED_TAILS = (
    "AIENT", "ERAIT", "ERAIS", "ASSE", "AIT", "AIS", "AIT", "ONS", "ONT", "EZ",
    "ERA", "IRA", "AMES", "ATES", "AT", "UT", "AI", "AS", "EES", "ES", "S",
)

# stem -> nombre de mots de l'ODS8 qui commencent par ce stem. Faute de liste
# de frequences, la productivite derivationnelle est le meilleur proxy
# disponible de "mot que le joueur connait" : un radical qui engendre vingt
# derives est un mot du fonds courant, un hapax n'en engendre aucun.
STEM_PRODUCTIVITY = {}


def build_productivity(ods, sizes=(4, 5, 6)):
    prod = Counter()
    for word in ods:
        for size in sizes:
            if len(word) > size:
                prod[word[:size]] += 1
    return prod


def example_quality(stem, word):
    """Note un couple (radical, derive) pour l'affichage dans l'application.

    Trier par radical le plus court donnait des exemples inutilisables
    (BAT -> BATITES, AIENT -> REAIENT) : un radical de 3 lettres est presque
    toujours une curiosite du dictionnaire, pas un mot que le joueur connait.
    On privilegie donc les radicaux de 4-6 lettres, non flechis et sans
    lettre chere - c'est le meilleur proxy disponible de "mot courant" sans
    liste de frequences.

    Heuristique de tri, pas une verite morphologique : ces couples sont des
    CANDIDATS destines a etre valides a l'oeil avant publication dans l'UI.
    """
    quality = 0
    n = len(stem)
    if n in (4, 5):
        quality += 3
    elif n == 6:
        quality += 2
    if len(word) == 7:          # format cible de l'application
        quality += 2
    if not PREMIUM & set(stem):
        quality += 2
    if not PREMIUM & set(word):
        quality += 1
    if not stem.endswith(INFLECTED_TAILS):
        quality += 3
    # Plafonne a 4 : au-dela le nombre de derives ne dit plus rien de plus sur
    # la notoriete du radical, et ecraserait les autres criteres.
    quality += min(4, STEM_PRODUCTIVITY.get(stem, 0) // 8)
    return quality


def build_drills(rows, ods, mode, per_family=40, seed=7):
    """Construit la banque d'exercices "Le Crochet" pour chaque famille.

    Un contre-exemple tire au hasard dans le dictionnaire serait trop facile :
    le joueur repondrait NON des qu'il ne reconnait pas le radical, sans jamais
    interroger l'affixe. On tire donc les radicaux negatifs dans le vivier des
    radicaux qui forment un crochet AVEC UNE AUTRE FAMILLE : le radical est
    alors forcement un mot connu et reellement "crochetable", et la seule
    question qui reste est bien celle qu'on veut entrainer - cet affixe-la
    passe-t-il sur ce radical-la ?
    """
    stems = sorted({item["stem"] for r in rows for item in r["_hookPool"]})
    rng = random.Random(seed)

    def pick(rng, ranked, count, breadth=4):
        """Tire `count` items au hasard parmi les meilleurs, sans les plafonner
        au tri alphabetique. `breadth` fixe la largeur du vivier."""
        pool = ranked[: count * breadth]
        if len(pool) <= count:
            return list(pool)
        return rng.sample(pool, count)

    for r in rows:
        negatives = []
        for stem in stems:
            fallback = None
            valid = False
            for affix in r["patterns"]:
                if not 7 <= len(stem) + len(affix) <= 8:
                    continue
                word = stem + affix if mode == "suffix" else affix + stem
                if word in ods:
                    valid = True
                    break
                if fallback is None:
                    fallback = (affix, word)
            # `valid` : la famille produit un mot -> c'est un crochet, pas un piege.
            # `fallback is None` : aucun affixe ne donne la bonne longueur.
            if valid or fallback is None:
                continue
            affix, word = fallback
            negatives.append({"stem": stem, "word": word, "affix": affix})

        # Prendre la tete du tri donnait des series entieres en A (DE+ANNEE,
        # DE+ACTIF, DE+AGIRA...) : a qualite egale le departage se faisait sur
        # l'ordre alphabetique. On echantillonne donc dans un vivier large.
        negatives.sort(key=lambda d: (-example_quality(d["stem"], d["word"]), d["word"]))
        positives = pick(rng, r["_hookPool"], per_family)
        negatives = pick(rng, negatives, per_family)

        items = [dict(d, ok=True) for d in positives] + [dict(d, ok=False) for d in negatives]
        rng.shuffle(items)
        r["_drills"] = items


def analyse(families, dataset, ods, mode):
    n_fam = len(families)
    pattern_index = build_pattern_index(families)
    lengths = sorted({len(p) for _, _, pats in families for p in pats}, reverse=True)

    word_cache = {}

    def families_of(word):
        hit = word_cache.get(word)
        if hit is None:
            hit = match_families(word, pattern_index, lengths, mode)
            word_cache[word] = hit
        return hit

    # --- 1. MOTIF : appariement par terminaison / debut sur les tirages ------
    words7 = [set() for _ in range(n_fam)]
    words8 = [set() for _ in range(n_fam)]
    prob7 = [0.0] * n_fam
    prob8 = [0.0] * n_fam
    total_prob = 0.0

    # --- 2. FIABILITE : conditionnee sur la presence des lettres ------------
    # Le declenchement doit couvrir TOUTE la famille : DE-, DES- et DIS- n'ont
    # pas les memes lettres, donc tester seulement le pattern canonique
    # comparerait un declenchement etroit a un succes large. On declenche des
    # que le tirage permet de tenter AU MOINS UN membre de la famille, ce qui
    # est exactement la question du joueur : "puis-je tenter cette famille ?"
    needs = [[Counter(p) for p in pats] for _, _, pats in families]
    trigger_prob = [0.0] * n_fam   # P(le tirage permet de tenter la famille)
    payoff_prob = [0.0] * n_fam    # P(tentative possible ET solution qui matche)

    for draw, prob, sols, exts in dataset:
        total_prob += prob
        rack = Counter(draw)

        seen7 = set()
        for word in sols:
            fams = families_of(word)
            seen7 |= fams
            for fam in fams:
                words7[fam].add(word)
        for fam in seen7:
            prob7[fam] += prob

        seen8 = set()
        for word in exts:
            fams = families_of(word)
            seen8 |= fams
            for fam in fams:
                words8[fam].add(word)
        for fam in seen8:
            prob8[fam] += prob

        for fam in range(n_fam):
            if any(contains(rack, need) for need in needs[fam]):
                trigger_prob[fam] += prob
                if fam in seen7:
                    payoff_prob[fam] += prob

    # --- 3. LEVIER : crochets valides W + affixe, les deux dans l'ODS8 ------
    hooks = [set() for _ in range(n_fam)]
    pairs = [[] for _ in range(n_fam)]   # (radical, mot derive) pour l'UI
    for word in ods:
        if len(word) not in (7, 8):
            continue
        for size in lengths:
            if len(word) - size < MIN_STEM:
                continue
            frag = word[-size:] if mode == "suffix" else word[:size]
            fam = pattern_index.get(frag)
            if fam is None:
                continue
            stem = word[:-size] if mode == "suffix" else word[size:]
            if stem in ods:
                hooks[fam].add(word)
                # On garde `frag` : une famille regroupe plusieurs affixes et
                # l'UI doit afficher celui qui produit REELLEMENT ce mot
                # (RABACHA vient de RA-, pas du canonique RE-).
                pairs[fam].append((stem, word, frag))

    for fam in range(n_fam):
        pairs[fam].sort(key=lambda t: (-example_quality(t[0], t[1]), t[1]))

    # --- Assemblage ---------------------------------------------------------
    rows = []
    for i, (label, role, patterns) in enumerate(families):
        n_motif = len(words7[i]) + len(words8[i])
        n_hook = len(hooks[i])
        rows.append({
            "label": label,
            "role": role,
            "patterns": patterns,
            "canonical": patterns[0],
            "words7": len(words7[i]),
            "words8": len(words8[i]),
            "motifTotal": n_motif,
            "reach7": prob7[i] / total_prob * 100,
            "reach8": prob8[i] / total_prob * 100,
            "triggerRate": trigger_prob[i] / total_prob * 100,
            "reliability": (payoff_prob[i] / trigger_prob[i] * 100) if trigger_prob[i] > 0 else 0.0,
            "hooks": n_hook,
            "hookRatio": (n_hook / n_motif * 100) if n_motif else 0.0,
            "examples": [
                {"stem": s, "word": w, "affix": a} for s, w, a in pairs[i][:12]
            ],
            # Reservoir d'exercices pour Le Reflexe niveau 2. Filtre plus dur
            # que `examples` : un radical de 3 lettres est presque toujours une
            # curiosite du dictionnaire, et l'exercice ne vaut que si le joueur
            # reconnait le radical. Retire de morphology_ranking.json au dump.
            "_hookPool": [
                {"stem": s, "word": w, "affix": a}
                for s, w, a in pairs[i]
                if len(s) >= 4 and not (PREMIUM & set(s))
            ],
            "sampleWords7": sorted(words7[i])[:12],
        })
    return rows


def score(rows, weights=(0.40, 0.35, 0.25), pool=None):
    """Composite PORTEE / FIABILITE / LEVIER, normalise sur le max observe.

    Chaque composante est ramenee a [0, 1] par division par le maximum de la
    famille. Le premier vaut donc 100 par construction et les suivants sont
    une vraie fraction relative : aucun clipping, aucune egalite artificielle.

    `pool` fixe la reference de normalisation. Normaliser suffixes et prefixes
    separement rendrait leurs scores NON comparables entre eux (un 86.9 de
    prefixe ne vaudrait pas un 80.7 de suffixe) - or l'ordre du curriculum
    melange les deux. On passe donc l'union des deux listes en reference.
    """
    w_reach, w_rel, w_lev = weights
    ref = pool if pool is not None else rows
    max_reach = max((r["reach8"] for r in ref), default=1) or 1
    max_rel = max((r["reliability"] for r in ref), default=1) or 1
    max_lev = max((r["hooks"] for r in ref), default=1) or 1

    for r in rows:
        r["nReach"] = r["reach8"] / max_reach
        r["nReliability"] = r["reliability"] / max_rel
        r["nLeverage"] = r["hooks"] / max_lev
        r["score"] = 100 * (
            w_reach * r["nReach"] + w_rel * r["nReliability"] + w_lev * r["nLeverage"]
        )
    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows

# ---------------------------------------------------------------------------
# RENDU
# ---------------------------------------------------------------------------


def print_table(title, rows, kind):
    head = "Famille suffixe" if kind == "suffix" else "Famille prefixe"
    print()
    print("=" * 124)
    print(title)
    print("=" * 124)
    print(
        f"{'#':<4} {head:<20} {'Mots 7L':>8} {'Mots 8L':>8} {'Crochets':>9} "
        f"{'Portee 7L':>10} {'Portee 8L':>10} {'Declench.':>10} {'Fiabilite':>10} {'Score':>7}"
    )
    print("-" * 124)
    for rank, r in enumerate(rows, 1):
        print(
            f"{rank:<4} {r['label']:<20} {r['words7']:>8} {r['words8']:>8} {r['hooks']:>9} "
            f"{r['reach7']:>9.2f}% {r['reach8']:>9.2f}% {r['triggerRate']:>9.2f}% "
            f"{r['reliability']:>9.1f}% {r['score']:>7.1f}"
        )
    print("-" * 124)
    print("Portee    = % des tirages jouables concernes, pondere par la probabilite du sac")
    print("Declench. = % des tirages permettant de tenter au moins un membre de la famille")
    print("Fiabilite = P(solution qui matche | lettres presentes)  <- le reflexe paie-t-il ?")
    print("Crochets  = couples (W, affixe+W) tous deux valides dans l'ODS8, longueur 7-8")


def print_tiers(rows, kind, cuts=(70, 40)):
    hi, mid = cuts
    tiers = [
        ("SOCLE      (score >= %d)" % hi, [r for r in rows if r["score"] >= hi]),
        ("CONSOLIDER (%d-%d)" % (mid, hi), [r for r in rows if mid <= r["score"] < hi]),
        ("FINITION   (< %d)" % mid, [r for r in rows if r["score"] < mid]),
    ]
    print()
    print(f"--- Decoupage en paliers d'entrainement ({kind}) ---")
    for name, group in tiers:
        if not group:
            continue
        print(f"  {name:<26} {len(group):>2} familles : " + ", ".join(r["label"] for r in group))

# ---------------------------------------------------------------------------


def public(row):
    """Copie d'une ligne sans ses viviers de travail (cles prefixees par `_`)."""
    return {k: v for k, v in row.items() if not k.startswith("_")}


def slugify(label, kind):
    """Identifiant stable pour une famille.

    Prefixe par le type : l'id sert de cle de sous-categorie, il finit dans
    les URLs et dans IndexedDB, donc une collision entre un suffixe et un
    prefixe homographes corromprait la progression enregistree.
    """
    body = re.sub(r"[^A-Z0-9]+", "-", label.upper()).strip("-").lower()
    return f"{'pre' if kind == 'prefix' else 'suf'}-{body}"


def write_ts_module(path, curriculum, prefix_labels, featured):
    """Genere le module TypeScript lu par arenaService.

    Les metriques sont calculees ici et figees dans le source : elles ne
    dependent que de l'ODS8 et du sac, jamais de l'utilisateur. Les recopier
    a la main serait la garantie de les voir diverger du script.
    """
    lines = [
        "// GENERE PAR scripts/lexical_morphology_ranking.py - NE PAS EDITER A LA MAIN.",
        "// Regenerer avec :",
        "//   py scripts/lexical_morphology_ranking.py --ts frontend_new/src/data/morphologyFamilies.ts",
        "",
        "export type AffixKind = 'prefix' | 'suffix';",
        "",
        "export interface AffixExample {",
        "    /** Mot valide de l'ODS8 servant de base. */",
        "    stem: string;",
        "    /** Le derive, egalement valide. */",
        "    word: string;",
        "    /** L'affixe REELLEMENT employe : une famille en regroupe plusieurs. */",
        "    affix: string;",
        "}",
        "",
        "export interface AffixFamily {",
        "    id: string;",
        "    label: string;",
        "    role: string;",
        "    kind: AffixKind;",
        "    /** Toutes les terminaisons (ou debuts) de la famille. */",
        "    patterns: string[];",
        "    /** Forme que le joueur vise mentalement. */",
        "    canonical: string;",
        "    /** Couples (radical, radical+affixe) valides dans l'ODS8, longueur 7-8. */",
        "    hooks: number;",
        "    /** P(une solution appartient a la famille | le tirage permet de la tenter). */",
        "    reliability: number;",
        "    /** % des tirages permettant de tenter au moins un membre de la famille. */",
        "    triggerRate: number;",
        "    /** % des tirages ayant une extension 7+1 dans la famille. */",
        "    reach8: number;",
        "    /** Composite portee/fiabilite/levier, echelle commune prefixes+suffixes. */",
        "    score: number;",
        "    /** Proposee comme sous-categorie dans le monde Morphologie. */",
        "    featured: boolean;",
        "    /** Couples (radical, derive) montres comme illustration. */",
        "    examples: AffixExample[];",
        "}",
        "",
        f"/** Familles triees par score decroissant. Les {featured} premieres sont proposees",
        " *  comme sous-categories : au-dela, la liste de pastilles devient illisible. */",
        "export const MORPHOLOGY_FAMILIES: AffixFamily[] = [",
    ]

    # json.dumps produit un litteral de chaine correctement echappe : les
    # roles contiennent des apostrophes ("Nom d'action") qui casseraient des
    # quotes simples ecrites naivement.
    def lit(value):
        return json.dumps(value, ensure_ascii=False)

    for i, r in enumerate(curriculum):
        kind = "prefix" if r["label"] in prefix_labels else "suffix"
        pats = ", ".join(lit(p) for p in r["patterns"])
        lines.append("    {")
        lines.append(f"        id: {lit(slugify(r['label'], kind))},")
        lines.append(f"        label: {lit(r['label'])},")
        lines.append(f"        role: {lit(r['role'])},")
        lines.append(f"        kind: {lit(kind)},")
        lines.append(f"        patterns: [{pats}],")
        lines.append(f"        canonical: {lit(r['canonical'])},")
        lines.append(f"        hooks: {r['hooks']},")
        lines.append(f"        reliability: {r['reliability']:.1f},")
        lines.append(f"        triggerRate: {r['triggerRate']:.1f},")
        lines.append(f"        reach8: {r['reach8']:.1f},")
        lines.append(f"        score: {r['score']:.1f},")
        lines.append(f"        featured: {'true' if i < featured else 'false'},")
        examples = ", ".join(
            "{{ stem: {}, word: {}, affix: {} }}".format(lit(e["stem"]), lit(e["word"]), lit(e["affix"]))
            for e in r["examples"][:4]
        )
        lines.append(f"        examples: [{examples}],")
        lines.append("    },")

    lines += [
        "];",
        "",
        "export const FEATURED_FAMILIES: AffixFamily[] =",
        "    MORPHOLOGY_FAMILIES.filter(f => f.featured);",
        "",
        "/** Longueurs de pattern a sonder, de la plus longue a la plus courte. */",
        "export const PATTERN_LENGTHS: number[] = [",
        "    ...new Set(MORPHOLOGY_FAMILIES.flatMap(f => f.patterns.map(p => p.length))),",
        "].sort((a, b) => b - a);",
        "",
    ]

    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--ods", default=ODS_PATH)
    ap.add_argument("--dict", dest="dict_path", default=DICT_PATH)
    ap.add_argument("--json", dest="json_path", default=None,
                    help="Exporte le classement en JSON pour l'application")
    ap.add_argument("--ts", dest="ts_path", default=None,
                    help="Genere le module TypeScript consomme par arenaService")
    ap.add_argument("--drills", dest="drills_path", default=None,
                    help="Exporte la banque d'exercices crochets (defi Le Reflexe)")
    ap.add_argument("--per-family", type=int, default=40,
                    help="Crochets valides ET pieges par famille dans la banque (defaut 40)")
    ap.add_argument("--featured", type=int, default=14,
                    help="Nombre de familles proposees comme sous-categories (defaut 14)")
    ap.add_argument("--include-verbal", action="store_true",
                    help="Ajoute les desinences verbales au classement des suffixes")
    args = ap.parse_args()

    ods = load_ods(args.ods)
    dataset = load_draws(args.dict_path)

    covered = sum(p for _, p, _, _ in dataset)
    print("ODS8            : {:,} mots".format(len(ods)).replace(",", " "))
    print("Tirages 7L      : {:,} distincts".format(len(dataset)).replace(",", " "))
    print(f"Masse couverte  : {covered * 100:.2f}% des tirages possibles du sac")
    print(f"Radical minimal : {MIN_STEM} lettres pour valider un crochet")

    STEM_PRODUCTIVITY.update(build_productivity(ods))

    suffixes = list(SUFFIX_FAMILIES)
    if args.include_verbal:
        suffixes += VERBAL_FAMILIES

    suffix_rows = analyse(suffixes, dataset, ods, "suffix")
    prefix_rows = analyse(PREFIX_FAMILIES, dataset, ods, "prefix")

    # Reference commune : les deux tables partagent la meme echelle, sinon
    # l'ordre du curriculum (qui alterne prefixes et suffixes) serait faux.
    pool = suffix_rows + prefix_rows
    score(suffix_rows, pool=pool)
    score(prefix_rows, pool=pool)

    build_drills(suffix_rows, ods, "suffix", per_family=args.per_family)
    build_drills(prefix_rows, ods, "prefix", per_family=args.per_family)

    print_table("CLASSEMENT DES SUFFIXES LEXICAUX", suffix_rows, "suffix")
    print_tiers(suffix_rows, "suffixes")
    print_table("CLASSEMENT DES PREFIXES DERIVATIONNELS", prefix_rows, "prefix")
    print_tiers(prefix_rows, "prefixes")

    print()
    print("=" * 124)
    print("ORDRE DE CURRICULUM  -  suffixes et prefixes sur une echelle commune")
    print("=" * 124)
    curriculum = sorted(pool, key=lambda r: r["score"], reverse=True)
    print(f"{'#':<4} {'Famille':<20} {'Type':<9} {'Crochets':>9} {'Fiabilite':>10} {'Portee 8L':>10} {'Score':>7}")
    print("-" * 124)
    prefix_labels = {r["label"] for r in prefix_rows}
    for rank, r in enumerate(curriculum[:14], 1):
        kind = "prefixe" if r["label"] in prefix_labels else "suffixe"
        print(f"{rank:<4} {r['label']:<20} {kind:<9} {r['hooks']:>9} "
              f"{r['reliability']:>9.1f}% {r['reach8']:>9.2f}% {r['score']:>7.1f}")

    if args.json_path:
        payload = {
            "meta": {
                "ods": len(ods),
                "draws": len(dataset),
                "bagCoverage": covered,
                "minStem": MIN_STEM,
                "weights": {"reach": 0.40, "reliability": 0.35, "leverage": 0.25},
                "includeVerbal": args.include_verbal,
            },
            # Les cles en `_` sont des viviers de travail (des milliers de
            # couples) : ils alimentent --drills, pas ce rapport.
            "suffixes": [public(r) for r in suffix_rows],
            "prefixes": [public(r) for r in prefix_rows],
        }
        with open(args.json_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        print(f"\nJSON ecrit -> {args.json_path}")

    if args.drills_path:
        families = []
        for r in curriculum:
            kind = "prefix" if r["label"] in prefix_labels else "suffix"
            families.append({
                "id": slugify(r["label"], kind),
                "label": r["label"],
                "kind": kind,
                "canonical": r["canonical"],
                "reliability": round(r["reliability"], 1),
                "items": r["_drills"],
            })
        bank = {
            "meta": {
                "ods": len(ods),
                "perFamily": args.per_family,
                "minStem": MIN_STEM,
            },
            "families": families,
        }
        with open(args.drills_path, "w", encoding="utf-8") as fh:
            json.dump(bank, fh, ensure_ascii=False, separators=(",", ":"))
        total = sum(len(f["items"]) for f in families)
        print(f"Banque d'exercices ecrite -> {args.drills_path}  ({total} items)")

    if args.ts_path:
        write_ts_module(args.ts_path, curriculum, prefix_labels, args.featured)
        print(f"Module TS ecrit -> {args.ts_path}")


if __name__ == "__main__":
    main()
