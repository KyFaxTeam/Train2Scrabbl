"""
FastAPI Backend for Scrabble Training.

Main application with CORS and lifespan management.
"""

import sys
import os
import logging
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

# Add parent directories to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Import directly from modules to avoid circular imports via __init__.py
from src.models.gaddag import GADDAG

# Global state
app_state = {
    "gaddag": None,
    "all_words": set(),
    "ready": False
}


def load_dictionary_ods(filepath: str) -> Set[str]:
    """Load ODS dictionary (one word per line)."""
    words = set()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip().upper()
                if word and len(word) >= 2:
                    words.add(word)
    except FileNotFoundError:
        logger.error("Dictionary file not found: %s", filepath)
    return words


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load GADDAG on startup, cleanup on shutdown."""
    logger.info("Starting Scrabble Training API...")
    
    # Load dictionary
    dict_path = os.path.join(project_root, "data", "ods8.txt")
    logger.info("Loading dictionary from %s...", dict_path)
    app_state["all_words"] = load_dictionary_ods(dict_path)
    logger.info("Loaded %d words", len(app_state['all_words']))
    
    # Build GADDAG with cache
    logger.info("Loading GADDAG structure (with cache)...")
    app_state["gaddag"] = GADDAG.load_with_cache(dict_path)
    logger.info("GADDAG ready!")
    
    app_state["ready"] = True
    logger.info("API ready to serve requests!")
    
    app_state["ready"] = True
    logger.info("API ready to serve requests!")
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")
    app_state["gaddag"] = None
    app_state["all_words"] = set()
    app_state["ready"] = False


# Create FastAPI app
app = FastAPI(
    title="Scrabble Training API",
    description="Generate training puzzles using Natural Flow algorithm",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic model for health response
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    dictionarySize: int
    gaddagReady: bool


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Check if the API is ready."""
    return HealthResponse(
        status="ready" if app_state["ready"] else "loading",
        dictionarySize=len(app_state["all_words"]),
        gaddagReady=app_state["gaddag"] is not None
    )


# Import and include routers after app is created
from src.api.routes.training import router as training_router
app.include_router(training_router, prefix="/api/training", tags=["training"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

