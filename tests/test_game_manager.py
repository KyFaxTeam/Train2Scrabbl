from src.models.board import Board
from src.models.gaddag import GADDAG
from src.services.game_manager import GameManager
from src.models.types import Direction, Move

def setup_test_environment():
    """Prépare l'environnement de test."""
    board = Board()
    gaddag = GADDAG()
    # Ajoute quelques mots de test
    test_words = ["THE", "PAR", "ART", "CHAT", "CHIEN", "TABLE", "HE"]
    for word in test_words:
        gaddag.add_word(word)
    return GameManager(board, gaddag)

def test_place_move():
    """Test le placement d'un coup et le calcul du score."""
    game = setup_test_environment()
    
    # Premier coup
    move1 = Move("PAR", 7, 7, Direction.HORIZONTAL)
    score1 = game.place_move(move1)
    assert score1 is not None, "Le coup devrait être valide"
    assert score1 > 0, "Le score devrait être positif"
    
    # Coup invalide (mot inexistant)
    move_invalid = Move("XYZ", 7, 6, Direction.HORIZONTAL)
    assert game.place_move(move_invalid) is None, "Le coup devrait être invalide"
    
    # Coup croisé valide - Modifié pour utiliser le 'A' de "PAR"
    move2 = Move("ART", 7, 8, Direction.VERTICAL)  # Changé de (6,7) à (7,8)
    score2 = game.place_move(move2)
    assert score2 is not None, "Le coup croisé devrait être valide"
    
    # Vérifie l'état du jeu
    state = game.get_game_state()
    assert state['total_score'] == score1 + score2, "Score total incorrect"
    assert len(state['move_history']) == 2, "Historique des coups incorrect"

def test_suggest_moves():
    """Test la suggestion de coups."""
    game = setup_test_environment()
    
    # Place un premier mot
    game.place_move(Move("THE", 7, 7, Direction.HORIZONTAL))
    
    # Demande des suggestions
    suggestions = game.suggest_moves("CHATIN")
    assert len(suggestions) > 0, "Devrait trouver au moins un coup possible"
    
    # Vérifie que les suggestions sont triées par score
    scores = [score for _, score in suggestions]
    assert scores == sorted(scores, reverse=True), "Les suggestions devraient être triées par score"
    
    # Vérifie que les suggestions sont valides
    for move, _ in suggestions:
        assert game.validator.is_valid_move(
            move.word, move.row, move.col, move.direction
        ), f"Le coup {move.word} devrait être valide"

def test_undo_move():
    """Test l'annulation d'un coup."""
    game = setup_test_environment()
    
    # Place un coup
    move = Move("TABLE", 7, 7, Direction.HORIZONTAL)
    score = game.place_move(move)
    
    # Vérifie l'état avant annulation
    assert game.board.get_total_score() == score
    assert len(game.board.get_move_history()) == 1
    
    # Annule le coup
    undone = game.undo_last_move()
    assert undone is not None, "L'annulation devrait réussir"
    assert undone[0].word == move.word, "Devrait annuler le bon coup"
    assert undone[1] == score, "Devrait retourner le bon score"
    
    # Vérifie l'état après annulation
    assert game.board.get_total_score() == 0
    assert len(game.board.get_move_history()) == 0
    assert game.board.is_empty(), "Le plateau devrait être vide"

def test_game_flow():
    """Test un flux de jeu complet."""
    game = setup_test_environment()
    
    # Simule une partie avec des mots qui se croisent correctement
    moves = [
        ("THE", 7, 7, Direction.HORIZONTAL),  # Place THE horizontalement
        ("CHAT", 6, 8, Direction.VERTICAL),   # Place CHAT verticalement au-dessus du H
        ("CHIEN", 6, 8, Direction.HORIZONTAL) # Place CHIEN au-dessus
    ]
    
    scores = []
    for word, row, col, direction in moves:
        move = Move(word, row, col, direction)
        score = game.place_move(move)
        assert score is not None, f"Le coup {word} devrait être valide"
        scores.append(score)
        
    # Vérifie l'état final
    state = game.get_game_state()
    assert state['total_score'] == sum(scores), "Score total incorrect"
    assert len(state['move_history']) == len(moves), "Historique incomplet"
    print(f"\nPlateau final:\n{state['board']}")
    print(f"Score total: {state['total_score']}")

if __name__ == "__main__":
    print("=== Tests du GameManager ===")
    test_place_move()
    test_suggest_moves()
    test_undo_move()
    test_game_flow()
    print("Tous les tests ont réussi !")
