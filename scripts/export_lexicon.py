# -*- coding: utf-8 -*-
"""
Exporte le lexique ODS8 sous forme front-codee, pour remplacer gaddag.bin.

Pourquoi ce fichier existe : le moteur transportait un GADDAG de 5,74 Mo
(3,23 Mo transferes, ~18 s de premiere visite) alors qu'en dehors de
MoveGenerator - qui est casse et inutilise - la seule operation du moteur sur
ce GADDAG est `contains()`, c'est-a-dire un test d'appartenance. Un index de
prefixes de 3 Mo pour faire un `Set.has`.

Mesures a l'appui :
    gaddag.bin                        5 739 Ko bruts / 3 230 Ko transferes
    ods8.txt (liste brute)            4 771 Ko bruts /   943 Ko gzip
    ods8.txt <=15 lettres, front-code 1 534 Ko bruts /   235 Ko gzip   <- ce fichier

Le GADDAG s'arrete a 15 lettres (2,1 % des mots ODS8 lui manquent, tous de 16
lettres et plus) : la grille faisant 15 cases, aucun mot plus long ne peut etre
forme. On applique la meme coupe.

Format (magie 'T2S-LEX1' sur la premiere ligne) :

    T2S-LEX1
    0AA              <- 0 lettre partagee avec le mot precedent, puis "AA"
    2ALENIEN         <- 2 lettres partagees ("AA"), puis "LENIEN" -> AALENIEN
    8NE              <- 8 partagees ("AALENIEN"), puis "NE" -> AALENIENNE

Le nombre de lettres partagees est code par un seul caractere (chr(48 + k)),
plafonne a 40 pour rester imprimable. La liste doit rester triee : le moteur
fait une recherche dichotomique dessus.

Usage :
  py scripts/export_lexicon.py
"""

import argparse
import gzip
import io

ODS_PATH = "data/ods8.txt"
OUT_PATH = "frontend_new/public/data/lexicon.txt"
MAX_PREFIX = 40
MAGIC = "T2S-LEX1"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ods", default=ODS_PATH)
    ap.add_argument("--out", default=OUT_PATH)
    # 15 = taille de la grille : un mot plus long ne tient pas sur le plateau.
    ap.add_argument("--max-len", type=int, default=15)
    args = ap.parse_args()

    words = set()
    with io.open(args.ods, encoding="utf-8") as fh:
        for line in fh:
            word = line.strip().upper()
            if word.isalpha() and word.isascii() and len(word) <= args.max_len:
                words.add(word)

    ordered = sorted(words)

    lines = [MAGIC]
    previous = ""
    for word in ordered:
        shared = 0
        limit = min(len(previous), len(word), MAX_PREFIX)
        while shared < limit and previous[shared] == word[shared]:
            shared += 1
        lines.append(chr(48 + shared) + word[shared:])
        previous = word

    blob = "\n".join(lines)
    with io.open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(blob)

    raw = blob.encode("utf-8")
    print("Lexique ecrit -> {}".format(args.out))
    print("  {} mots (<= {} lettres)".format(len(ordered), args.max_len))
    print("  {:.0f} Ko bruts / {:.0f} Ko gzip".format(
        len(raw) / 1024, len(gzip.compress(raw, 9)) / 1024))


if __name__ == "__main__":
    main()
