
import sys
import os
import time
import struct

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.models.gaddag import GADDAG

def compile_gaddag(dict_path, output_path):
    print(f'Loading words from {dict_path}...')
    t0 = time.time()
    words = []
    with open(dict_path, 'r', encoding='utf-8') as f:
        for line in f:
            w = GADDAG.normalize_word(line.strip())
            if len(w) >= 2 and len(w) <= 15:
                words.append(w)
    print(f'Loaded {len(words)} words in {time.time()-t0:.2f}s')

    g = GADDAG()
    print('Building GADDAG...')
    t0 = time.time()
    for i, w in enumerate(words):
        g.add_word(w)
        if (i+1) % 50000 == 0:
            print(f' Added {i+1} words...')
    print(f'Finished building in {time.time()-t0:.2f}s')

    print('Minimizing GADDAG...')
    t0 = time.time()
    g.semi_minimize()
    print(f'Minimized in {time.time()-t0:.2f}s')

    print('Flattening graph for binary export...')
    t0 = time.time()
    unique_nodes = [] 
    node_to_id = {} 
    
    def find_nodes(node):
        if id(node) in node_to_id:
            return
        node_to_id[id(node)] = len(unique_nodes)
        unique_nodes.append(node)
        for target in node.transitions.values():
            find_nodes(target)
            
    find_nodes(g.root)
    print(f'Found {len(unique_nodes)} unique nodes')
    
    node_offsets = {}
    current_offset = 0
    for node in unique_nodes:
        node_offsets[id(node)] = current_offset
        current_offset += 1 + len(node.transitions)
        
    print(f'Total 32-bit words required: {current_offset} ({current_offset * 4 / 1024 / 1024:.2f} MB)')
    
    def char_to_code(c: str) -> int:
        if c == 'e': return 27
        return ord(c) - 64
        
    buffer = []
    for node in unique_nodes:
        header = len(node.transitions)
        if node.is_terminal:
            header |= 0x80000000
        buffer.append(header)
        
        for char, target in node.transitions.items():
            code = char_to_code(char)
            target_offset = node_offsets[id(target)]
            trans_word = (code << 27) | target_offset
            buffer.append(trans_word)
            
    print(f'Done converting to buffer in {time.time()-t0:.2f}s. Saving to {output_path}...')
    with open(output_path, 'wb') as f:
        f.write(struct.pack(f'<{len(buffer)}I', *buffer))
    
    print('Compilation successful!')

if __name__ == '__main__':
    dict_path = 'data/ods8.txt'
    output_path = 'frontend_new/public/data/gaddag.bin'
    compile_gaddag(dict_path, output_path)
