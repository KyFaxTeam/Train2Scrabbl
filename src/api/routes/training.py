"""Training endpoints for puzzle generation."""

import sys
import os
import time
import random
import logging
from typing import List

logger = logging.getLogger(__name__)

# Ensure project root is in path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

# Import app_state from main
from src.api.main import app_state


# Pydantic models defined locally to avoid circular imports
class BoardTile(BaseModel):
    row: int
    col: int
    char: str

class BoardConfig(BaseModel):
    rows: int = 15
    cols: int = 15
    initialTiles: List[BoardTile]

class Solution(BaseModel):
    word: str
    row: int
    col: int
    direction: str  # 'H' or 'V'
    score: int

class PuzzleMetadata(BaseModel):
    naturalityScore: float
    wordsOnBoard: List[str]
    difficulty: str = 'medium'

class Puzzle(BaseModel):
    id: str
    rack: List[str]
    boardConfig: BoardConfig
    solution: Solution
    metadata: PuzzleMetadata

class PuzzleResponse(BaseModel):
    puzzle: Puzzle
    generationTimeMs: float

class BatchResponse(BaseModel):
    puzzles: List[Puzzle]
    generationTimeMs: float
    count: int

class GenerateRequest(BaseModel):
    word: str
    tirage: Optional[List[str]] = None
    lettre_appui: Optional[str] = None


router = APIRouter()


def generate_puzzle_internal(target_word: str, tirage: Optional[List[str]] = None, lettre_appui: Optional[str] = None) -> Puzzle:
    """Generate a puzzle using Natural Flow."""
    import uuid
    from src.modules.natural_flow import generer_situation_naturelle
    from src.services.word_pool import WordPool
    
    gaddag = app_state["gaddag"]
    all_words = app_state["all_words"]
    
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
    
    # Convert situation to Puzzle
    initial_tiles: List[BoardTile] = []
    board = situation.grille
    
    for row in range(15):
        for col in range(15):
            cell = board.grid[row][col]
            if cell is not None:
                initial_tiles.append(BoardTile(row=row, col=col, char=cell))
    
    # Get solution
    sol = situation.solution
    direction = 'H' if sol.placement.direction == 'H' else 'V'
    
    # Calculate difficulty
    naturality = situation.score_naturalite
    score = naturality.score_global() if naturality else 0.0
    
    if score >= 150:
        difficulty = 'hard'
    elif score >= 100:
        difficulty = 'medium'
    else:
        difficulty = 'easy'
    
    # Get words on board
    words_on_board = list(situation.mots_places) if hasattr(situation, 'mots_places') else []
    
    return Puzzle(
        id=str(uuid.uuid4()),
        rack=tirage,
        boardConfig=BoardConfig(rows=15, cols=15, initialTiles=initial_tiles),
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


@router.get("/puzzle", response_model=PuzzleResponse)
async def get_puzzle():
    """Get a random training puzzle."""
    if not app_state["ready"]:
        raise HTTPException(status_code=503, detail="API not ready, GADDAG still loading")
    
    start_time = time.time()
    
    # Pick a random 7-8 letter word from dictionary
    long_words = [w for w in app_state["all_words"] if 7 <= len(w) <= 8]
    if not long_words:
        raise HTTPException(status_code=500, detail="No suitable words in dictionary")
    
    target_word = random.choice(long_words)
    
    try:
        puzzle = generate_puzzle_internal(target_word)
        elapsed_ms = (time.time() - start_time) * 1000
        
        return PuzzleResponse(puzzle=puzzle, generationTimeMs=elapsed_ms)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/generate", response_model=PuzzleResponse)
async def generate_for_word(request: GenerateRequest):
    """Generate a puzzle for a specific word."""
    if not app_state["ready"]:
        raise HTTPException(status_code=503, detail="API not ready, GADDAG still loading")
    
    word = request.word.upper()
    
    # Validate word exists
    if word not in app_state["all_words"]:
        raise HTTPException(status_code=400, detail=f"Word '{word}' not in dictionary")
    
    start_time = time.time()
    
    try:
        puzzle = generate_puzzle_internal(word, request.tirage, request.lettre_appui)
        elapsed_ms = (time.time() - start_time) * 1000
        
        return PuzzleResponse(puzzle=puzzle, generationTimeMs=elapsed_ms)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.get("/batch", response_model=BatchResponse)
async def get_batch(size: int = Query(default=5, ge=1, le=20)):
    """Get a batch of training puzzles."""
    if not app_state["ready"]:
        raise HTTPException(status_code=503, detail="API not ready, GADDAG still loading")
    
    start_time = time.time()
    
    # Pick random 7-8 letter words
    long_words = [w for w in app_state["all_words"] if 7 <= len(w) <= 8]
    if len(long_words) < size:
        raise HTTPException(status_code=500, detail="Not enough words in dictionary")
    
    target_words = random.sample(long_words, size)
    puzzles: List[Puzzle] = []
    
    for word in target_words:
        try:
            puzzle = generate_puzzle_internal(word)
            puzzles.append(puzzle)
        except Exception as e:
            logger.warning("Failed to generate puzzle for %s: %s", word, e)
            continue
    
    elapsed_ms = (time.time() - start_time) * 1000
    
    if not puzzles:
        raise HTTPException(status_code=500, detail="Failed to generate any puzzles")
    
    return BatchResponse(puzzles=puzzles, generationTimeMs=elapsed_ms, count=len(puzzles))

