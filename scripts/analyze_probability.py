"""
Script d'analyse de probabilité des tirages Scrabble (FR)
Calcule la probabilité de tirer exactement les 7 tuiles d'un tirage donné.
"""
import re
import math
from collections import Counter

# Distribution des lettres Scrabble FR (102 tuiles)
# Note: On ignore les jokers (?) pour le calcul de probabilité "pure" des lettres affichées
BAG_DISTRIBUTION = {
    'E': 15, 'A': 9, 'I': 8, 'N': 6, 'O': 6, 'R': 6, 'S': 6, 'T': 6, 'U': 6, 'L': 5,
    'D': 3, 'M': 3, 'G': 2,
    'B': 2, 'C': 2, 'P': 2,
    'F': 2, 'H': 2, 'V': 2,
    'J': 1, 'Q': 1, 'K': 1, 'W': 1, 'X': 1, 'Y': 1, 'Z': 1
    # Jokers exclus du calcul de probabilité des tirages "lettres pleines"
}

TOTAL_TILES = sum(BAG_DISTRIBUTION.values()) # 100 tuiles lettrées (sans jokers)

def nCr(n, r):
    if r < 0 or r > n:
        return 0
    return math.comb(n, r)

def calculate_probability(draw):
    """
    Calcule la probabilité de tirer ces 7 lettres spécifiques du sac.
    P = (Ways to choose letters) / (Total ways to choose 7 from 100)
    """
    counts = Counter(draw)
    ways = 1
    
    # Vérifier si le tirage est possible (ex: pas plus de Z que dans le sac)
    for char, count in counts.items():
        if BAG_DISTRIBUTION.get(char, 0) < count:
            return 0 # Impossible sans joker
        ways *= nCr(BAG_DISTRIBUTION[char], count)
    
    total_combinations = nCr(TOTAL_TILES, 7)
    return ways / total_combinations

def main():
    print(f"Chargement du dictionnaire...")
    with open(r'frontend_new\public\data\scrabble_dict.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    draws = [l.strip() for l in lines if re.match(r'^[A-Z]{7}$', l.strip())]
    print(f"Analyse de {len(draws)} tirages...")
    
    # Calculer probabilités
    draw_probs = []
    impossible_count = 0
    
    for draw in draws:
        prob = calculate_probability(draw)
        if prob > 0:
            draw_probs.append((draw, prob))
        else:
            impossible_count += 1
            
    # Trier par probabilité décroissante
    draw_probs.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\n{'='*60}")
    print(f"📊 ANALYSE DE PROBABILITÉ (Top Fréquence)")
    print(f"{'='*60}")
    
    print(f"\n🔝 TOP 20 TIRAGES LES PLUS PROBABLES:")
    print(f"{'Rang':<5} {'Tirage':<10} {'Probabilité':<15} {'1 chance sur...'}")
    print("-" * 50)
    
    for i, (draw, prob) in enumerate(draw_probs[:20]):
        one_in = int(1/prob)
        print(f"#{i+1:<4} {draw:<10} {prob:.2e}      {one_in:,}")

    print(f"\n📉 FLOP 10 TIRAGES (Les plus rares possibles):")
    for i, (draw, prob) in enumerate(draw_probs[-10:]):
        one_in = int(1/prob)
        print(f"#{len(draw_probs)-9+i:<4} {draw:<10} {prob:.2e}      {one_in:,}")

    # Catégorisation par tranches
    print(f"\n{'='*60}")
    print(f"📦 CATÉGORISATION PAR PROBABILITÉ")
    print(f"{'='*60}")
    
    ranges = [
        ("Top 100", 0, 100),
        ("Top 1000", 0, 1000),
        ("Top 5000", 0, 5000),
        ("Reste", 5000, len(draw_probs))
    ]
    
    # Cumul de probabilité (couverture du jeu)
    total_prob_space = sum(p for _, p in draw_probs)
    
    current_sum = 0
    checkpoints = [100, 1000, 5000, 10000]
    print(f"\nCouverture du jeu réel (Probabilité cumulée):")
    for i, (draw, prob) in enumerate(draw_probs):
        current_sum += prob
        if (i + 1) in checkpoints:
            pct = (current_sum / total_prob_space) * 100 # Relative au total des tirages valides
            # Note: total_prob_space < 1 car tous les tirages possibles ne sont pas des mots valides
            print(f"  Les {i+1} premiers tirages couvrent {pct:.2f}% de tous les bingos joués")

if __name__ == '__main__':
    main()
