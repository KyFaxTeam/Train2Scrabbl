"""Pydantic models for API responses."""

from pydantic import BaseModel
from typing import List, Optional, Literal


class BoardTile(BaseModel):
    """A tile on the board."""
    row: int
    col: int
    char: str


class BoardConfig(BaseModel):
    """Board configuration."""
    rows: int = 15
    cols: int = 15
    initialTiles: List[BoardTile]


class Solution(BaseModel):
    """Solution for a puzzle."""
    word: str
    row: int
    col: int
    direction: Literal['H', 'V']
    score: int


class PuzzleMetadata(BaseModel):
    """Additional puzzle metadata."""
    naturalityScore: float
    wordsOnBoard: List[str]
    difficulty: Literal['easy', 'medium', 'hard'] = 'medium'


class Puzzle(BaseModel):
    """A training puzzle."""
    id: str
    rack: List[str]
    boardConfig: BoardConfig
    solution: Solution
    metadata: PuzzleMetadata


class PuzzleResponse(BaseModel):
    """Response for single puzzle endpoint."""
    puzzle: Puzzle
    generationTimeMs: float


class BatchResponse(BaseModel):
    """Response for batch puzzle endpoint."""
    puzzles: List[Puzzle]
    generationTimeMs: float
    count: int


class GenerateRequest(BaseModel):
    """Request to generate puzzle for specific word."""
    word: str
    tirage: Optional[List[str]] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    dictionarySize: int
    gaddagReady: bool
