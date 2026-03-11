"""
Script d'analyse statistique du dictionnaire Scrabble
pour planifier la catégorisation UX
"""
import re
from collections import defaultdict

VOWELS = 'AEIOUY'
PREMIUM_LETTERS = 'JKQWXYZ'
LETTER_VALUES = {
    'E': 1, 'A': 1, 'I': 1, 'N': 1, 'O': 1, 'R': 1, 'S': 1, 'T': 1, 'U': 1, 'L': 1,
    'D': 2, 'M': 2, 'G': 2,
    'B': 3, 'C': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4,
    'J': 8, 'Q': 8,
    'K': 10, 'W': 10, 'X': 10, 'Y': 10, 'Z': 10
}

def main():
    with open(r'frontend_new\public\data\scrabble_dict.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    draws = [l.strip() for l in lines if re.match(r'^[A-Z]{7}$', l.strip())]
    print(f"=" * 60)
    print(f"ANALYSE STATISTIQUE DU DICTIONNAIRE SCRABBLE")
    print(f"=" * 60)
    print(f"\n📊 Total tirages 7 lettres: {len(draws):,}")
    
    # Distribution par voyelles
    vowel_dist = defaultdict(int)
    for draw in draws:
        v_count = sum(1 for c in draw if c in VOWELS)
        vowel_dist[v_count] += 1
    
    print(f"\n{'─' * 50}")
    print("🅰️ DISTRIBUTION PAR NOMBRE DE VOYELLES (A,E,I,O,U,Y)")
    print(f"{'─' * 50}")
    for v in range(8):
        count = vowel_dist[v]
        pct = 100 * count / len(draws)
        bar = '█' * int(pct / 2)
        print(f"  {v}V: {count:>5} ({pct:>5.1f}%) {bar}")
    
    # Distribution par lettres premium
    premium_dist = {l: [] for l in PREMIUM_LETTERS}
    premium_dist['Sans premium'] = []
    
    for draw in draws:
        found = [c for c in draw if c in PREMIUM_LETTERS]
        if found:
            for c in set(found):
                premium_dist[c].append(draw)
        else:
            premium_dist['Sans premium'].append(draw)
    
    print(f"\n{'─' * 50}")
    print("💎 DISTRIBUTION PAR LETTRE PREMIUM (J,K,Q,W,X,Y,Z)")
    print(f"{'─' * 50}")
    for l in ['J', 'K', 'Q', 'W', 'X', 'Y', 'Z', 'Sans premium']:
        count = len(premium_dist[l])
        pct = 100 * count / len(draws)
        bar = '█' * int(pct / 2)
        print(f"  {l:>12}: {count:>5} ({pct:>5.1f}%) {bar}")
    
    # Distribution par valeur totale
    value_dist = defaultdict(int)
    value_ranges = [(7, 10), (11, 14), (15, 18), (19, 22), (23, 30), (31, 100)]
    range_labels = ['7-10 (très faible)', '11-14 (faible)', '15-18 (moyen)', 
                    '19-22 (bon)', '23-30 (élevé)', '31+ (premium)']
    
    for draw in draws:
        total = sum(LETTER_VALUES.get(c, 0) for c in draw)
        for (lo, hi), label in zip(value_ranges, range_labels):
            if lo <= total <= hi:
                value_dist[label] += 1
                break
    
    print(f"\n{'─' * 50}")
    print("💰 DISTRIBUTION PAR VALEUR TOTALE DU TIRAGE")
    print(f"{'─' * 50}")
    for label in range_labels:
        count = value_dist[label]
        pct = 100 * count / len(draws)
        bar = '█' * int(pct / 2)
        print(f"  {label:>20}: {count:>5} ({pct:>5.1f}%) {bar}")
    
    # Combinaisons Voyelles x Premium
    print(f"\n{'─' * 50}")
    print("🔀 MATRICE VOYELLES × LETTRES PREMIUM")
    print(f"{'─' * 50}")
    print(f"{'Voyelles':<10}", end='')
    for l in ['Sans', 'J', 'K', 'Q', 'W', 'X', 'Y', 'Z']:
        print(f"{l:>7}", end='')
    print()
    
    for v in range(8):
        print(f"{v}V        ", end='')
        for premium in ['Sans premium', 'J', 'K', 'Q', 'W', 'X', 'Y', 'Z']:
            count = sum(1 for d in premium_dist[premium] 
                       if sum(1 for c in d if c in VOWELS) == v)
            if count > 0:
                print(f"{count:>7}", end='')
            else:
                print(f"{'·':>7}", end='')
        print()
    
    # Propositions de catégories
    print(f"\n{'=' * 60}")
    print("📋 PROPOSITIONS DE CATÉGORIES POUR L'UX")
    print(f"{'=' * 60}")
    
    # Sous-catégories voyelles
    print("\n🅰️ Si on découpe par VOYELLES:")
    for v in range(8):
        count = vowel_dist[v]
        if count > 0:
            avg_per_alpha = count / 26 if count > 26 else count
            print(f"  {v}V ({count:>5} tirages) → ~{int(avg_per_alpha)} par sous-catégorie alphabétique")
    
    # Sous-catégories premium
    print("\n💎 Si on découpe par LETTRES PREMIUM:")
    for l in ['J', 'K', 'Q', 'W', 'X', 'Y', 'Z']:
        count = len(premium_dist[l])
        if count > 0:
            print(f"  Mots avec {l}: {count:>4} tirages")
    print(f"  Sans premium: {len(premium_dist['Sans premium']):>4} tirages (à sous-découper!)")

if __name__ == '__main__':
    main()
