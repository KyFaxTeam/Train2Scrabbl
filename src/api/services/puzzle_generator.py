"""Puzzle generation service using Natural Flow."""

import uuid
from typing import Set, List, Optional

from src.models.gaddag import GADDAG
from src.models.board import Board
from src.modules.natural_flow import generer_situation_naturelle
from src.services.word_pool import WordPool
from src.api.models import (
    Puzzle, BoardConfig, BoardTile, Solution, PuzzleMetadata
)


def generate_puzzle(
    target_word: str,
    gaddag: GADDAG,
    all_words: Set[str],
    tirage: Optional[List[str]] = None,
    lettre_appui: Optional[str] = None
) -> Puzzle:
    """
    Generate a training puzzle for a target word.
    
    Args:
        target_word: The word the player should find
        gaddag: GADDAG structure for word validation
        all_words: Set of all valid words
        tirage: Optional specific rack tiles
        lettre_appui: Optional support letter (random if not provided)
        
    Returns:
        Puzzle object ready for frontend
    """
    import random
    
    # Create word pool
    word_pool = WordPool(gaddag)
    word_pool.set_words(all_words)
    
    # Pick support letter: use provided, or random letter from word
    if lettre_appui is None:
        lettre_appui = random.choice(list(target_word))
    elif lettre_appui not in target_word:
        lettre_appui = random.choice(list(target_word))
    
    if tirage is None:
        # Remove one occurrence of support letter from word to get tirage
        remaining = list(target_word)
        remaining.remove(lettre_appui)
        tirage = remaining
    
    # Generate situation using Natural Flow
    situation = generer_situation_naturelle(
        mot_cible=target_word,
        lettre_appui=lettre_appui,
        tirage=tirage,
        gaddag=gaddag,
        word_pool=word_pool
    )
    
    if situation is None:
        raise ValueError(f"Failed to generate situation for {target_word}")
    
    return situation_to_puzzle(situation, target_word, tirage)


def situation_to_puzzle(situation, target_word: str, tirage: List[str]) -> Puzzle:
    """Convert Natural Flow situation to Puzzle format."""
    
    # Extract board tiles
    initial_tiles: List[BoardTile] = []
    board = situation.grille
    
    for row in range(15):
        for col in range(15):
            cell = board.grid[row][col]
            if cell is not None:
                initial_tiles.append(BoardTile(
                    row=row,
                    col=col,
                    char=cell
                ))
    
    # Get solution placement
    sol = situation.solution
    direction = 'H' if sol.placement.direction == 'H' else 'V'
    
    # Calculate difficulty based on naturality score
    naturality = situation.score_naturalite
    score = naturality.score_global() if naturality else 0.0
    
    if score >= 150:
        difficulty = 'hard'
    elif score >= 100:
        difficulty = 'medium'
    else:
        difficulty = 'easy'
    
    # Extract words on board
    words_on_board = list(situation.mots_places) if hasattr(situation, 'mots_places') else []
    
    return Puzzle(
        id=str(uuid.uuid4()),
        rack=tirage,
        boardConfig=BoardConfig(
            rows=15,
            cols=15,
            initialTiles=initial_tiles
        ),
        solution=Solution(
            word=target_word,
            row=sol.placement.position[0],
            col=sol.placement.position[1],
            direction=direction,
            score=sol.score
        ),
        metadata=PuzzleMetadata(
            naturalityScore=score,
            wordsOnBoard=words_on_board,
            difficulty=difficulty
        )
    )
