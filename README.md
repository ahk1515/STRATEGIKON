# STRATEGIKON : outil numérique de la table budgétaire LPM 2027-2032

Outil web du serious game STRATEGIKON (École de guerre). Chaque pôle compose sa demande année par année ; l'outil calcule les cases occupées et les DORESE, et confronte la somme des demandes au plafond de chaque année.

**Mode d'emploi complet : [docs/GUIDE-UTILISATION.md](docs/GUIDE-UTILISATION.md)** (joueurs, animateur, et IA assistante).

Mise en ligne : [INSTALLATION-SUPABASE.md](INSTALLATION-SUPABASE.md) (Supabase et GitHub Pages, recommandé) ou [INSTALLATION.md](INSTALLATION.md) (Google Sheets, en secours).

## Règles modélisées

- 1 case = 100 M€ ; 1 pion DORESE = 1 case ; la table compte 600 cases (60 Md€) par année.
- Plafonds par défaut (en cases, modifiables dans l'onglet Paramètres) : 2027 = 590, 2028 = 580, 2029 = 570, 2030 à 2032 = 590.
- Situation de départ : la photo de la table 2027 (39,9 Md€), répétée chaque année jusqu'en 2032. Toutes les capacités y sont à 100 % sauf l'A400M, à qui il manque 1 DORESE activité. Les pions orange (SMV, munitions) sont posés d'office dans une nouvelle partie ; l'animateur peut les retirer année par année dans les Réglages.
- Une capacité passe à 100 % en ajoutant ses DORESE (AO, MCO, RH). Sur la table, les DORESE sont posées juste après leur capacité (règle « Au contact »).
- Chaque ligne porte une armée imputée : le surcoût est compté à l'armée qui porte le projet.

## Types de ligne

| Type | Coût par exemplaire et par an |
|---|---|
| Renforcer (passer à 100 %) | DORESE manquantes × 100 M€ (un exemplaire au plus, le pion est unique) |
| Créer une capacité | coût à 50 % ou coût à 100 % du pion |
| Dissoudre | moins le coût du pion tel qu'il est posé au départ |
| Ligne libre | montant saisi (modèles tirés des fiches DGRIS et DGA) |

## Organisation du code

| Fichier | Rôle |
|---|---|
| `data/base_pions_strategikon.csv` | base des pions (fait foi) |
| `scripts/csv_vers_js.py` | convertit le CSV en `data/pions.js` |
| `data/catalogue_roles.js` | catalogue des options par rôle (151 options, fil « Lister les dépenses de chaque rôle ») |
| `js/moteur.js` | calculs, sans dépendance |
| `js/stockage.js` | stockage : Supabase, feuille Google (Apps Script) ou navigateur seul |
| `supabase/schema.sql` | tables et fonctions de la base Supabase |
| `js/app.js`, `js/figuratifs.js`, `css/style.css`, `css/table.css`, `index.html` | interface « table d'abord » : on pose, modifie et arbitre les pions directement sur la table ; les lignes sont écrites en arrière-plan |
| `apps-script/Code.gs` | serveur Google Apps Script |
| `scripts/assembler.py` | produit `apps-script/Index.html` (page en un seul fichier) |

Après une modification : `python3 scripts/csv_vers_js.py` (si le CSV a changé), `python3 scripts/assembler.py`, puis `node --test tests/*.test.js`.

## Table commune

Tout le monde voit toutes les demandes, avec leur porteur. Trois gestes : proposer (chaque pôle), commenter et qualifier (avis, avis industriel DGA, soutenabilité MEFR et SGA, priorités proposées, montages de financement, contrainte politique du MINARM), arbitrer (CEMA). Les points chauds s'allument ; le filtre « Où faut-il arbitrer ? » ne garde qu'eux. Les pions sont regroupés en paquets par entité.

## Arbitrage

Le CEMA et l'animateur décident ligne par ligne : retenu, différé d'une à trois années, ou renoncé. Les décisions et les validations des pions sur mesure sont rangées dans les paramètres de la partie.

## Documentation et données de conception

| Dossier | Contenu |
|---|---|
| `docs/GUIDE-UTILISATION.md` | Guide d'utilisation exhaustif, à donner à une IA assistante des joueurs |
| `docs/conception/` | Acteurs et interfaces (document de conception validé) |
| `docs/catalogue-roles/` | Catalogue des options et règles des fiches de rôle (CSV, JSON, XLSX), synthèses, scripts sources |
| `docs/donnees/` | Base des pions (XLSX, JSON 2027) |
| `supabase/reinitialiser.sql` | Sauvegarde puis effacement de toutes les parties |
