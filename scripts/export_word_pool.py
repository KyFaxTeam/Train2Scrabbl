# -*- coding: utf-8 -*-
"""
OBSOLETE depuis le 22/08/2026 : le vivier de decor se decoupe desormais dans le
lexique charge par le moteur (scripts/export_lexicon.py -> lexicon.txt), et
word_pool.txt n'est plus ni produit ni telecharge. Le script est conserve pour
l'historique du diagnostic ci-dessous, qui reste exact.

Exporte le vivier de mots courts qui sert a MEUBLER le plateau d'entrainement.

Pourquoi ce fichier existe : le worker construisait son WordPool en lisant
frontend_new/public/data/scrabble_dict.txt ligne par ligne. Or ce fichier n'est
pas une liste de mots, c'est un index de tirages :

    AEINOTU        <- une cle de tirage, pas un mot
    -AOUTIEN       <- une solution, prefixee d'un tiret
    +Q ATONIQUE    <- une rallonge, prefixee de la lettre ajoutee

Aucune de ces lignes ne fait 2 a 6 caracteres. WordPool.getMotsCourts() et
getMotsMoyens() renvoyaient donc des listes VIDES, la phase de "respiration"
de NaturalFlow ne posait aucun mot, et l'exercice se reduisait a une seule
lettre sur un plateau nu, avec au chevalet les sept lettres de la reponse.

Le moteur n'avait rien de casse : il etait affame.

Usage :
  py scripts/export_word_pool.py
  py scripts/export_word_pool.py --max-len 6 --out frontend_new/public/data/word_pool.txt
"""

import argparse
import io

ODS_PATH = "data/ods8.txt"
OUT_PATH = "frontend_new/public/data/word_pool.txt"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ods", default=ODS_PATH)
    ap.add_argument("--out", default=OUT_PATH)
    ap.add_argument("--min-len", type=int, default=2)
    # 7 lettres inclus : la categorie "long" de la respiration y puise. Au-dela,
    # le fichier double de taille pour des mots qu'on ne pose jamais en decor.
    ap.add_argument("--max-len", type=int, default=7)
    args = ap.parse_args()

    words = []
    with io.open(args.ods, encoding="utf-8") as fh:
        for line in fh:
            word = line.strip()
            if args.min_len <= len(word) <= args.max_len and word.isalpha():
                words.append(word)

    words.sort()
    blob = "\n".join(words)
    with io.open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(blob)

    by_len = {}
    for word in words:
        by_len[len(word)] = by_len.get(len(word), 0) + 1

    print("Vivier ecrit -> {}".format(args.out))
    print("  {} mots, {:.0f} Ko brut".format(len(words), len(blob.encode("utf-8")) / 1024))
    for size in sorted(by_len):
        print("  {:2d} lettres : {:6d}".format(size, by_len[size]))


if __name__ == "__main__":
    main()
