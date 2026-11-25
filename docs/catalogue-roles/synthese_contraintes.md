# Contraintes du jeu et tableau de bord : synthèse de conception

Les fiches de rôle contiennent **78 contraintes**. Elles sont triées par rôle, avec leur source (fiche et page) et la façon dont l'outil les applique :

| Application | Nombre | Effet |
|---|---|---|
| Blocage | 23 | Saisie ou arbitrage refusé, sauf dérogation du rôle indiqué |
| Alerte | 22 | Ligne acceptée mais signalée, reprise dans le tableau de bord |
| Surcoût automatique | 11 | L'outil pose lui-même un coût ou une économie |
| Drapeau | 22 | Marque d'état : avis DGA, validation de l'animateur, négociation |

La DGA en porte 30 ; viennent ensuite le SGA (9), le MEFR (8), la DGRIS (7) et le Sous-chef Plans (6).

## Pourquoi on ne joue pas librement avec un programme d'armement

1. **Cadence** : une commande ne varie pas de plus de 25 % d'une année à l'autre (DGA p2). Il faut aussi au moins une commande minimale chaque année, par exemple 20 MGCS, 40 VBCI NG ou 8 Rafale F6 (DGA p3-4). La DGA peut imposer un report, une mutualisation ou un refus.
2. **Délais** : une nouvelle chaîne de production demande 3 ans de préavis (DGA p3) et une nouvelle capacité au moins 3 ans pour être activée (SC-Plans p2). Les programmes ont leurs dates : MGCS pas avant 2030, VBAE et successeur Tigre en 2030, VBCI NG en 2032, HIL en 2035.
3. **Plafonds physiques** : au plus une brigade SAMP/T tous les 2 ans, entre 36 et 120 MGCS par an, et au plus 4 pions masse salariale par an, toutes armées confondues (SGA p2).
4. **Étalement imposé** : le second porte-avions coûte 5 Md€ sur 5 ans, avec au moins une annuité chaque année (Marine p5). Son groupe aéronaval coûte 2 Md€ sur 3 ans.
5. **Dépendances** : il faut un quai permanent pour avoir deux porte-avions. Les Loyal Wingmen n'ont de sens qu'avec un avion porteur. Une capacité de frappe demande un plan de munitions, et une implantation demande son infrastructure.
6. **Désarmer coûte** : un pion du socle renoncé reste payé 2 à 3 ans (SC-Plans p2-3).
7. **Engagements contractés** : la France a promis 21 Eurodrones sur 63.
8. **Alliés** : une capacité mutualisée n'est acquise qu'avec un partenaire jugé plausible par l'animateur. Une défection fait remonter la part française (DGRIS p2-3).

## Tableau de bord après l'arbitrage du CEMA

Il compte 22 indicateurs, regroupés en six familles :

- **Réponse aux besoins** : taux de satisfaction par armée, en montant et en nombre de demandes ; taux de demandes P1 retenues ; écart entre la priorité du pôle et celle du CEMA ; opérationnalité (part des capacités en face verte).
- **Renoncements** : liste et montant des renoncements, renoncements assumés par la COCA, glissements des différés, économies réelles des retraits.
- **Politique** : respect des drapeaux tricolores (cible 100 %), couverture des 22 exigences présidentielles, projets DGRIS et MEAE retenus ou abandonnés, engagements internationaux tenus.
- **Budget** : consommation de chaque plafond annuel, part de la table par armée, surcoûts subis (carburants, inflation, défection), financement hors LPM, montant dépendant d'un allié.
- **Contraintes** : alertes actives, passages en force justifiés, plafond RH.
- **Cohérence** : couverture des scénarios COCA, contrats opérationnels tenus.

Pour produire ces indicateurs, il faut ajouter à chaque ligne de l'outil :
- l'année retenue ;
- des étiquettes d'exigence politique ;
- un motif de renoncement ;
- l'avis de la DGA ;
- une quantité commandée ;
- des liens vers les munitions et l'infrastructure ;
- un journal des dérogations.

Les priorités P1 à P4, le drapeau tricolore et le mode de financement sont déjà dans le lot de conception en cours.

## Points à vérifier

- Un pion « masse salariale » correspond-il bien à un DORESE RH ? Je l'ai supposé.
- Plafonds : la fiche MEFR donne 58, 59 et 60 Md€ pour 2030 à 2032, alors que l'outil applique 59 Md€ par défaut.
- Plusieurs règles DGA datent de l'édition 2035-2040 : R&D aboutissant en N+5 à N+15, second porte-avions en 2039-2044, grille des chars. Elles sont marquées « À vérifier ».
- Les fiches Air et DGA donnent deux ratios incompatibles pour les Loyal Wingmen.
