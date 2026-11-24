# Installer STRATEGIKON sur votre compte Google (15 minutes)

L'outil tourne entièrement dans votre compte Google : une feuille Google garde les parties, et un petit script la transforme en site web. Les joueurs ouvrent simplement un lien ; ils n'ont besoin d'aucun compte. Les parties restent enregistrées tant que la feuille existe : une partie commencée le soir se reprend le lendemain avec le même nom et le même mot de passe.

Vous avez besoin de deux fichiers, à ouvrir avec le Bloc-notes (clic droit > Ouvrir avec > Bloc-notes) pour copier leur texte :

- `Code.gs.txt`
- `Index.html.txt`

Utilisez de préférence un compte Gmail personnel. Un compte d'établissement peut interdire l'accès « Tout le monde » de l'étape 6.

## 1. Créer la feuille

1. Ouvrez https://sheets.new dans votre navigateur, connecté à votre compte Google.
2. Renommez la feuille (en haut à gauche) : `STRATEGIKON base`.

## 2. Ouvrir l'éditeur de script

1. Dans la feuille, menu **Extensions > Apps Script**. Un nouvel onglet s'ouvre.
2. Renommez le projet (en haut à gauche, « Projet sans titre ») : `STRATEGIKON`.

## 3. Coller le code du serveur

1. Dans la colonne de gauche, cliquez sur **Code.gs**.
2. Effacez tout le texte présent (Ctrl+A puis Suppr).
3. Ouvrez `Code.gs.txt` dans le Bloc-notes, Ctrl+A, Ctrl+C, puis revenez et collez (Ctrl+V).

## 4. Coller la page

1. Dans la colonne de gauche, cliquez sur le **+** à côté de « Fichiers », puis **HTML**.
2. Nommez le fichier exactement `Index` (sans « .html », l'éditeur l'ajoute seul), puis Entrée.
3. Effacez le texte proposé (Ctrl+A puis Suppr).
4. Ouvrez `Index.html.txt` dans le Bloc-notes, Ctrl+A, Ctrl+C, revenez et collez.
5. Enregistrez avec l'icône disquette (ou Ctrl+S).

## 5. Publier le site

1. En haut à droite : **Déployer > Nouveau déploiement**.
2. Cliquez sur la roue dentée à côté de « Sélectionner le type », puis **Application Web**.
3. Remplissez :
   - Description : `v1`
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
4. Cliquez sur **Déployer**.

## 6. Autoriser le script (une seule fois)

Google demande votre accord, car le script écrit dans votre feuille.

1. **Autoriser l'accès**, puis choisissez votre compte.
2. Un écran « Google n'a pas validé cette application » s'affiche : c'est normal pour un script personnel. Cliquez sur **Paramètres avancés**, puis **Accéder à STRATEGIKON (non sécurisé)**.
3. Cliquez sur **Autoriser**.

## 7. Récupérer le lien des joueurs

1. Copiez l'**URL de l'application Web** (elle se termine par `/exec`).
2. Ouvrez-la : la page STRATEGIKON s'affiche, avec la mention « Base partagée » en haut à droite. Google ajoute un bandeau gris au-dessus de la page ; il est normal.
3. Créez votre partie (par exemple « Bageia 5 », avec un mot de passe), puis envoyez le lien et le mot de passe aux joueurs.

Les onglets « Parties » et « Lignes » apparaissent dans la feuille dès la première partie. Ne les modifiez pas à la main pendant une partie.

## Mettre à jour l'outil plus tard

Quand une nouvelle version arrive :

1. Remplacez le contenu de **Code.gs** et de **Index** comme aux étapes 3 et 4, puis enregistrez.
2. **Déployer > Gérer les déploiements**, cliquez sur le crayon, choisissez Version : **Nouvelle version**, puis **Déployer**.

Le lien des joueurs ne change pas, et les parties en cours sont conservées.

## En cas de souci

- **« Mot de passe incorrect »** : le mot de passe est sensible aux majuscules.
- **La page reste en « Mode local »** : vous avez ouvert le fichier sur votre ordinateur au lieu du lien `/exec`.
- **Sauvegarde** : dans la feuille, Fichier > Créer une copie. Toutes les parties sont dans la copie.
