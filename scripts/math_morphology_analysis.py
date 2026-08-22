"""
Statistical & Probabilistic Analysis of Scrabble Prefixes & Suffixes
Cartesian / Mathematical coach for 7-letter and 8-letter (7+1) words in ODS8.
"""
import math
import re
from collections import Counter, defaultdict

BAG = {
    'E': 15, 'A': 9, 'I': 8, 'N': 6, 'O': 6, 'R': 6, 'S': 6, 'T': 6, 'U': 6, 'L': 5,
    'D': 3, 'M': 3, 'G': 2, 'B': 2, 'C': 2, 'P': 2, 'F': 2, 'H': 2, 'V': 2,
    'J': 1, 'Q': 1, 'K': 1, 'W': 1, 'X': 1, 'Y': 1, 'Z': 1
}
TOTAL_TILES = sum(BAG.values()) # 100

def draw_probability(draw_str):
    """Calculates exact hypergeometric draw probability from 100-tile French bag."""
    counts = Counter(draw_str)
    ways = 1
    for char, c in counts.items():
        avail = BAG.get(char, 0)
        if avail < c:
            return 0.0
        ways *= math.comb(avail, c)
    return ways / math.comb(TOTAL_TILES, len(draw_str))

def main():
    dict_path = 'frontend_new/public/data/scrabble_dict.txt'
    with open(dict_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    draw_entries = {}
    current_draw = None

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if re.match(r'^[A-Z]{7}$', line):
            current_draw = line
            draw_entries[current_draw] = {'solutions': [], 'ext8': []}
        elif line.startswith('-') and current_draw:
            draw_entries[current_draw]['solutions'].append(line[1:].strip())
        elif line.startswith('+') and not line.startswith('++') and current_draw:
            parts = line[1:].strip().split()
            if len(parts) >= 2:
                draw_entries[current_draw]['ext8'].append((parts[0], parts[1]))

    print(f"Total tirages 7L référencés : {len(draw_entries):,}")

    total_prob = sum(draw_probability(d) for d in draw_entries.keys())
    print(f"Espace de probabilité total des tirages : {total_prob:.6f}")

    # Accumulateurs pour 7L
    suff7_words = defaultdict(set)
    suff7_prob = defaultdict(float)
    pref7_words = defaultdict(set)
    pref7_prob = defaultdict(float)

    # Accumulateurs pour 8L (7+1 appuis)
    suff8_words = defaultdict(set)
    suff8_prob = defaultdict(float)
    pref8_words = defaultdict(set)
    pref8_prob = defaultdict(float)

    for draw, data in draw_entries.items():
        p = draw_probability(draw)
        if p == 0:
            continue

        for sol in data['solutions']:
            if len(sol) == 7:
                for slen in [3, 4, 5]:
                    s = sol[-slen:]
                    suff7_words[s].add(sol)
                    suff7_prob[s] += p
                for plen in [2, 3, 4]:
                    pr = sol[:plen]
                    pref7_words[pr].add(sol)
                    pref7_prob[pr] += p

        for appui, sol8 in data['ext8']:
            if len(sol8) == 8:
                for slen in [3, 4, 5]:
                    s = sol8[-slen:]
                    suff8_words[s].add(sol8)
                    suff8_prob[s] += p
                for plen in [2, 3, 4]:
                    pr = sol8[:plen]
                    pref8_words[pr].add(sol8)
                    pref8_prob[pr] += p

    def print_table(title, data_prob, data_words, length, top_n=15, is_prefix=False):
        sub = {k: v for k, v in data_prob.items() if len(k) == length}
        sorted_items = sorted(sub.items(), key=lambda x: x[1], reverse=True)[:top_n]
        print(f"\n{title} (Longueur = {length})")
        print(f"{'Affixe':<10} | {'Mots ODS':<10} | {'Proba Tirages (P)':<18} | {'Impact / Tirages (%)'}")
        print("-" * 65)
        for aff, prob in sorted_items:
            pct = (prob / total_prob) * 100
            label = f"{aff}-" if is_prefix else f"-{aff}"
            nb = len(data_words[aff])
            print(f"{label:<10} | {nb:<10} | {prob:.4e}         | {pct:>6.2f}%")

    print("\n" + "="*70)
    print("1. ANALYSE MATHÉMATIQUE DES SUFFIXES — SCRABBLES SECS (7 LETTRES)")
    print("="*70)
    print_table("Top Suffixes 3 lettres (7L)", suff7_prob, suff7_words, 3)
    print_table("Top Suffixes 4 lettres (7L)", suff7_prob, suff7_words, 4)

    print("\n" + "="*70)
    print("2. ANALYSE MATHÉMATIQUE DES SUFFIXES — RALLONGES 7+1 (8 LETTRES)")
    print("="*70)
    print_table("Top Suffixes 3 lettres (8L)", suff8_prob, suff8_words, 3)
    print_table("Top Suffixes 4 lettres (8L)", suff8_prob, suff8_words, 4)
    print_table("Top Suffixes 5 lettres (8L)", suff8_prob, suff8_words, 5)

    print("\n" + "="*70)
    print("3. ANALYSE MATHÉMATIQUE DES PRÉFIXES — RALLONGES 7+1 (8 LETTRES)")
    print("="*70)
    print_table("Top Préfixes 2 lettres (8L)", pref8_prob, pref8_words, 2, is_prefix=True)
    print_table("Top Préfixes 3 lettres (8L)", pref8_prob, pref8_words, 3, is_prefix=True)
    print_table("Top Préfixes 4 lettres (8L)", pref8_prob, pref8_words, 4, is_prefix=True)

if __name__ == '__main__':
    main()
