from typing import Dict, Set, List, Tuple
import re
import unicodedata
import pickle
import hashlib
import os
import logging

from .node import Node  # Corrected relative import

logger = logging.getLogger(__name__)

class GADDAG:
    """Structure de données GADDAG pour le Scrabble."""

    DELIMITER = 'e'
    MIN_WORD_LENGTH = 2
    MAX_WORD_LENGTH = 15
    VALID_WORD_PATTERN = re.compile(r'^[A-Z]+$')

    @staticmethod
    def normalize_word(word: str) -> str:
        if not word:
            return ""
        word = word.upper()
        word = unicodedata.normalize('NFKD', word)
        word = ''.join(c for c in word if not unicodedata.combining(c))
        replacements = {
            'Œ': 'OE',
            'œ': 'OE'
        }
        for old, new in replacements.items():
            word = word.replace(old, new)
        word = ''.join(c for c in word if c.isalpha())
        return word

    @classmethod
    def from_word_list(cls, words: List[str]) -> 'GADDAG':
        gaddag = cls()
        for word in words:
            gaddag.add_word(word)
        return gaddag

    def __init__(self):
        self.root = Node()
        self.word_count = 0
        self.minimization_cache = {}

    def contains(self, word: str) -> bool:
        word = self.normalize_word(word)
        if not self.is_valid_word(word):
            return False

        node = self.root
        for char in word:
            node = node.get_transition(char)
            if not node:
                break
        if node and node.is_terminal:
            return True

        node = self.root
        for char in self.DELIMITER + word:
            node = node.get_transition(char)
            if not node:
                return False
        return node.is_terminal

    def _add_word_sequence(self, sequence: str) -> None:
        node = self.root
        for char in sequence:
            node = node.add_transition(char)
        node.is_terminal = True

    def add_word(self, word: str) -> None:
        word = self.normalize_word(word)
        if not word or self.DELIMITER in word or not self.is_valid_word(word):
            return

        sequence = self.DELIMITER + word
        self._add_word_sequence(sequence)

        for i in range(len(word)):
            reversed_part = word[i::-1]
            remaining_part = word[i+1:]
            sequence = reversed_part + self.DELIMITER + remaining_part
            self._add_word_sequence(sequence)

        self.word_count += 1

    def get_possible_letters(self, prefix: str) -> Set[str]:
        node = self.root
        for char in prefix:
            node = node.get_transition(char)
            if not node:
                return set()
        return set(node.transitions.keys())

    def load_dictionary(self, filepath: str) -> int:
        words_loaded = 0
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    word = self.normalize_word(line.strip())
                    if self.is_valid_word(word):
                        self.add_word(word)
                        words_loaded += 1
        except FileNotFoundError:
            raise FileNotFoundError(f"Dictionnaire non trouvé: {filepath}")
        return words_loaded

    def is_valid_word(self, word: str) -> bool:
        return (self.MIN_WORD_LENGTH <= len(word) <= self.MAX_WORD_LENGTH and
                bool(self.VALID_WORD_PATTERN.match(word)))

    def _get_node_signature(self, node: Node) -> str:
        transitions = sorted((char, id(target)) for char, target in node.transitions.items())
        return f"{node.is_terminal}:{','.join(f'{c}:{i}' for c, i in transitions)}"

    def semi_minimize(self) -> None:
        self.minimization_cache.clear()

        def minimize_node(node: Node) -> Node:
            signature = self._get_node_signature(node)
            if signature in self.minimization_cache:
                return self.minimization_cache[signature]

            for char in list(node.transitions.keys()):
                target = node.transitions[char]
                minimized_target = minimize_node(target)
                if minimized_target is not target:
                    node.transitions[char] = minimized_target

            new_signature = self._get_node_signature(node)
            if new_signature in self.minimization_cache:
                return self.minimization_cache[new_signature]

            self.minimization_cache[new_signature] = node
            return node
        self.root = minimize_node(self.root)
        self.minimization_cache.clear()

    def get_statistics(self) -> Dict[str, int]:
        stats = {
            'word_count': self.word_count,
            'node_count': 0,
            'transition_count': 0
        }
        visited = set()
        def count_nodes(node: Node) -> None:
            if id(node) in visited:
                return
            visited.add(id(node))
            stats['node_count'] += 1
            stats['transition_count'] += len(node.transitions)
            for target in node.transitions.values():
                count_nodes(target)
        count_nodes(self.root)
        return stats

    def _validate_word(self, word: str, skeleton: Dict[int, str], available: Set[str]) -> bool:
        word_len = len(word)
        max_skel_pos = max(skeleton.keys(), default=-1)
        if word_len <= max_skel_pos:
            return False

        all_allowed_letters = available | set(skeleton.values())

        for i, letter in enumerate(word):
            if i in skeleton:
                if skeleton[i] != letter:
                    return False
            elif letter not in all_allowed_letters:
                return False
        return True

    def _validate_partial_word(self, word: str, word_start: int, skeleton: Dict[int, str]) -> bool:
        word_len = len(word)
        for pos, required in skeleton.items():
            rel_pos = pos - word_start
            if 0 <= rel_pos < word_len:
                if word[rel_pos] != required:
                    return False
        return True

    def _search_forward(self, node: Node, word: str, word_start: int,
                       skeleton: Dict[int, str], all_available: Set[str],
                       words: Set[str], word_length:int, max_len: int = 15 ) -> None:

        if word_length > max_len:
            return

        if not self._validate_partial_word(word, word_start, skeleton):
            return

        if node.is_terminal and word_length >= self.MIN_WORD_LENGTH:
            if self._validate_word(word, skeleton, all_available):
                words.add(word)

        current_pos = word_start + len(word) - 1
        for letter, next_node in node.transitions.items():
            next_pos = current_pos + 1

            if next_pos in skeleton:
                if letter == skeleton[next_pos]:
                    self._search_forward(next_node, word + letter, word_start, skeleton, all_available, words, word_length + 1, max_len)
            elif letter in all_available:
                self._search_forward(next_node, word + letter, word_start, skeleton, all_available, words, word_length + 1, max_len)

    def _search_backward(self, node: Node, word: str, pos: int,
                        skeleton: Dict[int, str], all_available: Set[str],
                        words: Set[str], word_length: int = 0) -> None:

        if node.is_terminal:
            if self._validate_word(word, skeleton, all_available):
                words.add(word)

        for letter, next_node in node.transitions.items():
            if letter == self.DELIMITER:
                self._search_forward(next_node, word, pos + 1, skeleton, all_available, words, word_length, self.MAX_WORD_LENGTH)
            else:
                if pos in skeleton:
                    if letter == skeleton[pos]:
                        self._search_backward(next_node, letter + word, pos - 1, skeleton, all_available, words, word_length + 1)
                elif letter in all_available:
                    self._search_backward(next_node, letter + word, pos - 1, skeleton, all_available, words, word_length + 1)

    def find_words_with_skeleton(self, skeleton: Dict[int, str], available_letters: Set[str]) -> List[str]:
        norm_skeleton = {pos: self.normalize_word(letter) for pos, letter in skeleton.items()}
        norm_available = set(self.normalize_word(letter) for letter in available_letters)
        all_available = norm_available | set(norm_skeleton.values())
        words = set()

        max_skeleton_pos = max(norm_skeleton.keys(), default=-1)
        self._search_backward(self.root, "", max_skeleton_pos + 1, norm_skeleton, all_available, words)
        return sorted(words)

    def save_cache(self, cache_path: str) -> None:
        """Sérialise le GADDAG vers un fichier pickle."""
        with open(cache_path, 'wb') as f:
            pickle.dump((self.root, self.word_count), f, protocol=pickle.HIGHEST_PROTOCOL)
        logger.info("GADDAG cache sauvegardé: %s", cache_path)

    @classmethod
    def load_cache(cls, cache_path: str) -> 'GADDAG':
        """Charge un GADDAG depuis un fichier pickle."""
        gaddag = cls()
        with open(cache_path, 'rb') as f:
            gaddag.root, gaddag.word_count = pickle.load(f)
        logger.info("GADDAG chargé depuis cache: %d mots", gaddag.word_count)
        return gaddag

    @staticmethod
    def _file_hash(filepath: str) -> str:
        """Calcule un hash MD5 du fichier dictionnaire."""
        h = hashlib.md5()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                h.update(chunk)
        return h.hexdigest()

    @classmethod
    def load_with_cache(cls, dict_path: str, cache_dir: str = None) -> 'GADDAG':
        """Charge le GADDAG depuis le cache si disponible, sinon construit et cache."""
        if cache_dir is None:
            cache_dir = os.path.dirname(dict_path)

        dict_hash = cls._file_hash(dict_path)
        cache_path = os.path.join(cache_dir, f"gaddag_{dict_hash}.pkl")

        if os.path.exists(cache_path):
            try:
                gaddag = cls.load_cache(cache_path)
                return gaddag
            except Exception as e:
                logger.warning("Cache GADDAG invalide, reconstruction: %s", e)

        logger.info("Construction du GADDAG depuis %s...", dict_path)
        gaddag = cls()
        gaddag.load_dictionary(dict_path)
        gaddag.save_cache(cache_path)
        return gaddag