"""
Calculateur d'Efficacité et de ROI Pédagogique pour la Morphologie au Scrabble (ODS8).
Analyse statistique cartésienne : Prefixes (Starts) & Suffixes (Terminaisons)
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

def draw_prob(draw_str):
    counts = Counter(draw_str)
    ways = 1
    for char, c in counts.items():
        avail = BAG.get(char, 0)
        if avail < c: return 0.0
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
        if not line: continue
        if re.match(r'^[A-Z]{7}$', line):
            current_draw = line
            draw_entries[current_draw] = {'solutions': [], 'ext8': []}
        elif line.startswith('-') and current_draw:
            draw_entries[current_draw]['solutions'].append(line[1:].strip())
        elif line.startswith('+') and not line.startswith('++') and current_draw:
            parts = line[1:].strip().split()
            if len(parts) >= 2:
                draw_entries[current_draw]['ext8'].append((parts[0], parts[1]))

    total_prob = sum(draw_prob(d) for d in draw_entries.keys())

    # Dictionnaires pour stocker les stats
    # Key: affix -> {'words7': set(), 'words8': set(), 'draws7': set(), 'draws8': set(), 'prob7': 0.0, 'prob8': 0.0}
    suffixes = defaultdict(lambda: {'words7': set(), 'words8': set(), 'prob7': 0.0, 'prob8': 0.0})
    prefixes = defaultdict(lambda: {'words7': set(), 'words8': set(), 'prob7': 0.0, 'prob8': 0.0})

    # Traitement en une seule passe
    for draw, data in draw_entries.items():
        p = draw_prob(draw)
        if p == 0: continue

        for sol in data['solutions']:
            if len(sol) == 7:
                for slen in [2, 3, 4, 5]:
                    s = sol[-slen:]
                    suffixes[s]['words7'].add(sol)
                    suffixes[s]['prob7'] += p
                for plen in [2, 3, 4]:
                    pr = sol[:plen]
                    prefixes[pr]['words7'].add(sol)
                    prefixes[pr]['prob7'] += p

        for appui, sol8 in data['ext8']:
            if len(sol8) == 8:
                for slen in [2, 3, 4, 5]:
                    s = sol8[-slen:]
                    suffixes[s]['words8'].add(sol8)
                    suffixes[s]['prob8'] += p
                for plen in [2, 3, 4]:
                    pr = sol8[:plen]
                    prefixes[pr]['words8'].add(sol8)
                    prefixes[pr]['prob8'] += p

    print(f"Total tirages analysés : {len(draw_entries):,}")
    print(f"Espace de probabilité total : {total_prob:.6f}\n")

    # =========================================================================
    # ANALYSE PAR FAMILLES MORPHOLOGIQUES (VERBAL, NOMINAL, ADJECTIVAL, PRÉFIXES)
    # =========================================================================

    categories = {
        "1. DÉSINENCES VERBALES DU 1er GROUPE & FUTUR/COND (Les 'Machines à Scrabbler')": [
            'ERAIS', 'ERAIT', 'AIENT', 'ERENT', 'ERONS', 'ERONT',
            'ERAS', 'ERAI', 'EREZ', 'ATES', 'AMES', 'ASSE', 'ASSES',
            'IONS', 'IEZ', 'ANT', 'ONS', 'ENT'
        ],
        "2. DÉSINENCES DU 2e/3e GROUPE (Subjonctif, Passé Simple, Conditionnel)": [
            'ISSES', 'ISSONS', 'ISSEZ', 'ISSENT', 'IRAIS', 'IRAIT', 'IRONT',
            'RENT', 'RAIS', 'RAIT', 'RONS', 'RONT', 'SSES', 'IENT'
        ],
        "3. SUFFIXES NOMINAUX ET ADJECTIVAUX (Les 'Formations de Mots' de l'audio 1)": [
            'EUR', 'EURS', 'EUSE', 'EUSES', 'ISTE', 'ISTES', 'ISME', 'ISMES',
            'AGE', 'AGES', 'URE', 'URES', 'ABLE', 'ABLES', 'OIR', 'OIRS',
            'IEN', 'IENS', 'IENNE', 'IENNES', 'EUX', 'IQUE', 'IQUES',
            'AIRE', 'AIRES', 'ERIE', 'ERIES', 'ELLE', 'ELLES', 'ETTE', 'ETTES'
        ],
        "4. PRÉFIXES MAJEURS (DÉPARTS À FORT ROI)": [
            'RE', 'DE', 'EN', 'EM', 'IN', 'IM', 'RA', 'CA', 'CO', 'CON',
            'PRE', 'PRO', 'SUR', 'SOU', 'TRI', 'BI', 'DIS', 'DES', 'NON', 'TELE'
        ]
    }

    for cat_name, affixes in categories.items():
        print("=" * 80)
        print(f"📊 {cat_name}")
        print("=" * 80)
        is_pref = "PRÉFIXES" in cat_name
        data_source = prefixes if is_pref else suffixes

        print(f"{'Affixe':<10} | {'Mots 7L':<8} | {'Mots 8L (7+1)':<14} | {'Couverture 7L (%)':<18} | {'Couverture 8L 7+1 (%)':<22} | {'Note ROI / 100'}")
        print("-" * 90)

        # Calculer le ranking ROI
        results = []
        for aff in affixes:
            info = data_source[aff]
            nb7 = len(info['words7'])
            nb8 = len(info['words8'])
            pct7 = (info['prob7'] / total_prob) * 100
            pct8 = (info['prob8'] / total_prob) * 100
            
            # Score composite ROI basé sur probabilité cumulée 7+1 et volume
            # Max score normalized around ~100
            roi_score = min(100.0, (pct8 * 1.5 + pct7 * 2.0 + (nb8 / 20.0)))
            label = f"{aff}-" if is_pref else f"-{aff}"
            results.append((label, nb7, nb8, pct7, pct8, roi_score))

        # Trier par Couverture 8L (7+1) décroissante
        results.sort(key=lambda x: x[4], reverse=True)

        for label, nb7, nb8, pct7, pct8, roi in results:
            print(f"{label:<10} | {nb7:<8} | {nb8:<14} | {pct7:>14.2f}%   | {pct8:>18.2f}%   | {roi:>10.1f}")
        print()

if __name__ == '__main__':
    main()
