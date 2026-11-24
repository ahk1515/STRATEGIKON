# Mettre STRATEGIKON en ligne avec Supabase et GitHub Pages

Deux comptes gratuits suffisent : Supabase garde les parties (elles restent enregistrées d'une séance à l'autre), GitHub Pages héberge la page. Les joueurs ouvrent simplement un lien, sans compte.

## 1. Créer la base Supabase (10 minutes)

1. Allez sur https://supabase.com, cliquez sur **Start your project**, puis connectez-vous avec **Continue with GitHub** (ou un e-mail).
2. Cliquez sur **New project** :
   - Organization : celle proposée par défaut ;
   - Project name : `strategikon` ;
   - Database Password : cliquez sur **Generate a password** (vous n'en aurez pas besoin ensuite) ;
   - Region : **Europe West (Paris)** si elle est proposée, sinon une région Europe ;
   - cliquez sur **Create new project**, puis patientez 1 à 2 minutes.
3. Dans la colonne de gauche, ouvrez **SQL Editor**, puis **New query** (ou le bouton **+**).
4. Ouvrez le fichier `schema-supabase.sql.txt` dans le Bloc-notes, copiez tout (Ctrl+A, Ctrl+C), collez-le dans l'éditeur, puis cliquez sur **Run**. Le message « Success. No rows returned » s'affiche. Si Supabase demande de confirmer une requête « destructive », confirmez : le script ferme seulement les tables à l'accès direct.
5. Récupérez les deux informations à m'envoyer :
   - **Project Settings** (roue dentée en bas à gauche) > **Data API** : copiez la **Project URL** (`https://xxxx.supabase.co`) ;
   - **Project Settings** > **API Keys** : copiez la clé **publishable** (elle commence par `sb_publishable_`) ou, à défaut, la clé **anon public** (longue clé qui commence par `eyJ`).

Ne m'envoyez jamais la clé **secret** ni la clé **service_role** : elles donnent tous les droits sur la base.

## 2. Créer le dépôt GitHub (2 minutes)

1. Allez sur https://github.com/new (connecté au compte `ahk1515`).
2. Repository name : `strategikon` ; visibilité : **Public** (GitHub Pages gratuit l'exige) ; ne cochez rien d'autre.
3. Cliquez sur **Create repository**, puis dites-moi que c'est fait.

Je dépose le code dans le dépôt avec vos deux informations Supabase.

## 3. Activer la page (1 minute, après mon dépôt)

1. Dans le dépôt, **Settings** > **Pages**.
2. Source : **Deploy from a branch** ; Branch : **main**, dossier **/ (root)** ; cliquez sur **Save**.
3. Après une à deux minutes, l'outil est en ligne à l'adresse `https://ahk1515.github.io/strategikon/`. La mention « Base partagée » doit apparaître en haut à droite.

## Bon à savoir

- **Persistance** : les parties restent dans Supabase sans limite de durée. Une partie commencée le soir se reprend le lendemain avec son nom et son mot de passe.
- **Mise en veille** : un projet Supabase gratuit est mis en pause après 7 jours sans aucune activité. Les données sont conservées ; il suffit de cliquer sur **Restore project** dans Supabase.
- **Voir les données** : Supabase > **Table Editor** > tables `parties` et `lignes`.
