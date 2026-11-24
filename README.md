# STRATEGIKON : outil numérique de la table budgétaire LPM 2027-2032

Outil web du serious game STRATEGIKON (École de guerre). Chaque pôle compose sa demande année par année ; l'outil calcule les cases occupées et les DORESE, et confronte la somme des demandes au plafond de chaque année.

Mise en ligne : [INSTALLATION-SUPABASE.md](INSTALLATION-SUPABASE.md) (Supabase et GitHub Pages, recommandé) ou [INSTALLATION.md](INSTALLATION.md) (Google Sheets, en secours).

## Règles modélisées

- 1 case = 100 M€ ; 1 pion DORESE = 1 case ; la table compte 600 cases (60 Md€) par année.
- Plafonds par défaut (en cases, modifiables dans l'onglet Paramètres) : 2027 = 590, 2028 = 580, 2029 = 570, 2030 à 2032 = 590.
- Socle posé d'office chaque année : pions gris, violets et capacités à 50 %. Les pions orange (SMV, munitions) sont posés par l'animateur, année par année.
- Une capacité passe à 100 % en ajoutant ses DORESE (AO, MCO, RH). Sur la table, les DORESE sont posées juste après leur capacité (règle « Au contact »).
- Chaque ligne porte une armée imputée : le surcoût est compté à l'armée qui porte le projet.

## Types de ligne

| Type | Coût par exemplaire et par an |
|---|---|
| Passer à 100 % | nombre de DORESE × 100 M€ (un exemplaire au plus, le pion est unique) |
| Ajouter un pion | coût à 50 % ou coût à 100 % du pion |
| Retirer un pion du socle | moins le coût à 50 % |
| Ligne libre | montant saisi (modèles tirés des fiches DGRIS et DGA) |

## Organisation du code

| Fichier | Rôle |
|---|---|
| `data/base_pions_strategikon.csv` | base des pions (fait foi) |
| `scripts/csv_vers_js.py` | convertit le CSV en `data/pions.js` |
| `data/options.js` | modèles de lignes libres (DGRIS, DGA), à valider |
| `js/moteur.js` | calculs, sans dépendance |
| `js/stockage.js` | stockage : Supabase, feuille Google (Apps Script) ou navigateur seul |
| `supabase/schema.sql` | tables et fonctions de la base Supabase |
| `js/app.js`, `css/style.css`, `index.html` | interface |
| `apps-script/Code.gs` | serveur Google Apps Script |
| `scripts/assembler.py` | produit `apps-script/Index.html` (page en un seul fichier) |

Après une modification : `python3 scripts/csv_vers_js.py` (si le CSV a changé), `python3 scripts/assembler.py`, puis `node --test tests/*.test.js`.

## Prochaines étapes

1. Arbitrage CEMA : retenu, différé, renoncé, ligne par ligne.
2. Grille par armée avec la forme réelle des pions, optimisée pour remplir la table.
3. Visualisation finale : trajectoire sur 6 ans, demandes au-delà du plafond, renoncements.
