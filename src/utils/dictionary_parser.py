from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional

@dataclass
class DictionaryEntry:
    sorted_letters: str
    base_words: List[str] = field(default_factory=list)
    extensions_1: Dict[str, List[str]] = field(default_factory=dict)  # letter -> list of words

def parse_dictionary(filepath: str) -> Dict[str, DictionaryEntry]:
    """
    Parse the compact dictionary format.
    Returns a dictionary mapping sorted_letters -> DictionaryEntry
    """
    entries: Dict[str, DictionaryEntry] = {}
    current_entry: Optional[DictionaryEntry] = None
    
    print(f"Parsing dictionary from {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                if line.startswith('-'):
                    # Base word
                    if current_entry:
                        current_entry.base_words.append(line[1:].strip())
                
                elif line.startswith('++'):
                    # +2 extension - ignore for now as per plan
                    pass
                    
                elif line.startswith('+'):
                    # +1 extension
                    if current_entry:
                        parts = line[1:].split()
                        if len(parts) == 2:
                            char, word = parts
                            if char not in current_entry.extensions_1:
                                current_entry.extensions_1[char] = []
                            current_entry.extensions_1[char].append(word)
                
                else:
                    # Key (sorted letters)
                    current_entry = DictionaryEntry(sorted_letters=line)
                    entries[line] = current_entry
                    
    except FileNotFoundError:
        print(f"Error: Dictionary file {filepath} not found")
        return {}
        
    print(f"Parsed {len(entries)} entries")
    return entries

def get_extensions(entries: Dict[str, DictionaryEntry], sorted_letters: str, extension_letter: str) -> List[str]:
    """Get all +1 extensions for a given 7-letter combination and letter"""
    if sorted_letters in entries:
        return entries[sorted_letters].extensions_1.get(extension_letter, [])
    return []
