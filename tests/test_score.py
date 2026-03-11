from src.models.board import Board, SquareType
from src.services.score_calculator import ScoreCalculator
from src.models.types import Direction, Move

def test_scores() -> None:
    """Test du système complet de calcul des scores."""
    # Test des multiplicateurs simples
    test_multiplicateurs()
    
    # Test des mots croisés
    test_multiplicateurs_mots_croises()

def test_multiplicateurs() -> None:
    """Test des multiplicateurs du plateau."""
    # ZOO at center: Z=10, O=1, O=1. Center (7,7) is DW.
    board = Board()
    calculator = ScoreCalculator(board)
    move = Move("ZOO", 7, 7, Direction.HORIZONTAL)
    score = calculator.calculate_move_score(move)
    # (10+1+1)*2 = 24
    assert score == 24, f"ZOO at center: expected 24, got {score}"

    # AXE at H1 (row 7, col 0): A=1, X=10, E=1
    # (7,0) is TRIPLE_WORD → (1+10+1)*3 = 36
    board2 = Board()
    calc2 = ScoreCalculator(board2)
    move2 = Move("AXE", 7, 0, Direction.HORIZONTAL)
    score2 = calc2.calculate_move_score(move2)
    assert score2 == 36, f"AXE at H1: expected 36, got {score2}"

def test_multiplicateurs_mots_croises() -> None:
    """Test des scores avec des mots qui se croisent."""
    # Test 1: PAR then ART crossing through A
    board = Board()
    calculator = ScoreCalculator(board)
    
    # PAR at H8 horizontal: P(7,7)=DW, A(7,8), R(7,9)
    move1 = Move("PAR", 7, 7, Direction.HORIZONTAL)
    score1 = calculator.calculate_move_score(move1)
    board.apply_move(move1, score1)
    # (3+1+1)*2 = 10
    assert score1 == 10, f"PAR at center: expected 10, got {score1}"
    
    # ART at col 8 vertical through A: A(7,8)=existing, R(8,8)=DL, T(9,8)
    move2 = Move("ART", 7, 8, Direction.VERTICAL)
    score2 = calculator.calculate_move_score(move2)
    # A(7,8): existing → 1. R(8,8): DL → 1*2=2. T(9,8): normal → 1.
    # (1+2+1)*1 = 4
    assert score2 == 4, f"ART crossing PAR: expected 4, got {score2}"
    
    # Test 2: THE then CHAT crossing through H
    board2 = Board()
    calc2 = ScoreCalculator(board2)
    
    # THE at H8 horizontal: T(7,7)=DW, H(7,8), E(7,9)
    m1 = Move("THE", 7, 7, Direction.HORIZONTAL)
    s1 = calc2.calculate_move_score(m1)
    board2.apply_move(m1, s1)
    # (1+4+1)*2 = 12
    assert s1 == 12, f"THE at center: expected 12, got {s1}"
    
    # CHAT at G9 vertical through H: C(6,8)=DL, H(7,8)=existing, A(8,8)=DL, T(9,8)
    m2 = Move("CHAT", 6, 8, Direction.VERTICAL)
    s2 = calc2.calculate_move_score(m2)
    # C(6,8): DL → 3*2=6. H(7,8): existing → 4. A(8,8): DL → 1*2=2. T(9,8): → 1.
    # (6+4+2+1)*1 = 13
    assert s2 == 13, f"CHAT crossing THE: expected 13, got {s2}"

def test_score_simulation():
    """Test that score simulation doesn't modify board state."""
    board = Board()
    calculator = ScoreCalculator(board)
    
    # Place first word
    move1 = Move("PAR", 7, 7, Direction.HORIZONTAL)
    actual_score1 = calculator.calculate_move_score(move1)
    board.apply_move(move1, actual_score1)
    
    # Simulate second word (through A of PAR)
    move2 = Move("ART", 7, 8, Direction.VERTICAL)
    simulated_score = calculator.simulate_move_score(move2)
    
    # Board should be unchanged after simulation: only PAR letters present
    placed_count = sum(1 for r in range(board.size) for c in range(board.size) if board.get_letter(r, c))
    assert placed_count == 3, "Board was modified during simulation"
    assert board.total_score == actual_score1, "Score was modified during simulation"
    
    # Actually place second word
    actual_score2 = calculator.calculate_move_score(move2)
    assert simulated_score == actual_score2, "Simulated score differs from actual"

if __name__ == "__main__":
    test_multiplicateurs()
    test_multiplicateurs_mots_croises()
    test_score_simulation()
