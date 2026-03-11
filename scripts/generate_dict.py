import os
from collections import defaultdict
from itertools import combinations

def load_words(filepath):
    """Load words from file, returning sets of 7, 8, and 9 letter words."""
    words_7 = set()
    words_8 = set()
    words_9 = set()
    
    print(f"Loading words from {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip().upper()
                if not word:
                    continue
                length = len(word)
                if length == 7:
                    words_7.add(word)
                elif length == 8:
                    words_8.add(word)
                elif length == 9:
                    words_9.add(word)
    except FileNotFoundError:
        print(f"Error: File {filepath} not found.")
        return None, None, None
        
    print(f"Loaded {len(words_7)} 7-letter words")
    print(f"Loaded {len(words_8)} 8-letter words")
    print(f"Loaded {len(words_9)} 9-letter words")
    return words_7, words_8, words_9

def get_sorted_key(word):
    """Return string of sorted letters."""
    return "".join(sorted(word))

def generate_dictionaries(source_path, out_ext1_path, out_full_path):
    words_7, words_8, words_9 = load_words(source_path)
    if not words_7:
        return

    # Data structure: key (sorted 7 chars) -> {
    #   'base': set(words),
    #   'ext1': { added_char: set(words) },
    #   'ext2': { added_chars: set(words) }
    # }
    entries = defaultdict(lambda: {'base': set(), 'ext1': defaultdict(set), 'ext2': defaultdict(set)})

    print("Processing 7-letter words...")
    for word in words_7:
        key = get_sorted_key(word)
        entries[key]['base'].add(word)

    print("Processing 8-letter words (+1 extensions)...")
    for word in words_8:
        key_8 = get_sorted_key(word)
        # Try removing each letter to find the 7-letter stem
        for i in range(8):
            # Optimization: skip if same letter as previous to avoid duplicates
            if i > 0 and key_8[i] == key_8[i-1]:
                continue
                
            stem = key_8[:i] + key_8[i+1:]
            if stem in entries:
                added_char = key_8[i]
                entries[stem]['ext1'][added_char].add(word)

    print("Processing 9-letter words (+2 extensions)...")
    for word in words_9:
        key_9 = get_sorted_key(word)
        # Try removing any pair of letters
        # combinations returns indices or items? items. But we need to form the stem.
        # Let's iterate indices.
        for i in range(9):
            for j in range(i + 1, 9):
                # Optimization: handle duplicates?
                # If key_9 has duplicates, we might process same stem multiple times.
                # Using set for target words handles the output, but processing time?
                # It's fine for now.
                
                stem = key_9[:i] + key_9[i+1:j] + key_9[j+1:]
                if stem in entries:
                    added_chars = key_9[i] + key_9[j] # Already sorted because key_9 is sorted and i < j
                    entries[stem]['ext2'][added_chars].add(word)

    # Sort entries by key
    sorted_keys = sorted(entries.keys())

    print(f"Writing {out_ext1_path}...")
    with open(out_ext1_path, 'w', encoding='utf-8') as f:
        for key in sorted_keys:
            data = entries[key]
            if not data['base']: # Should not happen based on logic
                continue
            
            f.write(f"{key}\n")
            # Write base words
            for word in sorted(data['base']):
                f.write(f"-{word}\n")
            
            # Write +1 extensions
            for char in sorted(data['ext1'].keys()):
                for word in sorted(data['ext1'][char]):
                    f.write(f"+{char} {word}\n")
            
            f.write("\n")

    print(f"Writing {out_full_path}...")
    with open(out_full_path, 'w', encoding='utf-8') as f:
        for key in sorted_keys:
            data = entries[key]
            if not data['base']:
                continue
            
            f.write(f"{key}\n")
            # Write base words
            for word in sorted(data['base']):
                f.write(f"-{word}\n")
            
            # Write +1 extensions
            for char in sorted(data['ext1'].keys()):
                for word in sorted(data['ext1'][char]):
                    f.write(f"+{char} {word}\n")
            
            # Write +2 extensions
            for chars in sorted(data['ext2'].keys()):
                for word in sorted(data['ext2'][chars]):
                    f.write(f"++{chars} {word}\n")
            
            f.write("\n")

    print("Done!")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    
    source_file = os.path.join(data_dir, 'ods8.txt')
    out_ext1 = os.path.join(data_dir, 'scrabble_dict_ext1.txt')
    out_full = os.path.join(data_dir, 'scrabble_dict_full.txt')
    
    generate_dictionaries(source_file, out_ext1, out_full)
