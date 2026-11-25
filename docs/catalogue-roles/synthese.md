# Catalogue des dépenses par rôle : synthèse

151 options relevées dans les 13 fiches de rôle en français (Drive, corpus Strategikon). Montants en M€ ; 1 case = 100 M€ ; 1 DORESE = 100 M€. Aucun montant n'a été ajouté : ce qui est « à définir » ou non chiffré reste vide.

## Fichiers

- `catalogue_options_roles.xlsx` : onglets Catalogue, Par rôle, Options communes, Règles transverses, Munitions, Éditions des fiches, Légende.
- `catalogue_options_roles.csv` : même catalogue, séparateur point-virgule.
- `catalogue_options_roles.json` et `.js` (`window.STRAT_CATALOGUE_ROLES`) : format pour l'outil, avec les codes de rôle de l'outil (DGRIS, MEAE, MEFR, SGA, DGA, EMAT, EMAAE, EMM, COCA), le plateau suggéré (`armee`), le coût bas (`cout`) et haut (`cout_max`), la périodicité, les DORESE et le drapeau `proposable_tel_quel` (coût annuel fixe et multiple de 100 M€).

## Ce que chaque rôle peut proposer

| Rôle | Options | Dont chiffrées | Nature |
|---|---|---|---|
| DGRIS | 17 | 7 | Présence avancée (Roumanie 200 M€/an, Pologne, Baltique, Djibouti 100 M€, Indo-Pacifique 200 M€), brigades franco-allemande et européenne (à définir), soutien aux programmes européens (à définir), actions diplomatiques. |
| MEAE | 20 | 7 | Mêmes tableaux que la DGRIS, plus trois leviers diplomatiques non chiffrés. |
| MEFR | 14 | 10 | Surcoûts flanc Est, SMV et service national, division de réserve, provision carburants ; leviers OPEX 50 %, fonds européens, dualité, réserve. |
| SGA | 20 | 18 | Jeunesse 400 M€/an (protégée), Plan Famille 800 M€, développement durable, énergie, infrastructures (ports, PANG, DIRISI, dépôts), SMV, quatre niveaux de réserve. |
| DGA | 43 | 43 | Fiches programme : SAMP/T NG, SEAD, IA, anti-drones, stocks de munitions, Eurodrone, Loyal Wingmen, MGCS, Titan, CIFS, VBCI NG, VBAE, Tigre, HIL, porte-avions et quais, R&D, chars sur étagère. |
| Terre, Air, Marine | 36 | 1 | Surtout des pistes non chiffrées, à évaluer par l'animateur ; seule la brigade anti-aérienne (200 à 300 M€/an) est chiffrée côté Air. |
| COCA / Red team | 1 | 0 | Programme spatial d'urgence issu d'un scénario. |
| CEMA, SC-Plans, MINARM | 0 | 0 | Pas de dépense propre : ils arbitrent et appliquent les règles (onglet Règles). |

## Points à trancher

1. **Coûts « à définir »** : seconde brigade franco-allemande, brigade européenne et soutien aux programmes SCAF, MALE, MGCS et CIFS (DGRIS et MEAE). Les actions diplomatiques et les pistes des armées sont aussi sans montant.
2. **Écarts entre fiches** (arbitrage d'artus : coûts variables à dessein, le responsable fixe le prix en jeu) : la fourchette retenue couvre les deux fiches, soit hub divisionnaire Pologne 150 à 300 M€/an et division de réserve 1 à 3 Md€/an. Reste un écart de calendrier : prolongation du Charles de Gaulle « 1 Md€ en 2039, étalé sur 2 ans » (DGA p5) ou « 1 Md€ unique » (DGA p13).
3. **Périodicité non dite** : hub logistique Pologne 250 M€, base Baltique 150 M€, Djibouti 100 M€, Indo-Pacifique 200 M€ (tableau DGRIS p8 « coût estimé »).
4. **Hors case** : 150 M€ et 250 M€ ne tombent pas sur la case de 100 M€ ; l'actuel `options.js` de l'outil les arrondit à 200 et 300 M€, ce que les fiches ne disent pas.
5. **Doublons** : Roumanie apparaît sous deux intitulés dans la même fiche ; « forces prépositionnées en Pologne » (100 M€/an) recoupe peut-être le hub divisionnaire.
6. **Éditions** : seule la fiche DGRIS est confirmée 2027-2033. Air et Marine ont un guide rédigé pour la « LPM 2035-2040 ». La fiche DGA mélange les deux : R&D « horizon 2035-2040 », grille des chars 2035-2040, Charles de Gaulle 2038-2039, second PANG 2039-2044. Ces lignes portent la mention « À vérifier ».
7. **COCA et Red team** sont la même fiche en deux versions (chef d'équipe MEAE ou DGRIS).
