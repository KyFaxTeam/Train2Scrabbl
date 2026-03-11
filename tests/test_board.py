from src.models.board import Board

def test_plateau():
    """
    Test des fonctionnalités basiques du plateau :
    1. Système de coordonnées (A1-O15)
    2. Règles de placement :
       - Premier coup au centre (H8)
       - Coups suivants adjacents
       - Une lettre par case
    """
    board = Board()
    
    # Le plateau est initialement vide (15x15 de None)
    assert board.is_empty(), "Le plateau devrait être vide"
    
    # Place une lettre au centre
    row, col = board.parse_coordinates("H8")
    board.place_letter(row, col, "S")
    assert board.get_letter(row, col) == "S"
    assert not board.is_empty()
    
    # Place des lettres adjacentes
    row2, col2 = board.parse_coordinates("H7")
    board.place_letter(row2, col2, "C")
    assert board.get_letter(row2, col2) == "C"
    
    row3, col3 = board.parse_coordinates("H9")
    board.place_letter(row3, col3, "R")
    assert board.get_letter(row3, col3) == "R"

def test_coordonnees():
    """Test spécifique du système de coordonnées."""
    board = Board()
    
    # Coordonnées valides
    row, col = board.parse_coordinates("H8")
    assert row == 7 and col == 7
    
    row, col = board.parse_coordinates("A1")
    assert row == 0 and col == 0
    
    row, col = board.parse_coordinates("O15")
    assert row == 14 and col == 14
    
    # Coordonnées invalides
    import pytest
    invalid_coords = ["P1", "A16", "AA", "11", ""]
    for coord in invalid_coords:
        with pytest.raises(ValueError):
            board.parse_coordinates(coord)
