import sys
import os

def validate_dictionary(filepath):
    print(f"Validating {filepath}...")
    
    stats = {
        'entries': 0,
        'base_words': 0,
        'ext1_count': 0,
        'ext2_count': 0,
        'errors': 0
    }
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            current_key = None
            
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                    
                if line.startswith('-'):
                    # Base word
                    word = line[1:].strip()
                    if len(word) != 7:
                        print(f"Error line {line_num}: Base word '{word}' is not 7 letters")
                        stats['errors'] += 1
                    if current_key and "".join(sorted(word)) != current_key:
                        print(f"Error line {line_num}: Base word '{word}' does not match key '{current_key}'")
                        stats['errors'] += 1
                    stats['base_words'] += 1
                    
                elif line.startswith('++'):
                    # +2 extension
                    parts = line[2:].split()
                    if len(parts) != 2:
                        print(f"Error line {line_num}: Invalid +2 format '{line}'")
                        stats['errors'] += 1
                        continue
                        
                    chars, word = parts
                    if len(chars) != 2:
                        print(f"Error line {line_num}: Invalid +2 chars '{chars}'")
                        stats['errors'] += 1
                    if len(word) != 9:
                        print(f"Error line {line_num}: +2 extension '{word}' is not 9 letters")
                        stats['errors'] += 1
                    
                    # Verify anagram
                    if current_key:
                        expected = "".join(sorted(current_key + chars))
                        actual = "".join(sorted(word))
                        if expected != actual:
                            print(f"Error line {line_num}: +2 extension '{word}' is not valid extension of '{current_key}' + '{chars}'")
                            stats['errors'] += 1
                            
                    stats['ext2_count'] += 1
                    
                elif line.startswith('+'):
                    # +1 extension
                    parts = line[1:].split()
                    if len(parts) != 2:
                        print(f"Error line {line_num}: Invalid +1 format '{line}'")
                        stats['errors'] += 1
                        continue
                        
                    char, word = parts
                    if len(char) != 1:
                        print(f"Error line {line_num}: Invalid +1 char '{char}'")
                        stats['errors'] += 1
                    if len(word) != 8:
                        print(f"Error line {line_num}: +1 extension '{word}' is not 8 letters")
                        stats['errors'] += 1
                        
                    # Verify anagram
                    if current_key:
                        expected = "".join(sorted(current_key + char))
                        actual = "".join(sorted(word))
                        if expected != actual:
                            print(f"Error line {line_num}: +1 extension '{word}' is not valid extension of '{current_key}' + '{char}'")
                            stats['errors'] += 1
                            
                    stats['ext1_count'] += 1
                    
                else:
                    # Key
                    if len(line) != 7:
                        print(f"Error line {line_num}: Key '{line}' is not 7 letters")
                        stats['errors'] += 1
                    current_key = line
                    stats['entries'] += 1
                    
    except FileNotFoundError:
        print(f"Error: File {filepath} not found")
        return

    print("\nValidation Results:")
    print(f"  Entries (keys): {stats['entries']}")
    print(f"  Base words: {stats['base_words']}")
    print(f"  +1 Extensions: {stats['ext1_count']}")
    print(f"  +2 Extensions: {stats['ext2_count']}")
    print(f"  Errors: {stats['errors']}")
    
    if stats['errors'] == 0:
        print("SUCCESS: Dictionary is valid.")
    else:
        print("FAILURE: Dictionary has errors.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_dict.py <dictionary_file>")
    else:
        validate_dictionary(sys.argv[1])
