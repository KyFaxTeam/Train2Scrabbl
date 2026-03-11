"""
Service de pool de mots pour Natural Flow.

Fournit des mots classifiés par longueur pour construire
des grilles naturelles avec une distribution réaliste.
"""

from typing import List, Dict, Set, Optional
from functools import lru_cache
import random


class WordPool:
    """Pool de mots classifiés par longueur pour Natural Flow."""
    
    def __init__(self, gaddag, words: Optional[Set[str]] = None):
        """
        Initialise le pool de mots.
        
        Args:
            gaddag: Structure GADDAG contenant le dictionnaire
            words: Ensemble optionnel de mots (si connu)
        """
        self.gaddag = gaddag
        self._cache: Dict[str, List[str]] = {}
        self._all_words: Optional[Set[str]] = words
    
    def set_words(self, words: Set[str]) -> None:
        """Définit l'ensemble des mots disponibles."""
        self._all_words = words
        self._cache.clear()  # Invalider le cache
    
    def _get_all_words(self) -> Set[str]:
        """Récupère tous les mots du GADDAG."""
        if self._all_words is None:
            self._all_words = set()
            # Le GADDAG stocke les mots - on doit les extraire
            if hasattr(self.gaddag, 'get_all_words'):
                self._all_words = set(self.gaddag.get_all_words())
            elif hasattr(self.gaddag, 'words'):
                self._all_words = set(self.gaddag.words)
            # Sinon, on garde un set vide - il faudra le peupler via set_words()
        return self._all_words
    
    def extraire_mots_par_longueur(
        self, 
        min_len: int, 
        max_len: int,
        limit: Optional[int] = None
    ) -> List[str]:
        """
        Extrait les mots d'une certaine longueur.
        
        Args:
            min_len: Longueur minimum (incluse)
            max_len: Longueur maximum (incluse)
            limit: Nombre maximum de mots à retourner
        
        Returns:
            Liste de mots de la longueur spécifiée
        """
        cache_key = f"{min_len}-{max_len}"
        
        if cache_key not in self._cache:
            all_words = self._get_all_words()
            filtered = [
                word for word in all_words 
                if min_len <= len(word) <= max_len
            ]
            self._cache[cache_key] = filtered
        
        words = self._cache[cache_key]
        
        if limit and len(words) > limit:
            return random.sample(words, limit)
        return words
    
    def get_mots_courts(self, limit: Optional[int] = 200) -> List[str]:
        """Mots de 2-4 lettres."""
        return self.extraire_mots_par_longueur(2, 4, limit)
    
    def get_mots_moyens(self, limit: Optional[int] = 150) -> List[str]:
        """Mots de 5-6 lettres."""
        return self.extraire_mots_par_longueur(5, 6, limit)
    
    def get_mots_longs(self, limit: Optional[int] = 100) -> List[str]:
        """Mots de 7-8 lettres."""
        return self.extraire_mots_par_longueur(7, 8, limit)
    
    def get_mots_contenant_lettre(
        self, 
        lettre: str, 
        min_len: int = 2, 
        max_len: int = 5
    ) -> List[str]:
        """
        Retourne les mots contenant une lettre spécifique.
        
        Utile pour la phase Anchor pour trouver un mot initial
        contenant la lettre d'appui.
        """
        all_words = self._get_all_words()
        return [
            word for word in all_words
            if lettre in word and min_len <= len(word) <= max_len
        ]


def creer_word_pool(gaddag) -> WordPool:
    """Factory function pour créer un WordPool."""
    return WordPool(gaddag)
