
import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.models.gaddag import GADDAG

print('Loading words...')
t0 = time.time()
words = []
with open('data/ods8.txt', 'r', encoding='utf-8') as f:
    for line in f:
        w = GADDAG.normalize_word(line.strip())
        if len(w) >= 2 and len(w) <= 15:
            words.append(w)
print('Loaded', len(words), 'words in', time.time()-t0, 's')

g = GADDAG()
print('Adding words...')
t0 = time.time()
for i, w in enumerate(words):
    g.add_word(w)
    if i % 50000 == 0:
        print(f' Added {i} words...')
print('Finished adding words in', time.time()-t0, 's')

stats = g.get_statistics()
print(stats)
print('Minimizing...')
t0 = time.time()
g.semi_minimize()
print('Minimized in', time.time()-t0, 's')
stats = g.get_statistics()
print(stats)
