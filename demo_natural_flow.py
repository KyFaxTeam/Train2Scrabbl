"""
Démonstration du Natural Flow - Génération de situations d'entraînement

Ce script génère et affiche des situations d'entraînement réalistes
pour apprendre à repérer des mots au Scrabble.
"""

from src.models.gaddag import GADDAG
from src.services.word_pool import WordPool
from src.modules.natural_flow import generer_situation_naturelle


def afficher_situation(resultat, mot_cible: str):
    """Affiche une situation d'entraînement de manière claire et pédagogique."""
    
    if not resultat:
        print(f"\n❌ Impossible de générer une situation pour '{mot_cible}'")
        return
    
    print('\n' + '='*80)
    print(f' 🎯 SITUATION D\'ENTRAÎNEMENT: {mot_cible}')
    print('='*80)
    
    # Informations sur le défi
    print(f'\n📊 Statistiques:')
    print(f'   • Score de naturalité: {resultat.score_naturalite.score_global():.1f}/100')
    print(f'   • Nombre de mots sur la grille: {len(resultat.mots_places)}')
    print(f'   • Score du coup: {resultat.solution.score} points')
    
    # Le plateau
    print('\n' + '─'*80)
    print('📋 PLATEAU DE JEU')
    print('─'*80)
    print(resultat.grille)
    
    # Défi pour le joueur
    print('\n' + '─'*80)
    print('🎲 VOTRE DÉFI')
    print('─'*80)
    tirage_str = ' '.join(resultat.tirage)
    print(f'\nVotre tirage: [ {tirage_str} ]')
    print(f'\nPouvez-vous trouver où jouer un mot de {len(mot_cible)} lettres ?')
    print('\n(Appuyez sur Entrée pour voir la solution...)')
    input()
    
    # Solution
    print('\n' + '─'*80)
    print('✅ SOLUTION')
    print('─'*80)
    row, col = resultat.solution.placement.position
    direction = resultat.solution.placement.direction
    ligne_nom = chr(65 + row)
    dir_texte = 'HORIZONTAL' if direction == 'H' else 'VERTICAL'
    
    print(f'\n🎯 Mot à jouer: {mot_cible}')
    print(f'📍 Position: Ligne {ligne_nom}, Colonne {col+1}')
    print(f'➡️  Direction: {dir_texte}')
    print(f'💰 Score: {resultat.solution.score} points')
    
    # Visualisation de la solution
    print(f'\n📝 Explication:')
    if direction == 'H':
        print(f'   Placez {mot_cible} horizontalement à partir de {ligne_nom}{col+1}')
        positions = [f'{ligne_nom}{col+i+1}' for i in range(len(mot_cible))]
    else:
        print(f'   Placez {mot_cible} verticalement à partir de {ligne_nom}{col+1}')
        positions = [f'{chr(65+row+i)}{col+1}' for i in range(len(mot_cible))]
    
    lettres_avec_pos = list(zip(mot_cible, positions))
    for lettre, pos in lettres_avec_pos:
        print(f'      {lettre} → {pos}')
    
    # Mots déjà présents (contexte)
    print(f'\n📚 Mots déjà sur la grille:')
    for i, mot in enumerate(resultat.mots_places, 1):
        print(f'   {i}. {mot}')


def main():
    """Point d'entrée principal."""
    
    print('='*80)
    print(' 🏆 NATURAL FLOW - GÉNÉRATEUR DE SITUATIONS D\'ENTRAÎNEMENT SCRABBLE')
    print('='*80)
    print('\nCe programme génère des grilles de Scrabble réalistes pour')
    print('s\'entraîner à repérer des mots jouables.')
    
    # Chargement du dictionnaire
    print('\n⏳ Chargement du dictionnaire ODS8...')
    gaddag = GADDAG()
    mots_charges = gaddag.load_dictionary('data/ods8.txt')
    
    with open('data/ods8.txt', 'r', encoding='utf-8') as f:
        all_words = {line.strip().upper() for line in f if line.strip()}
    word_pool = WordPool(gaddag, all_words)
    
    print(f'✅ {mots_charges} mots chargés!')
    
    # Liste de mots pour la démonstration
    mots_demo = [
        ('CABRERA', 'A', list('CABRER')),
        ('TABLEUR', 'A', list('TBLEUR')),
        ('SCRABBLE', 'A', list('SCRBBLE')),
    ]
    
    print(f'\n📝 Génération de {len(mots_demo)} situations d\'entraînement...\n')
    
    for mot_cible, lettre_appui, tirage in mots_demo:
        print(f'\n⏳ Génération pour {mot_cible}...')
        
        resultat = generer_situation_naturelle(
            mot_cible=mot_cible,
            lettre_appui=lettre_appui,
            tirage=tirage,
            gaddag=gaddag,
            word_pool=word_pool
        )
        
        afficher_situation(resultat, mot_cible)
        
        print('\n' + '='*80)
        print('(Appuyez sur Entrée pour la situation suivante...)')
        input()
    
    print('\n' + '='*80)
    print(' 🎉 DÉMONSTRATION TERMINÉE!')
    print('='*80)
    print('\nLe Natural Flow peut générer des situations pour n\'importe quel mot')
    print('du dictionnaire ODS8, avec une grille réaliste et naturelle.')
    print('\n💡 Utilisez ce système pour créer des exercices d\'entraînement')
    print('   personnalisés et améliorer votre jeu!')


if __name__ == '__main__':
    main()
