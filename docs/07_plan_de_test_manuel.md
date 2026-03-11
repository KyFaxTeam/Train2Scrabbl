# Plan de Test Manuel - Système d'Apprentissage Intelligent (Scrabble Training)

Ce document détaille la procédure de validation manuelle pour le système d'apprentissage intelligent (FSRS), la gamification et le tableau de bord statistique.

**Version du test** : 1.0  
**Date** : 18/12/2025  
**Environnement** : Local (`npm run dev` + `uvicorn`)

---

## 🛠️ 0. Prérequis et Nettoyage

Avant de commencer, assurez-vous de partir d'un état propre pour garantir la validité des tests.

1.  **Lancer le Backend** : `uvicorn src.api.main:app --reload`
2.  **Lancer le Frontend** : `npm run dev`
3.  **Nettoyer les données locales** (Simulation "Nouvel Utilisateur") :
    *   Ouvrir les DevTools Chrome (F12).
    *   Aller dans l'onglet **Application** > **Storage** > **IndexedDB**.
    *   Supprimer la base de données `scrabble-learning-db`.
    *   Recharger la page (`F5`).

---

## 🧪 Scénario A : Premier Contact & Déclenchement Intelligent

**Objectif** : Vérifier que le système observe l'utilisateur et propose l'apprentissage au bon moment.

### Étape A1 : Navigation Dictionnaire
1.  Aller sur la page **Dictionnaire**.
2.  Rechercher le mot **"KA"**.
3.  Vérifier que l'indicateur de maîtrise (le petit point/cercle) est **Gris** (Non appris).
4.  Cliquer sur le bouton **"Apprendre ce mot"** (l'icône cerveau/livre).
5.  **Résultat attendu** :
    *   L'indicateur devient **Bleu** (En apprentissage).
    *   Une notification (Toast) confirme l'ajout.

### Étape A2 : La Boucle de Répétition (Trigger Popup)
*Le système est configuré pour proposer un test après 3 consultations d'un mot en apprentissage.*

1.  **Action 1** : Rechercher un autre mot (ex: "WU"), puis revenir sur **"KA"**.
    *   *Observation* : Pas de popup.
2.  **Action 2** : Aller sur l'Accueil, puis revenir sur **Dictionnaire** > **"KA"**.
    *   *Observation* : Pas de popup.
3.  **Action 3** : Rafraîchir la page ou chercher un autre mot, puis revenir sur **"KA"**.
    *   **RÉSULTAT ATTENDU** : La **SmartPopup** apparaît en bas à droite.
    *   *Texte* : "Vous semblez consulter souvent 'KA'. Voulez-vous le tester ?"

### Étape A3 : Acceptation
1.  Cliquer sur **"C'est parti !"** dans la popup.
2.  **Résultat attendu** : Redirection immédiate vers la page **Entraînement** (`/training`).

---

## 🎮 Scénario B : La Boucle d'Entraînement (Gamification)

**Objectif** : Valider le moteur de jeu, le chronomètre et le calcul d'XP.

### Étape B1 : Test Réussi (Vitesse < 5s)
*Supposons que le mot à trouver est "KA".*

1.  Observer le **Chronomètre** en haut à droite (démarre à 00:00).
2.  Placer les lettres **K** et **A** sur le plateau rapidement (en moins de 5 secondes).
3.  Cliquer sur **"Valider"**.
4.  **Résultat attendu (Modal XP)** :
    *   Titre : **"Excellent !"** ou "Parfait !".
    *   XP gagnés : **+15 XP** (10 base + 5 bonus vitesse).
    *   Prochaine révision : "4 jours" (ou similaire, algorithme FSRS).
5.  Cliquer sur **"Continuer"**.

### Étape B2 : Test Réussi (Lent > 10s)
*Le système propose un nouveau mot (ou le même si c'est le seul).*

1.  Attendre 10 secondes devant le plateau.
2.  Placer les lettres correctes.
3.  Cliquer sur **"Valider"**.
4.  **Résultat attendu** :
    *   Titre : **"Bien joué !"**.
    *   XP gagnés : **+10 XP** (Pas de bonus vitesse).
    *   Streak (Série) : Augmente de 1 (ex: x2).

### Étape B3 : Échec
1.  Placer des lettres incorrectes (ex: "Z", "U").
2.  Cliquer sur **"Valider"**.
3.  **Résultat attendu** :
    *   Animation de secousse (Shake) ou bordure rouge.
    *   Message : "Ce n'est pas la bonne solution".
    *   **Pas de modal XP** (l'utilisateur doit réessayer).
4.  Cliquer sur **"Solution"** ou **"J'abandonne"** (si disponible) OU corriger le mot.
    *   Si correction après erreur : XP réduits ou nuls (selon implémentation stricte).
    *   *Dans notre version actuelle* : La validation finale correcte déclenche le succès, mais le FSRS enregistrera une difficulté "Hard" si le temps est long.

---

## 📊 Scénario C : Vision Globale (Statistiques)

**Objectif** : Vérifier que les actions d'entraînement se reflètent dans le tableau de bord.

### Étape C1 : Accès au Dashboard
1.  Cliquer sur le lien **"Stats"** dans la navigation (ou via l'URL `/stats`).

### Étape C2 : Vérification des Données
1.  **Total XP** : Doit être égal à la somme des sessions B1 + B2 (ex: 25 XP).
2.  **Série Actuelle (Streak)** : Doit afficher **2** (si B1 et B2 réussis d'affilée).
3.  **Niveau** : Vérifier la barre de progression (ex: Niveau 1, 25/100 XP).
4.  **Mots à Revoir** :
    *   Le mot "KA" ne doit **PAS** apparaître dans la liste "À réviser maintenant" (car il vient d'être réussi et repoussé à +4 jours).
    *   Il doit apparaître dans les graphiques de distribution (colonne "Appris" ou "Review").

---

## 🔄 Scénario D : Persistance et Cycle de Vie (FSRS)

**Objectif** : Vérifier que le "Cerveau" n'oublie pas.

1.  Fermer l'onglet du navigateur.
2.  Rouvrir `http://localhost:5173`.
3.  Aller sur **Stats**.
    *   Vérifier que l'XP et le Streak sont toujours là (Persistance IndexedDB).
4.  Aller sur **Dictionnaire** > Rechercher "KA".
    *   L'indicateur doit être **Vert** (Maîtrisé / Review future) ou Bleu, mais plus Gris.
    *   Le bouton "Apprendre" doit être désactivé ou indiquer "Déjà en cours".

---

## 🐛 Scénario E : Gestion des Erreurs (Edge Cases)

1.  **Entraînement sans mots** :
    *   Nettoyer la DB.
    *   Aller directement sur `/training` sans avoir ajouté de mots.
    *   **Résultat attendu** : Message "Aucun mot à réviser pour le moment" ou redirection vers le Dictionnaire.
2.  **Déconnexion API** :
    *   Couper le serveur Python (`Ctrl+C` dans le terminal).
    *   Tenter de valider un mot.
    *   **Résultat attendu** : Message d'erreur "Erreur de connexion" ou "Validation impossible".

---

## ✅ Checklist de Validation Finale

| ID | Test | Statut | Notes |
|----|------|--------|-------|
| A1 | Ajout mot "Apprendre" | [ ] | |
| A2 | Trigger Popup (3 vues) | [ ] | |
| A3 | Redirection Popup | [ ] | |
| B1 | Gain XP (Vitesse) | [ ] | |
| B2 | Gain XP (Normal) | [ ] | |
| B3 | Feedback Erreur | [ ] | |
| C1 | Dashboard XP correct | [ ] | |
| C2 | Dashboard Streak correct | [ ] | |
| D1 | Persistance après reload | [ ] | |
