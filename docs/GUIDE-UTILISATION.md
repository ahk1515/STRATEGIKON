# STRATEGIKON : guide d'utilisation complet

Version du 25 novembre 2026, à jour de la « table commune » publiée ce jour.

Ce guide décrit tout l'outil numérique du serious game STRATEGIKON (LPM 2027-2032, École de guerre) : chaque écran, chaque bouton, chaque rôle, chaque règle de calcul. Il est écrit pour deux lecteurs à la fois :

- **un joueur ou un animateur** qui cherche comment faire quelque chose ;
- **une IA assistante** à qui l'on donne ce document pour qu'elle réponde aux questions des joueurs pendant la partie.

---

## 0. Consignes pour l'IA assistante

Si vous êtes une IA à qui l'on a donné ce guide :

1. **Répondez en français, court et concret.** Indiquez le chemin exact dans l'interface, par exemple : « Cliquez sur le pion, puis dans le panneau de droite, bloc *Priorité*, choisissez P2. »
2. **Demandez le rôle du joueur s'il ne l'a pas dit.** Ce qu'on peut faire dépend du rôle (section 6). Un EMAT ne peut pas arbitrer ; un DGRIS ne peut pas cocher une contrainte politique.
3. **Distinguez l'outil et le jeu.** L'outil calcule et trace ; il ne bloque presque rien. Les règles des fiches de rôle sortent en *alertes*, jamais en interdictions. Quand une question porte sur la stratégie (« faut-il garder le SCAF ? »), vous pouvez éclairer les conséquences chiffrées, mais la décision appartient aux joueurs et, au bout du compte, au CEMA.
4. **Ne devinez pas un chiffre.** Les montants viennent de la table. Si le joueur vous les donne, calculez ; sinon dites où les lire (relevé en haut de la table, onglet *Bilan*, onglet *Flottaison*).
5. **Ne révélez pas la trajectoire de référence de l'animateur.** Elle est importée par l'animateur seul, dans son navigateur, pour la comparer en fin de partie.
6. **Pour un problème technique**, suivez la FAQ (section 21). Ne proposez jamais de toucher à la base de données ni de communiquer un mot de passe ou une clé.

---

## 1. L'outil en bref

- **Adresse** : le site GitHub Pages du dépôt `ahk1515/STRATEGIKON` (la page `index.html`). Il s'ouvre dans n'importe quel navigateur récent, sur ordinateur de préférence.
- **Ce qu'il fait** : chaque acteur pose ses demandes sur une table budgétaire commune, année par année. L'outil compte les cases occupées, les DORESE, la marge sous le plafond, les avis des autres acteurs, les alertes des fiches de rôle, la part de souveraineté, et permet au CEMA d'arbitrer en voyant tout.
- **Deux étapes de jeu** :
  1. **Modèle 2032** : chaque pôle compose ce qu'il veut avoir en 2032, le CEMA arbitre.
  2. **Trajectoire 2027-2032** : on étale ce qui a été retenu, année par année, sous les plafonds.
- **Base partagée** : toutes les parties sont stockées dans une base Supabase. Chaque écran se met à jour tout seul toutes les 6 secondes environ ; ce que pose un pôle apparaît chez les autres sans recharger.

## 2. Vocabulaire

| Terme | Sens |
|---|---|
| **Case** | Unité de la table : 1 case = 100 M€ par an. |
| **Table** | 600 cases par année (60 Md€). |
| **Plafond** | Montant maximal d'une année, en cases. Par défaut : 2027 = 590, 2028 = 580, 2029 = 570, 2030 à 2032 = 590. Modifiable dans *Réglages*. |
| **Socle** | La photo de la table 2027 (39,9 Md€), répétée chaque année jusqu'en 2032. Il est considéré comme déjà arbitré. |
| **Pion** | Une capacité, un investissement, une dépense fixe ou un pion de scénario, posé sur la table. Chaque pion a une forme (largeur × hauteur en cases). |
| **Capacité** | Pion coloré selon l'armée (Terre, Marine, Air et Espace, Interarmées). Elle existe à 50 % (face rouge, dégradée) ou à 100 % (avec toutes ses DORESE). |
| **DORESE** | Jetons qui portent une capacité à 100 % : **AO** (activité opérationnelle), **MCO** (maintien en condition opérationnelle), **RH** (ressources humaines). 1 DORESE = 1 case = 100 M€/an. Elles sont posées « au contact » de leur capacité. |
| **Investissement** | Pion violet (R&D, programmes). |
| **Dépense fixe** | Pion gris (dissuasion, infrastructures, SGA, surcoût OPEX). Elle ne se négocie pas à la table. |
| **Pion de scénario** | Pion orange (SMV 2,5 Md€, munitions 1,5 Md€), posé d'office ; l'animateur le retire ou le remet année par année. |
| **Ligne** ou **demande** | Ce qu'un rôle pose : un ajout, un renforcement, une dissolution, un repassage à 50 %, une option de sa fiche ou un pion sur mesure. Chaque ligne a un porteur (le rôle qui l'a posée). |
| **Option de fiche** | Une dépense préchiffrée tirée de la fiche du rôle (151 options au total). |
| **Pion sur mesure** | Une dépense hors catalogue, au prix saisi ; elle reste « à valider » par l'animateur. |
| **Priorité** | P1 (la plus haute) à P4. Une demande sans priorité compte en P4. |
| **Contrainte politique** | Drapeau posé par le MINARM (ou l'animateur) : la ligne n'est pas arbitrable et passe avant P1. |
| **Ligne de flottaison** | La limite du plafond quand on empile socle, contraintes, puis P1 à P4. Ce qui passe dessous est à abandonner ou différer. |
| **Enveloppe interne** | Budget annuel propre à un pôle (par défaut : R&D de la DGA, 900 M€/an). Les lignes rangées dedans ne pèsent sur la table que pour l'excédent. |
| **Montage de financement** | Mutualisation avec des alliés, subvention UE ou prêt UE. Il ne compte qu'une fois validé par l'animateur. |
| **Point chaud** | Pion qui demande un arbitrage (avis divergents, alerte, sous la flottaison…). |
| **Passage en force** | Ligne retenue par le CEMA malgré un avis défavorable, un refus industriel ou un avis insoutenable. Elle est tracée. |

---

## 3. Entrer dans une partie

### 3.1 Rejoindre une partie existante
1. Ouvrez le site. L'écran d'accueil affiche **STRATEGIKON**.
2. Choisissez la partie dans la liste **Partie**.
3. Tapez son **mot de passe** (donné par l'animateur), puis **Entrer**.
4. Choisissez votre **rôle** dans la liste (section 6).

### 3.2 Ouvrir une nouvelle partie (animateur)
1. Sur l'accueil, cliquez **Ouvrir une nouvelle partie**.
2. Donnez un nom (80 caractères au plus, unique, sans tenir compte des majuscules) et un mot de passe d'au moins 4 caractères, deux fois.
3. **Ouvrir la partie**. La partie démarre avec les paramètres par défaut : plafonds ci-dessus, SMV et munitions posés chaque année, SMV sous contrainte politique acquise (MINARM), enveloppe R&D de la DGA à 900 M€/an.
4. Communiquez le nom et le mot de passe aux joueurs. Le mot de passe protège toute la partie : quiconque le connaît peut entrer sous n'importe quel rôle.

### 3.3 Changer de rôle, quitter
- **Changer de rôle** : cliquez sur l'insigne du rôle en haut à droite (code et nom). La liste des rôles revient ; choisissez-en un autre. Rien n'est perdu.
- **Quitter** : bouton *Quitter* dans le bandeau. Retour à l'accueil.
- **Recharger la page** (F5) ramène dans la même partie, au même rôle et à la même année, tant que l'onglet du navigateur reste ouvert.

### 3.4 Mode partagé ou local
Sous la carte d'accueil, une note indique le mode :
- « **Base partagée** » : normal, tout le monde voit la même partie.
- « **Mode local** » : la configuration est vide ; les parties restent dans ce navigateur seul. C'est le cas de la maquette de démonstration, pas du site de jeu.

---

## 4. L'écran de jeu

### 4.1 Le bandeau (en haut)
- Le **nom de la partie** et l'**insigne du rôle** (cliquable pour changer de rôle), le bouton **Quitter**.
- Les **étapes** : *1 Modèle 2032* et *2 Trajectoire 2027-2032*. Chaque joueur peut passer de l'une à l'autre pour regarder ; l'étape affichée à l'entrée est fixée par l'animateur dans *Réglages*.
- Les **jauges des années** : une par année (seulement 2032 à l'étape 1). Chaque jauge montre le remplissage, le trait du plafond, et « marge X » ou « dépasse de X ». Cliquez sur une année pour l'afficher sur la table.

### 4.2 La table (au centre)
- **Le relevé** au-dessus de la table : cases occupées / plafond, montant total, plafond, marge ou dépassement de l'année affichée.
- **Les filtres de pions** :
  - *Toute la table* (par défaut) : toutes les demandes de tout le monde, regroupées en paquets par entité.
  - *Ma demande* : vos seuls pions, regroupés.
  - *Où faut-il arbitrer ? (n)* : seuls les points chauds ; le nombre entre parenthèses les compte.
- **Les vues** :
  - *Demandes* : tout ce qui a été posé, arbitré ou non.
  - *Après arbitrage* : seulement ce qui tient après les décisions du CEMA (les lignes renoncées disparaissent, les différées sont décalées).
- **La consigne** sous les filtres rappelle quoi faire selon votre rôle, le nombre d'alertes et le nombre de demandes sous la ligne de flottaison.
- **Le plateau** : en *Toute la table*, les pions sont rangés en **paquets par entité**, chacun dans un cadre titré avec son montant :

  | Paquet | Rôles qui l'alimentent |
  |---|---|
  | Terre (en haut à gauche) | EMAT |
  | Marine (en haut à droite) | EMM |
  | Air et Espace | EMAAE |
  | Interarmées | COCA, SC-Plans, CEMA, Animateur |
  | DGA | DGA |
  | International | DGRIS, MEAE |
  | Soutien et cabinet | SGA, MEFR, MINARM |
  | Fixes | dépenses fixes du socle |

  Le paquet de votre entité est mis en valeur.
- **Cliquer** :
  - sur une **case vide** ouvre l'onglet *Poser* pour l'année affichée ;
  - sur un **pion** ouvre sa fiche dans l'onglet *Sélection* ;
  - sur un jeton d'**excédent d'enveloppe** ouvre l'onglet *Enveloppes*.
  Survoler un pion affiche une infobulle : nom, niveau, porteur, statut, marques.
- **Sous la table** : « Retiré de la table en 20XX » liste les dissolutions et repassages à 50 % de l'année (cliquables).
- **La légende** explique toutes les marques.

### 4.3 Les marques sur les pions

| Marque | Sens |
|---|---|
| Étiquette en coin (EMAT, DGA…) | Le porteur de la demande. |
| Bordure de « ma demande » | Pion posé par votre rôle. |
| Face rouge | Capacité à 50 % (dégradée). |
| Coins AO / MCO / RH chiffrés | DORESE requises par la capacité. |
| Pion pâle « en attente » | Pas encore arbitré par le CEMA. |
| Pion barré « renoncé » | Le CEMA y a renoncé. |
| Drapeau | Contrainte politique acquise : non arbitrable. |
| Hachures | Part payée par l'allié : elle ne compte pas pour la France. |
| Pastille globe ou « UE » | Montage de financement (pâle tant qu'il n'est pas validé ; teinte différente si partenaires hors UE). |
| Barre rouge | Demande sous la ligne de flottaison. |
| Pastille « ! » | Alerte d'une règle des fiches (non bloquante). |
| Halo « point chaud » | À arbitrer. |
| Marque défection | L'allié a fait défection : à réarbitrer. |
| Pion pointillé « sur mesure » | Hors catalogue, à valider par l'animateur. |

### 4.4 Le panneau de droite (onglets)

| Onglet | Qui le voit | Contenu |
|---|---|---|
| **Poser** | tous | Catalogue pour poser un pion (section 7.1). |
| **Sélection** | tous | Fiche du pion ou de la demande cliquée. |
| **Ma demande** | tous | Liste de vos lignes, total, alertes, règles de votre fiche. |
| **Flottaison** | tous | Empilement de l'année et ligne du plafond (section 10). |
| **Enveloppes** | rôles qui ont une enveloppe ; CEMA, SC-Plans, Animateur | État des enveloppes internes (section 11). |
| **Trajectoire** | tous, à l'étape 2 seulement | Étalement des lignes du modèle 2032 (section 15). |
| **Arbitrage** | CEMA, SC-Plans, Animateur | Lignes par statut, marges après arbitrage (section 9). |
| **Bilan** | tous | Tableau de bord 2027-2032 (section 16). |
| **Réglages** | Animateur, SC-Plans, CEMA | Plafonds, pions de scénario, étape, enveloppes (section 17). |
| **Échanges** | Animateur seul | Exports, référence, comparaison (section 18). |

---

## 5. Les deux étapes

### Étape 1 · Modèle 2032
- La table n'affiche que **2032**. Chaque pôle compose la table qu'il veut en 2032.
- Les lignes posées à cette étape sont marquées « modèle 2032 » : elles ne pèsent qu'en 2032 tant qu'elles ne sont pas placées sur la trajectoire.
- Les acteurs commentent (avis, priorités, montages, contraintes), le CEMA arbitre.

### Étape 2 · Trajectoire 2027-2032
- Les six années sont affichées. On place chaque ligne retenue du modèle 2032 à son **année d'entrée** (manuellement ou par *Étaler automatiquement*).
- Une ligne entrée en 2029 pèse de 2029 à 2032 ; un programme en **tranches** paie N1 l'année d'entrée, N2 l'année suivante, etc.
- On peut aussi poser à cette étape des demandes directement datées (portée « 20XX → 2032 » ou « 20XX seulement »).

L'animateur fixe l'étape d'entrée dans *Réglages* > *Étape de la partie*. Chaque joueur peut basculer d'une étape à l'autre avec les boutons du bandeau, sans rien changer pour les autres.

---

## 6. Les rôles et ce qu'ils peuvent faire

### 6.1 Liste des rôles

| Code | Nom | Armée imputée par défaut | Options dans sa fiche |
|---|---|---|---|
| EMAT | État-major de l'armée de Terre | Terre | 9 |
| EMM | État-major de la Marine | Marine | 16 |
| EMAAE | État-major de l'armée de l'Air et de l'Espace | Air et Espace | 11 |
| COCA | EMA / COCA | Interarmées | 1 |
| SC-Plans | Sous-chef d'état-major Plans | Interarmées | 0 |
| CEMA | Cabinet du CEMA | Interarmées | 0 |
| DGRIS | Direction générale des relations internationales et de la stratégie | Interarmées | 17 |
| DGA | Direction générale de l'armement | Interarmées | 43 |
| SGA | Secrétariat général pour l'administration | Interarmées | 20 |
| MINARM | Cabinet du ministre des Armées | Interarmées | 0 |
| MEFR | Ministère de l'Économie et des Finances | Interarmées | 14 |
| MEAE | Ministère de l'Europe et des Affaires étrangères | Interarmées | 20 |
| Animateur | Animateur de la partie | Interarmées | toutes |

### 6.2 Les trois gestes

Tout le monde voit **toute la table**, avec le porteur de chaque demande. Il y a trois gestes :

1. **Proposer** : poser une demande sur la table (tous les rôles).
2. **Commenter, qualifier** : donner un avis, proposer une priorité, proposer un montage, demander ou poser une contrainte politique (selon le rôle).
3. **Arbitrer** : retenir, différer, renoncer (CEMA, et l'animateur pour la conduite du jeu).

### 6.3 Qui peut quoi

| Action | Qui |
|---|---|
| Poser une capacité du catalogue | Les armées pour leurs propres pions ; les rôles interarmées pour tous les pions. |
| Poser une option de fiche | Le rôle de la fiche ; CEMA, SC-Plans et Animateur voient toutes les fiches. |
| Poser un pion sur mesure | Tous. |
| Modifier ou supprimer une demande | Son porteur seul. |
| Fixer la priorité du pôle | Le porteur. |
| Fixer la priorité du CEMA, accepter ou écarter une priorité proposée | CEMA, Animateur. |
| Proposer une priorité au CEMA | Tout autre rôle, sur la demande d'un autre. |
| Donner un avis (favorable, réservé, défavorable) | Tous, sauf le CEMA qui lit les avis. |
| Avis industriel | DGA. |
| Avis de soutenabilité | MEFR, SGA. |
| Cocher une contrainte politique | MINARM, Animateur. |
| Demander une contrainte politique | Le porteur de la demande. |
| Proposer un montage de financement | Le porteur, DGRIS, DGA, MEFR, Animateur. |
| Valider un montage, déclencher une défection | Animateur. |
| Valider un pion sur mesure | CEMA, Animateur (case dans la décision). |
| Arbitrer (retenu, différé, renoncé) | CEMA, Animateur. |
| Placer les lignes sur la trajectoire, étaler automatiquement | CEMA, SC-Plans, Animateur. |
| Régler plafonds, pions de scénario, étape, enveloppes | Animateur, SC-Plans, CEMA. |
| Exporter, importer une référence, comparer | Animateur. |

### 6.4 Ce que chaque rôle fait surtout

- **EMAT, EMM, EMAAE** : composent la demande de leur armée (renforcer, ajouter, dissoudre, options de fiche), fixent leurs priorités, justifient, donnent leur avis sur les demandes des autres.
- **COCA** : demandes interarmées et opérationnelles ; avis.
- **SC-Plans** : vue complète, cohérence d'ensemble ; propose des priorités ; place les lignes sur la trajectoire ; accès aux réglages. Il ne tranche pas.
- **CEMA** : lit tous les avis empilés, fixe les priorités, arbitre chaque ligne, place la trajectoire. Il décide de tout en sachant tout.
- **DGRIS** : options internationales ; propose des montages mutualisés (partenaires UE ou hors UE) ; veille aux règles DGRIS-01 à 03.
- **MEAE** : options diplomatiques ; avis.
- **DGA** : options industrielles et R&D (dont l'enveloppe R&D de 900 M€) ; **avis industriel** (favorable, report de cadence, mutualisation, alternative, refus industriel) ; propose des montages.
- **SGA** : dépenses de soutien ; **avis de soutenabilité** (masse salariale, RH).
- **MEFR** : dépenses propres et contrôle ; **avis de soutenabilité** ; propose des montages (subvention ou prêt UE).
- **MINARM** : pose les **contraintes politiques** ; voit les passages en force ; avis.
- **Animateur** : ouvre la partie, règle, valide les pions sur mesure et les montages, déclenche les défections, peut arbitrer, exporte et compare.

> Note de conception : le document `docs/conception/acteurs-et-interfaces.md` décrit le rôle de chaque acteur. Une question reste ouverte : la version COCA (menée par le MEAE) ou Red team (menée par la DGRIS).

---

## 7. Proposer : poser et régler une demande

### 7.1 Onglet *Poser*
1. Cliquez sur une case vide de la table, ou sur l'onglet **Poser**.
2. À l'étape 2, choisissez la **portée** : « 20XX → 2032 » (de l'année affichée jusqu'à la fin) ou « 20XX seulement ». À l'étape 1, la portée est toujours le modèle 2032.
3. Choisissez une famille :
   - **Capacités** : les pions du catalogue de votre périmètre. Pour une capacité qui a des DORESE, deux boutons : **50 %** (version dégradée, sans DORESE) ou **100 %** (avec ses DORESE). Sinon un bouton **Poser**. Le coût annuel est affiché.
   - **Options de ma fiche** : les options préchiffrées de votre fiche, avec leur fourchette de coût. Champ **Chercher…** pour filtrer.
   - **Sur mesure** : intitulé, prix en M€ par an (arrondi à la case de 100 M€, au moins une case), armée qui le porte. Le pion reste « à valider par l'animateur ».
4. Le pion apparaît sur la table, en surbrillance, et sa fiche s'ouvre dans *Sélection*. Reposer le même pion ajoute un exemplaire.

### 7.2 Agir sur un pion du socle
Cliquez sur un pion du socle (capacité de votre périmètre). La fiche montre : coût, place, DORESE posées, état dans l'année. Actions possibles, sur la portée choisie :
- **Renforcer à 100 %** : ajoute les DORESE manquantes au contact (coût affiché).
- **Annuler le renforcement**.
- **Repasser à 50 %** : rend les DORESE de la capacité, qui devient dégradée (économie affichée).
- **Revenir à 100 %** : annule le repassage.
- **Dissoudre** : retire le pion de la table (économie = son coût sur la table).
- **Ajouter un exemplaire** : un exemplaire de plus, à 100 % s'il a des DORESE.
Un pion d'un autre pôle affiche « Ce pion relève d'un autre pôle ». Les dépenses fixes ne se négocient pas ; les pions de scénario se règlent dans *Réglages*.

### 7.3 Régler sa demande (onglet *Sélection*, porteur seulement)
- **Niveau** (pour un exemplaire de capacité) : à 50 % ou à 100 %.
- **Prix fixé** (option ou sur mesure), en M€ par an, arrondi à la case. Message si le prix est vide (la demande ne compte pas) ou hors de la fourchette de la fiche.
- **Programme en tranches** (facultatif) : « 300, 500, 200 » = N1, N2, N3 en M€. Sur la trajectoire, N1 est payée l'année d'entrée, N2 l'année suivante, etc.
- **Calendrier** : une case par année (ou « Au modèle 2032 »). Pour un pion unique (renforcement, dissolution, option), un clic pose ou retire. Pour des exemplaires, **clic = +1**, **Maj + clic = −1**.
- **Surcoût imputé à** : l'armée qui porte le projet (compte dans « Demandes par armée »).
- **Justification** : votre argument pour l'arbitrage. Les autres le lisent en citation.
- **Enlever de la table [portée]** : retire un exemplaire sur la portée.
- **Supprimer toute la demande** : deux clics (le second confirme).
- Les blocs **Priorité**, **Contrainte politique**, **Financement**, **Enveloppe interne** et **Trajectoire** sont décrits plus bas.

Tout s'enregistre automatiquement (un instant après chaque geste). En cas d'échec, un message « Non enregistré : … » apparaît en bas de l'écran.

### 7.4 Onglet *Ma demande*
- Total de votre demande sur 2027-2032 et nombre de DORESE.
- **Alertes sur ma demande** (ouvertes) : chaque alerte avec sa règle, sa source, et un lien vers la ligne.
- **Règles de jeu de ma fiche** (repliées) : la liste des règles tirées de votre fiche de rôle (l'animateur voit les 78).
- La liste de vos lignes, triée comme l'empilement de la flottaison : priorité (ou drapeau), libellé, nature, années, total, décision du CEMA, badge « alerte ».

---

## 8. Commenter et qualifier

Cliquez sur n'importe quel pion posé : la fiche s'ouvre avec le bloc **Avis des acteurs** en tête.

### 8.1 Avis
- **Mon avis** (tous les rôles sauf le CEMA) : *Favorable*, *Réservé* ou *Défavorable*, avec un motif d'une phrase (facultatif). Cliquer à nouveau sur le même bouton retire l'avis.
- **Avis industriel** (DGA) : *Favorable*, *Report de cadence*, *Mutualisation*, *Alternative*, *Refus industriel*.
- **Soutenabilité** (MEFR et SGA) : *Soutenable*, *Fragile*, *Insoutenable*.
- Tous les avis donnés s'affichent, rôle par rôle, avec leur motif. Le CEMA les voit empilés au-dessus de sa décision. Pour enregistrer un motif modifié après coup, cliquez en dehors du champ.

### 8.2 Priorité
Le bloc **Priorité** montre trois valeurs : *Pôle* (fixée par le porteur), *CEMA* (fixée par le CEMA), *Retenue* (celle du CEMA si elle existe, sinon celle du pôle, sinon P4 « non fixée »).
- Le porteur choisit **P1 à P4** pour son pôle.
- Un autre rôle peut **proposer une priorité au CEMA** (P1 à P4, ou « — » pour retirer sa proposition).
- Le CEMA (ou l'animateur) fixe sa priorité, ou « — » pour revenir à celle du pôle, et peut **Accepter** ou **Écarter** chaque proposition.
- Une proposition différente de la priorité retenue fait de la ligne un point chaud (« priorité contestée »).

### 8.3 Contrainte politique
- **MINARM** ou **Animateur** : case « Contrainte politique : non arbitrable ». Une fois cochée, la ligne porte un drapeau, passe avant P1, reste toujours au-dessus de la ligne de flottaison et n'a plus de bloc d'arbitrage.
- **Le porteur** peut **Demander la contrainte politique** (et retirer sa demande). Une contrainte demandée et non acquise est un point chaud.
- Fonctionne aussi sur un pion du socle (clé « pion »). Le SMV est sous contrainte acquise par défaut.

### 8.4 Financement (voir section 12)
Le porteur, DGRIS, DGA, MEFR et l'animateur peuvent **proposer un montage**.

---

## 9. Arbitrer (CEMA)

### 9.1 Sur la fiche d'une demande
Pour le CEMA, la fiche affiche d'abord les **avis des acteurs**, la raison du point chaud éventuel, puis **Décision du CEMA** :
- **En attente** (par défaut), **Retenu**, **Différé**, **Renoncé**.
- Si *Différé* : choisir **de 1, 2 ou 3 ans**. La ligne est décalée d'autant ; ce qui dépasse 2032 sort de la LPM.
- Pour un pion sur mesure : case **pion sur mesure validé**.
- Puis le bloc **Priorité** pour fixer la priorité CEMA.

Une ligne sous contrainte politique acquise n'est pas arbitrable.

### 9.2 Passage en force
Si le CEMA **retient** une ligne qui porte un avis *Défavorable*, *Refus industriel* ou *Insoutenable*, la fiche affiche « Passage en force : retenue par le CEMA malgré un avis défavorable. Tracé et visible du MINARM. » Le *Bilan* les compte.

### 9.3 Onglet *Arbitrage* (CEMA, SC-Plans, Animateur)
- Tableau par année : montant **retenu** et **marge** après arbitrage.
- Les lignes groupées par statut (en attente, retenu, différé, renoncé) avec nombre et total. Chaque ligne : porteur, nature, années, total, badges « alerte », « à arbitrer », « n avis ». Un clic ouvre la fiche à sa première année.

### 9.4 Méthode conseillée
1. Filtre **Où faut-il arbitrer ?** : traiter d'abord les points chauds.
2. Onglet **Flottaison** : voir ce qui passe sous le plafond.
3. Ajuster les priorités CEMA, puis retenir, différer ou renoncer.
4. Vue **Après arbitrage** pour contrôler la marge de chaque année.

---

## 10. Ligne de flottaison (onglet *Flottaison*)

Pour l'année affichée, l'outil empile dans l'ordre :
1. **Socle et économies** (dissolutions, repassages à 50 %) ;
2. les **contraintes politiques** (drapeau) ;
3. les demandes **P1**, puis **P2**, **P3**, **P4** (dans une même priorité, l'ordre de création) ;
4. les **excédents d'enveloppe**, à leur rang.

La **ligne du plafond** est tracée où le cumul dépasse le plafond. Tout ce qui est dessous est marqué « sous la ligne : à abandonner ou différer », reçoit la barre rouge sur la table et devient un point chaud. En bas : marge ou dépassement, nombre de demandes sous la ligne. Le calcul suit la vue choisie (*Demandes* ou *Après arbitrage*). Chaque élément est cliquable.

---

## 11. Enveloppes internes (onglet *Enveloppes*)

- Une enveloppe est un budget annuel d'un pôle. Par défaut : **R&D de la DGA, 900 M€/an**, adossée au pion R&D du socle.
- Le porteur range une demande dans son enveloppe depuis sa fiche : bloc **Enveloppe interne** > *Ranger dans* (ou « Hors enveloppe : pèse directement sur la table »).
- Les lignes rangées sont payées par l'enveloppe, par ordre de priorité. **Seul l'excédent** pèse sur la table, sous forme de jetons « Excédent enveloppe … » dans le paquet de l'entité.
- L'onglet montre, pour l'année : barre de remplissage, montant rangé, reste ou excédent, et chaque ligne avec « tient dans l'enveloppe » ou « déborde ».
- L'animateur, le SC-Plans ou le CEMA crée, renomme, modifie ou retire des enveloppes dans *Réglages*.

---

## 12. Financement et souveraineté

### 12.1 Modes
| Mode | Effet pour la France |
|---|---|
| **National** (par défaut) | La France paie tout. Souveraineté pleine. |
| **Mutualisé avec des alliés** | La France paie sa **part française en %** ; le reste est la part alliée (hachures, hors budget). On indique les **partenaires** et la **zone** : UE, hors UE, ou UE et hors UE. La zone est devinée à la saisie des pays (Allemagne, Italie… = UE ; Royaume-Uni, États-Unis, Norvège… = hors UE), modifiable. |
| **Subvention UE** | Une part (en %) est payée par l'UE. Programme national, dépendance financière à l'UE. |
| **Prêt UE** | Une part (en %) est empruntée cette année-là, puis **remboursée sur 3 ans** les années suivantes ; ce qui tombe après 2032 est reporté hors LPM. |

### 12.2 Cycle d'un montage
1. Proposer : dans la fiche, bloc **Financement** > *Proposer un montage (DGRIS, DGA, MEFR ou le pôle)* > mode, pourcentage, partenaires, zone > **Proposer ce montage**. Choisir *National* puis proposer retire le montage.
2. Valider : l'**animateur** coche « Partenaire plausible : montage validé ». Un montage proposé par l'animateur est validé d'office. **Tant qu'il n'est pas validé, le montage ne change aucun montant** (il est « envisagé »).
3. Défection : l'animateur peut **Déclencher la défection de l'allié**. La part française remonte à 100 %, la ligne repasse **en attente d'arbitrage**, devient un point chaud et déclenche l'alerte DGRIS-03. *Annuler la défection* la rétablit.

### 12.3 Lecture de la souveraineté
- Sur la fiche : « Souveraineté · Programme partagé avec des partenaires UE : la France garde 50 % de la décision », ou « Subvention UE : programme national, dépendance financière à l'UE », ou « Souveraineté pleine ».
- Dans le *Bilan* > **Souveraineté** (lignes non renoncées, après arbitrage) :
  - **X % des demandes restent sous décision nationale** sur 2027-2032 ;
  - montants **partagés avec l'UE** et **hors UE**, dont la part payée par les alliés ;
  - montant **financé par l'UE** (subventions et prêts) ;
  - montant **national**, dont ce qu'un montage seulement envisagé partagerait ;
  - la **part nationale année par année**.
- Les règles DGRIS-01 et DGRIS-02 signalent un programme à partenaires sans montage mutualisé, ou dont le montage n'est pas encore validé.

---

## 13. Alertes des fiches de rôle

Les 78 règles des fiches de rôle sont toutes consultables (onglet *Ma demande* > *Règles de jeu*). **Aucune ne bloque.** Celles que l'outil sait vérifier sortent en alerte :

| Règle | Ce qui est vérifié | Niveau |
|---|---|---|
| DGA-12 à DGA-20, DGA-24 | Délai de mise en service de l'option (stocks, SEAD, IA, LAD, Eurodrone, quai, char, MGCS, VBCI-NG / VBAE / successeur Tigre / HIL, armes à énergie dirigée, hypervélocité, essaims…). Mise en service après 2032 = **alerte** (payé sans effet avant 2033) ; opérationnel après l'année de paiement = **à savoir**. | alerte / à savoir |
| DGRIS-01 | Programme à partenaires dont le montage mutualisé n'est pas validé par l'animateur. | alerte |
| DGRIS-02 | Programme à partenaires sans montage mutualisé. | alerte |
| DGRIS-03 | Défection de l'allié : à réarbitrer. | alerte |
| EMM-01 | Second porte-avions (PANG2) : il faut au moins 5 années avec une annuité dans la LPM. | alerte |
| DGA-22 | Second porte-avions sans quai permanent porte-avions dans la demande. | alerte |
| DGA-01 | Cadence industrielle : plus de 25 % d'écart de coût d'une année à l'autre sur une même ligne. | alerte |
| SCP-04 | Nouvelle capacité : 3 ans d'activation ; opérationnelle trop tard pour la LPM. | à savoir |
| SCP-05 | Dissolution comptée avant 2029 : retirer une capacité prend 2 à 3 ans. | alerte |
| SGA-01 | Masse salariale : plus de 4 DORESE RH supplémentaires d'une année à l'autre, toutes armées confondues. | alerte |

Où les voir : pastille « ! » sur le pion, bloc *Alertes des fiches de rôle* dans la fiche, *Ma demande*, *Bilan* > tableau de bord, badges dans *Arbitrage*. Une alerte se « lève » en corrigeant la demande, ou s'assume : le CEMA peut retenir malgré elle (comptée « passée en force malgré une alerte »). Les règles non vérifiées par l'outil sont à faire respecter par l'animateur.

---

## 14. Points chauds : « Où faut-il arbitrer ? »

Une demande non renoncée devient **point chaud** dès qu'une de ces raisons apparaît :
- **avis divergents** (au moins un positif et un négatif) ;
- **avis défavorable** (défavorable, refus industriel ou insoutenable), avec les rôles concernés ;
- **priorité contestée** (une proposition différente de la priorité retenue) ;
- **défection d'un allié** ;
- **contrainte politique demandée** et non encore acquise ;
- **alerte de fiche** (niveau alerte) ;
- **sous la ligne de flottaison** de l'année affichée.

Les raisons s'affichent dans l'infobulle du pion, en tête du bloc *Avis*, et en badge « à arbitrer » dans *Arbitrage*. Le filtre **Où faut-il arbitrer ? (n)** ne garde qu'eux sur la table.

---

## 15. Trajectoire 2027-2032 (onglet *Trajectoire*, étape 2)

- L'onglet liste les lignes du modèle 2032 non renoncées, dans l'ordre de l'empilement, avec une bande de six années (montants en Md€ payés par la France), le porteur, la priorité ou la contrainte, le statut, et ce qui tombe après 2032.
- **CEMA, SC-Plans, Animateur** choisissent pour chaque ligne l'**année d'entrée** : « non placée (2032 seulement) », « dès 2027 » … « dès 2032 », ou « après 2032 ». Le même choix existe dans la fiche (bloc *Trajectoire 2027-2032*).
- **Étaler automatiquement** : l'outil prend les lignes **retenues** du modèle 2032, dans l'ordre de priorité (contraintes d'abord), et place chacune à la **première année** où elle tient sous tous les plafonds, compte tenu de ce qui est déjà posé (tranches, financements, remboursements compris). Ce qui ne tient nulle part glisse **après 2032**. Le message indique le nombre de lignes placées et de lignes reportées. On peut ensuite corriger à la main.
- Une ligne entrée en année N pèse de N à 2032 ; avec des tranches, N1 en N, N2 en N+1, etc.
- En bas : **marge après arbitrage** par année.
- Les jauges et la table de chaque année reflètent la trajectoire.

---

## 16. Bilan (onglet *Bilan*)

- **Tableau 2027-2032** (en Md€) : socle, demandes, plafond, marge après arbitrage.
- **Demandes par armée** sur 6 ans.
- **Souveraineté** (section 12.3).
- **Avis et points chauds** : nombre de points chauds, nombre d'avis donnés.
- **Règles des fiches : tableau de bord** : alertes actives ; passées en force (malgré une alerte, malgré un avis défavorable) ; « à savoir » ; liste dépliable des alertes, chacune cliquable.
- **Télécharger les lignes (CSV)** : une ligne par demande, avec pôle, action, objet, armée, montant par année, total, décision, justification. S'ouvre dans un tableur (séparateur point-virgule).

---

## 17. Réglages (Animateur, SC-Plans, CEMA)

- **Plafond annuel** en cases de 100 M€, pour chaque année.
- **Pions de scénario posés** : SMV et munitions, case par année.
- **Étape de la partie** : celle qu'affiche l'outil à l'entrée des joueurs (*1 · Modèle 2032* ou *2 · Trajectoire 2027-2032*).
- **Enveloppes internes des pôles** : pôle, nom, montant annuel ; *Ajouter une enveloppe*, *Retirer*.
- **Enregistrer** : s'applique à tous les joueurs dans les secondes qui suivent.

---

## 18. Échanges et comparaison (Animateur, onglet *Échanges*)

Objectif : récupérer le modèle 2032 arbitré, construire hors de l'outil une trajectoire de référence, puis la comparer à celle des joueurs.

1. **Modèle 2032 arbitré** : le nombre de lignes et celles encore en attente. **JSON** (fichier complet : socle, pions, DORESE, priorités, contraintes, financements, avis, souveraineté, décisions du CEMA) ou **CSV (tableur)**.
2. **Trajectoire des joueurs** : les années 2027-2032 telles que construites. JSON ou CSV.
3. **Trajectoire de référence** : importer un fichier JSON au même format (`strategikon-echange`, version 1, type `trajectoire`). Elle reste **dans ce navigateur seulement**, invisible des joueurs. *Remplacer* ou *Retirer la référence*. Un mauvais fichier affiche une erreur.
4. **Comparaison** : tableau par année (joueurs, référence, écart) ; nombre de lignes entrées plus tôt ou plus tard chez les joueurs ; reports après 2032 ; renoncements ; alertes franchies. **Afficher les deux trajectoires côte à côte** ouvre une vue plein écran : jauges par année des deux côtés, puis chaque ligne avec ses deux bandes, triée par écart d'entrée, avec les différences annotées. *Fermer* pour revenir.

Les fichiers sont nommés `strategikon-<partie>-<type>-<date>-<heure>.json|csv`.

---

## 19. Déroulé type d'une séance

**Avant**
1. L'animateur ouvre une partie (nom, mot de passe), vérifie *Réglages* : plafonds, pions de scénario, étape « 1 · Modèle 2032 », enveloppes.
2. Il donne aux joueurs l'adresse, le nom de la partie et le mot de passe, et attribue les rôles.

**Étape 1 · Modèle 2032**
1. Chaque pôle pose ses demandes 2032, fixe ses priorités, justifie.
2. Les acteurs commentent : avis, avis industriels et de soutenabilité, priorités proposées, montages (DGRIS, DGA, MEFR), contraintes (MINARM).
3. L'animateur valide les pions sur mesure et les montages plausibles ; il peut déclencher une défection.
4. Le CEMA arbitre, avec le filtre *Où faut-il arbitrer ?* et l'onglet *Flottaison*.
5. L'animateur exporte le **modèle 2032** (onglet *Échanges*).

**Étape 2 · Trajectoire**
1. L'animateur passe l'étape à « 2 · Trajectoire » dans *Réglages*.
2. CEMA ou SC-Plans lance *Étaler automatiquement*, puis ajuste les années d'entrée.
3. Les pôles ajustent tranches et calendriers ; on vérifie les jauges et alertes.
4. L'animateur exporte la **trajectoire**, importe la **référence**, présente la **comparaison** côte à côte.

**Après** : *Bilan* > CSV pour garder les lignes, exports JSON pour archiver.

---

## 20. Règles de calcul

- **Coût d'une capacité posée** : à 50 %, le coût « 50 % » du pion ; à 100 %, le coût « 100 % » (avec ses DORESE). Une DORESE = 100 M€/an.
- **Renforcer** : DORESE manquantes × 100 M€/an (un seul exemplaire, le pion du socle est unique).
- **Repasser à 50 %** : économie = DORESE posées × 100 M€/an.
- **Dissoudre** : économie = coût du pion tel qu'il est posé au départ.
- **Option ou sur mesure** : prix saisi, arrondi à la case (au moins 100 M€), × nombre d'exemplaires, par année posée ; ou ses tranches.
- **Socle** : photo 2027 (39,9 Md€), toutes capacités à 100 % sauf l'A400M (il manque 1 DORESE activité).
- **Total d'une année** = socle + demandes (part française, remboursements de prêts compris, excédents d'enveloppe compris, lignes rangées en enveloppe exclues) ; **marge** = plafond − total.
- **Après arbitrage** : on retire les renoncées, on décale les différées.
- **Imputation** : chaque ligne est imputée à une armée (Terre, Marine, Air et Espace, Interarmées).

---

## 21. FAQ et dépannage

**Je ne vois pas ma partie dans la liste.** Vérifiez l'adresse du site. Si la liste affiche « Liste indisponible » ou « Base injoignable », vérifiez la connexion internet ; réessayez en rechargeant. Si elle affiche « Aucune partie ouverte », les parties ont été réinitialisées : l'animateur en ouvre une nouvelle.

**« Mot de passe incorrect » / « Partie introuvable ».** Redemandez le nom exact et le mot de passe à l'animateur.

**Mon pion n'apparaît pas chez les autres.** Attendre 6 secondes. Si un message « Non enregistré » est apparu, refaire le geste. Recharger la page en dernier recours (on revient au même rôle).

**Je ne peux pas modifier une demande.** Seul son porteur la modifie. Changez de rôle si vous êtes bien le porteur, ou donnez un avis.

**Je ne trouve pas une capacité dans *Poser*.** Les armées ne voient que leurs propres capacités. Vérifiez le filtre (*Capacités* / *Options de ma fiche* / *Sur mesure*) et videz le champ *Chercher…*.

**Ma demande « ne compte pas ».** Le prix d'une option ou d'un sur mesure est vide : fixez-le dans la fiche.

**Mon montage ne change rien aux montants.** Il doit être validé par l'animateur.

**La ligne est sous la ligne de flottaison.** Monter sa priorité, la ranger dans une enveloppe, réduire son coût, chercher un montage, ou accepter qu'elle soit différée ou renoncée.

**Je ne vois pas l'onglet *Trajectoire*.** Il n'existe qu'à l'étape 2 : cliquez sur *2 Trajectoire 2027-2032* dans le bandeau.

**Je ne vois pas *Arbitrage*, *Réglages* ou *Échanges*.** Ils dépendent du rôle (section 4.4).

**Une alerte me gêne.** Elle n'empêche rien. Lisez la règle et sa source ; corrigez ou justifiez, le CEMA tranchera.

**L'animateur a perdu sa référence.** Elle est stockée dans son navigateur ; la réimporter depuis le fichier JSON.

**L'écran est trop petit.** L'outil s'utilise mieux sur ordinateur ; la table défile horizontalement si besoin.

---

## 22. Administration (pour l'organisateur)

- **Code** : dépôt GitHub `ahk1515/STRATEGIKON`, branche `main` publiée par GitHub Pages. Fichiers principaux : `index.html`, `js/app.js` (interface), `js/moteur.js` (calculs), `js/stockage.js` (base), `data/` (pions, catalogue, règles), `supabase/schema.sql` (base). Tests : `node --test tests/*.test.js`.
- **Données de conception** dans `docs/` : ce guide, `conception/acteurs-et-interfaces.md`, `catalogue-roles/` (catalogue des options, règles des fiches, synthèses, scripts sources), `donnees/` (base des pions).
- **Base Supabase** : tables `parties` et `lignes`, fermées à l'accès direct ; la page passe par des fonctions qui vérifient le mot de passe. Seule la clé **publique** (publishable) figure dans `js/config.js`. Ne jamais y mettre la clé secrète ni la `service_role`.
- **Réinitialiser toutes les parties** : dans Supabase > SQL Editor, exécuter `supabase/reinitialiser.sql` (étape 1 : sauvegarde JSON de toutes les parties ; étape 2 : effacement ; étape 3 : contrôle). La page publique ne peut pas effacer une partie.
- **Publier une évolution** : la tester dans la maquette, la faire valider, la publier hors séance de jeu. Les paramètres ajoutés sont rétrocompatibles : une partie en cours se rouvre sans perte.

## 23. Limites connues

- Le mot de passe est commun à toute la partie : l'outil ne vérifie pas qu'un joueur n'endosse que son rôle.
- Deux joueurs qui modifient la même demande au même instant : la dernière écriture l'emporte.
- La trajectoire de référence n'est pas partagée : elle reste dans le navigateur de l'animateur.
- Seules 13 règles des fiches sont vérifiées automatiquement ; les autres relèvent de l'animateur.
