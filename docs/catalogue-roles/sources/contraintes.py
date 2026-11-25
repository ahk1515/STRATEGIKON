# -*- coding: utf-8 -*-
# Contraintes de jeu tirées des fiches de rôle Strategikon, et conception du tableau de bord.
# Application : blocage, alerte, surcoût automatique, drapeau (un seul mode principal par contrainte).
import csv, json, os, sys
from collections import OrderedDict, Counter
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

FICHE = {
    "DGA": "strat_role-dga-fr", "SC-Plans": "strat_role-sc-plans-fr", "SGA": "strat_role-sga-fr",
    "MEFR": "strat_role-mefr-fr", "DGRIS": "strat_role-dgris-fr", "MEAE": "strat_role-meae-fr",
    "EMAT": "strat_role-armee-de-terre-fr", "EMAAE": "strat_role-armee-de-l-air-fr", "EMM": "strat_role-marine-fr",
    "CEMA": "strat_role-cema-fr", "MINARM": "strat_role-minarm-fr", "COCA": "strat_role-coca-fr / strat_role-red-team-fr",
    "PR": "strat_ambition-pr-2027-2033-fr",
}
ENT = {"DGA": "DGA", "SC-Plans": "Sous-chef Plans", "SGA": "SGA", "MEFR": "MEFR", "DGRIS": "DGRIS", "MEAE": "MEAE",
       "EMAT": "Armée de Terre", "EMAAE": "Armée de l'Air et de l'Espace", "EMM": "Marine nationale", "CEMA": "CEMA",
       "MINARM": "MINARM", "COCA": "COCA / Red team", "PR": "Ambition présidentielle"}
C = []


def c(id_, role, theme, regle, pages, app, mise, *, params=None, cible="", decl="", donnees="", qui="",
      ed="2027-2032", note=""):
    C.append(OrderedDict(id=id_, role=role, porteur=ENT[role], theme=theme, regle=regle, source=FICHE[role],
                         pages=pages, application=app, mise_en_oeuvre=mise, declencheur=decl, cible=cible,
                         parametres=params or {}, donnees_necessaires=donnees, qui_peut_lever=qui,
                         edition=ed, a_verifier=note))


B, A, S, D = "blocage", "alerte", "surcoût automatique", "drapeau"
ED35 = "À vérifier : passage rédigé pour 2035-2040"

# ---------------------------------------------------------------- DGA : programmes d'armement
c("DGA-01", "DGA", "Cadence industrielle", "Le volume d'une commande ne varie pas de plus de 25 % d'une année à l'autre.",
  "2", A, "Comparer la quantité commandée d'un programme d'une année sur l'autre ; alerte au-delà de ±25 %, que la DGA peut transformer en refus.",
  params={"variation_max": 0.25}, cible="Tout programme d'armement à commandes annuelles",
  decl="Saisie ou modification d'une ligne de commande pluriannuelle", donnees="Quantité commandée par programme et par année",
  qui="DGA (dérogation)")
c("DGA-02", "DGA", "Avis industriel", "La DGA peut imposer reports de cadence, mutualisations ou glissements calendaires, refuser une tuile trop ambitieuse ou proposer une alternative (achat sur étagère, prolongation, cofinancement).",
  "2", D, "Champ « avis DGA » sur chaque ligne d'armement : favorable, report, mutualisation, alternative, refus. Une ligne refusée ne peut pas être retenue sans arbitrage CEMA ou MINARM.",
  cible="Lignes d'armement", decl="Avant l'arbitrage CEMA", donnees="Avis DGA et motif", qui="CEMA, MINARM")
c("DGA-03", "DGA", "Chaîne de production", "Toute création de chaîne de production exige un préavis de 3 ans et une commande minimale annuelle garantie ; sinon refus industriel, désengagement ou surcoûts.",
  "3", B, "Pour un programme qui crée une chaîne, première livraison au plus tôt en année de décision + 3. En cas de dérogation, la ligne porte le drapeau « surcoût industriel » (montant non chiffré par la fiche, fixé par l'animateur).",
  params={"preavis_ans": 3}, cible="Nouveaux programmes nationaux", decl="Choix de l'année de livraison",
  donnees="Année de décision, année de première livraison, booléen « nouvelle chaîne »", qui="Animateur")
c("DGA-04", "DGA", "Commande minimale annuelle", "Commandes minimales annuelles (MCA) : SCAF 10 ; Eurodrone 2 ; A400M G2 3 ; MAWS 2 ; Rafale F6 8 ; CIFS 10 ; MGCS 20 ; SABC 5 ; VBAE 20 ; successeur VBCI 40 ; successeur Tigre 10 ; Loyal Wingmen 4 ; HIL 10 ; drones FPV et anti-drones en production continue.",
  "3, 4", A, "Une année de commande sous la MCA déclenche une alerte « risque de refus industriel ou surcoût ». Une année sans commande pour un programme en production continue déclenche aussi l'alerte.",
  params={"mca": {"SCAF": 10, "Eurodrone": 2, "A400M G2": 3, "MAWS": 2, "Rafale F6": 8, "CIFS": 10, "MGCS": 20,
                  "SABC": 5, "VBAE": 20, "Successeur VBCI": 40, "Successeur Tigre": 10, "Loyal Wingmen": 4, "HIL": 10}},
  cible="Programmes listés", decl="Contrôle annuel de la trajectoire", donnees="Quantité commandée par année", qui="DGA")
c("DGA-05", "DGA", "Fin de chaîne", "Les chaînes de production Rafale sont censées s'arrêter en 2035.", "2 (note)", A,
  "Alerte sur toute commande Rafale qui suppose une livraison après 2035.", params={"annee_arret": 2035},
  cible="Rafale", decl="Commande Rafale", donnees="Année de livraison")
c("DGA-06", "DGA", "Cadence SAMP/T", "Limite industrielle : 1 brigade sol-air SAMP/T NG tous les 2 ans au maximum.", "4, 7", B,
  "Refuser une deuxième brigade sol-air dans un intervalle de 2 ans.", params={"intervalle_min_ans": 2},
  cible="DGA-SAMPT", decl="Ajout d'une brigade sol-air", donnees="Années de livraison des brigades")
c("DGA-07", "DGA", "Doctrine et RH", "Pas de montée en puissance SAMP/T sans effort RH et doctrine.", "7", A,
  "Alerte si la ligne SAMP/T n'est accompagnée ni d'une DORESE RH ni d'une ligne doctrine.", cible="DGA-SAMPT",
  donnees="DORESE posées")
c("DGA-08", "DGA", "Dotation munitions", "Dotation minimale de 33 missiles ASTER pour la brigade sol-air.", "7", A,
  "Alerte si une brigade sol-air est retenue sans ligne de munitions ASTER associée.", params={"aster_min": 33},
  cible="DGA-SAMPT", donnees="Lien capacité ↔ ligne munitions")
c("DGA-09", "DGA", "Plan de munitions", "Tout programme générant une capacité de frappe doit inclure un plan de munitions associé, sous peine de rupture capacitaire.",
  "6, 11", A, "Alerte sur toute capacité de frappe (artillerie, SEAD, chasse, frégates, MGCS…) retenue sans ligne de munitions liée.",
  cible="Capacités de frappe", decl="Arbitrage CEMA", donnees="Étiquette « capacité de frappe », lien vers lignes munitions")
c("DGA-10", "DGA", "Stocks OTAN", "Stocks pour 30 jours de combat de haute intensité et recomplètement en 4 à 6 semaines (exigence OTAN). Repères : une division consomme 500 à 600 obus de 155 mm par jour ; 50 Rafale armés demandent 200 à 250 MICA.",
  "6, 11", A, "Indicateur de couverture des stocks ; alerte si le stock financé est inférieur au besoin de 30 jours calculé avec ces repères.",
  params={"jours": 30, "obus_par_jour_division": [500, 600], "mica_pour_50_rafale": [200, 250]},
  cible="Lignes munitions", donnees="Stocks financés par type")
c("DGA-11", "DGA", "Refus de plan munitions", "La DGA peut refuser des plans de munitions non alignés sur les cadences industrielles.", "11", D,
  "Avis DGA sur les lignes de munitions (même champ que DGA-02).", cible="Lignes munitions", qui="CEMA, MINARM")
for id_, cib, delai, pg, ed in [
    ("DGA-12", "Stockage de munitions", "1 an (stockage passif)", "11", "2027-2032"),
    ("DGA-13", "Escadron SEAD", "3 ans minimum (R&D, entraînement, doctrine)", "8", "2027-2032"),
    ("DGA-14", "IA militaire", "3 à 4 ans (2 ans démonstrateur, 1 an intégration, 1 an doctrine)", "9", "2027-2032"),
    ("DGA-15", "Anti-drones", "portable : immédiat à 1 an ; tactique : 2 ans ; lourd : 3 à 4 ans", "10", "2027-2032"),
    ("DGA-16", "Eurodrone", "3 ans après commande ; capacité ISR partielle dès 2 drones", "12", "2027-2032"),
    ("DGA-17", "Quais porte-avions", "temporaire actif en N+2 ; permanent en N+3", "5, 13", "2027-2032"),
    ("DGA-18", "Chars sur étagère", "1 à 4 ans selon le modèle (grille 2035-2040)", "16", ED35),
]:
    c(id_, "DGA", "Délai de mise en service", "%s : délai avant mise en service de %s." % (cib, delai), pg, B,
      "Le pion n'est compté opérationnel (et n'apparaît sur la table de l'année) qu'après ce délai ; avant, seule la dépense d'investissement est posée.",
      cible=cib, decl="Choix de l'année", donnees="Année de commande", ed=ed)
c("DGA-19", "DGA", "Calendrier MGCS", "Production à partir de 2029 ; un MGCS acheté arrive dans les forces un an après sa mise en production ; cadence basse 36 chars/an, haute 120 chars/an ; cible 100 en 2035 et 200 d'ici 2045.",
  "15", B, "Aucun escadron MGCS opérationnel avant 2030 ; au plus 120 chars livrés par an (10 escadrons) ; alerte sous 36 chars/an (cadence basse).",
  params={"debut_production": 2029, "delai_livraison_ans": 1, "cadence_min": 36, "cadence_max": 120, "chars_par_escadron": 12},
  cible="DGA-MGCS-ESC, DGA-TITAN")
c("DGA-20", "DGA", "Calendrier des véhicules et hélicoptères", "Livraisons initiales : VBCI NG 2032 ou avant ; VBAE 2030 ; successeur Tigre 2030 ; HIL 2035. Capacité complète 2038 pour les quatre.",
  "18", B, "Refuser un pion opérationnel avant l'année de livraison initiale.",
  params={"livraison_initiale": {"VBCI NG": 2032, "VBAE": 2030, "Successeur Tigre": 2030, "HIL": 2035}, "capacite_complete": 2038},
  cible="DGA-VBCI-NG, DGA-VBAE, DGA-TIGRE-SUCC, DGA-HIL", note="HIL 2035 hors fenêtre 2027-2032 ; la base des pions contient déjà une capacité HIL.")
c("DGA-21", "DGA", "Calendrier CIFS", "Cible : 10 à 15 pièces d'ici 2032 et 50 d'ici 2045 ; première mise en service vers 2035.", "17", A,
  "Alerte si plus de 15 pièces (2 batteries) sont programmées d'ici 2032.", params={"pieces_max_2032": 15}, cible="DGA-CIFS-*",
  note="Contradiction interne : 10-15 pièces d'ici 2032 mais mise en service en 2035.")
c("DGA-22", "DGA", "Dépendance infrastructure", "Les quais sont nécessaires pour un groupe aéronaval complet à Toulon ou Brest ; seul le quai permanent permet un double PA.",
  "13", B, "Un second porte-avions ou un double PA ne peut être retenu sans quai permanent financé et actif à la date de livraison.",
  cible="DGA-PANG2, DGA-CDG, EMM-PANG2", donnees="Lien PA ↔ ligne quai")
c("DGA-23", "DGA", "Étalement obligatoire", "Second PANG : 5 Md€ sur 5 ans ; groupe aéronaval additionnel : 2 Md€ sur 3 ans ; prolongation CDG : 1 Md€ étalé sur 2 ans (p5) ou unique (p13).",
  "5, 13", S, "L'outil répartit automatiquement la dépense sur les années (1 000 M€/an pendant 5 ans ; ~667 M€/an pendant 3 ans) ; le joueur ne peut pas tout poser sur une seule année.",
  params={"PANG2": {"total": 5000, "ans": 5}, "GAN2": {"total": 2000, "ans": 3}, "CDG": {"total": 1000, "ans": 2}},
  cible="DGA-PANG2, DGA-GAN2, DGA-CDG", ed=ED35, note="Dates d'origine 2039-2044 : à recaler sur 2027-2032.")
c("DGA-24", "DGA", "R&D : délai lié au financement", "Le délai d'opérationnalité dépend du niveau annuel : armes à énergie dirigée 300 M€/an → N+10, 200 M€/an → N+15 ; hypersonique 200 → N+5, 100 → N+10 ; essaim 300 M€ puis 200 M€/an → N+6 ; Argonaute 500 M€ puis 200 M€/an → N+10.",
  "5, 6", B, "La capacité issue de la R&D n'apparaît qu'après le délai ; le niveau annuel choisi fixe le délai. Une année sans financement suspend le compteur (hypothèse de conception, non écrite dans la fiche).",
  params={"AED": {"300": 10, "200": 15}, "HYPER": {"200": 5, "100": 10}, "ESSAIM": {"lancement": 300, "annuel": 200, "delai": 6},
          "ARGONAUTE": {"lancement": 500, "annuel": 200, "delai": 10}}, cible="DGA R&D", ed=ED35,
  note="Avec un délai de 5 à 15 ans, aucun de ces programmes n'est opérationnel avant 2032.")
c("DGA-25", "DGA", "Pas d'engagement de production", "Le financement du programme essaim de drones ne présume pas de son éventuelle mise en production.",
  "5", D, "Drapeau « études seulement » : la ligne ne crée aucune capacité sur la table.", cible="DGA-ESSAIM", ed=ED35)
c("DGA-26", "DGA", "Dépendance SCAF", "Loyal Wingmen : 1/3 à 1/2 des NGF déployés doivent pouvoir être accompagnés (120 NGF → 40 à 60 drones).",
  "14", A, "Alerte si des Loyal Wingmen sont retenus sans avion porteur (NGF ou Rafale F5/F6) ; contrôle du ratio.",
  params={"ratio": [0.33, 0.5]}, cible="DGA-LW", ed=ED35, note="La fiche Air dit 2 à 4 drones par chasseur : ratios incompatibles.")
c("DGA-27", "DGA", "Engagement contracté", "La France s'est engagée sur 21 Eurodrones sur un total de 63.", "3, 12", A,
  "Alerte « engagement international non tenu » si la trajectoire finance moins de 21 Eurodrones (7 pions) ; à relier à l'indicateur politique.",
  params={"engagement_france": 21, "total": 63}, cible="DGA-EURODRONE, DGRIS-ACT-INFL-EURODRONE")
c("DGA-28", "DGA", "Mutualisation possible", "Le coût du MGCS peut être mutualisé avec l'Allemagne si partenariat renforcé (bonus MEAE ou diplomatique possible).",
  "15", D, "Mode de financement « mutualisé » proposé par défaut ; drapeau « dépendant d'un allié ».", cible="DGA-MGCS-*",
  qui="Animateur (plausibilité du partenaire)")
c("DGA-29", "DGA", "Soutien industriel du flanc Est", "Les déploiements en Roumanie, dans les pays baltes ou autour du hub Pologne nécessitent stocks de munitions et de pièces, réparation, infrastructures et délais de recomplètement compatibles.",
  "3", A, "Alerte si une présence avancée est retenue sans ligne de stocks ou de soutien associée.", cible="Options EST-*")
c("DGA-30", "DGA", "Négociation interministérielle", "La DGA peut déclencher une négociation directe avec le MEFR (soutien budgétaire) ou le MEAE (portage diplomatique d'une coopération).",
  "3", D, "Drapeau « en négociation MEFR / MEAE » sur la ligne ; elle reste en attente d'arbitrage jusqu'à la levée.", qui="MEFR, MEAE")

# ---------------------------------------------------------------- SC-Plans : règles du plateau
c("SCP-01", "SC-Plans", "Droits", "Seul le Sous-chef Plans place, déplace, active ou dégrade les pions sur les plateaux.", "2, 3", B,
  "Droit d'écriture sur la table réservé au rôle SC-Plans (et à l'animateur) ; les autres rôles saisissent des demandes.")
c("SCP-02", "SC-Plans", "Opérationnalité", "Full ops (100 %) = niveau de dotation 2020, atteint quand tous les DORESE additionnels (MCO, entraînement/activité, effectifs) indiqués sur le pion sont posés : face verte. Sinon face rouge (90 % à 50 %) ; sans DORESE additionnel, 50 %.",
  "3", A, "Calcul automatique du taux d'opérationnalité de chaque capacité ; alerte « capacité dégradée » sur les capacités retenues sans tous leurs DORESE.")
c("SCP-03", "SC-Plans", "Sur-dotation", "Des DORESE au-delà du besoin peuvent porter une capacité au-dessus de 100 % (durcissement haute intensité), à la demande des armées.",
  "3", D, "Drapeau « durcie » ; compte comme dépense supplémentaire de l'armée.")
c("SCP-04", "SC-Plans", "Délai d'activation", "Délai de 3 ans minimum pour activer une nouvelle capacité.", "2", B,
  "Une capacité nouvelle demandée en année N n'est opérationnelle qu'en N+3 ; en mode « Modèle 2032 », dernière année de décision = 2029.",
  params={"delai_ans": 3})
c("SCP-05", "SC-Plans", "Coût de retrait", "Retirer une capacité prend 2 à 3 ans après la décision (reclassement du personnel, retrait logistique, cession de matériel) ; la destruction est actée en COCEM, pas par le SC-Plans seul.",
  "2, 3", S, "Un pion du socle renoncé continue d'être payé 2 ans (paramétrable à 3) après la décision : l'économie n'apparaît qu'en N+2 ou N+3.",
  params={"delai_retrait_ans": [2, 3]}, qui="COCEM (CEMA)")
c("SCP-06", "SC-Plans", "Intégration COCA", "Les travaux de la COCA doivent être intégrés aux programmations de chaque armée et connus du CEMA.", "4", D,
  "Les alertes COCA s'attachent aux lignes concernées.")

# ---------------------------------------------------------------- SGA
c("SGA-01", "SGA", "Plafond de recrutement", "Au plus 4 pions « masse salariale » supplémentaires par an, toutes armées confondues ; le SC-Plans doit respecter ce seuil, le SGA le surveille.",
  "2, 3", B, "Compter par année les DORESE RH (effectifs) nouvellement posées ; refuser au-delà de 4, sauf dérogation SGA chiffrée (SGA-03).",
  params={"rh_max_par_an": 4}, qui="SGA", note="Hypothèse : un pion « masse salariale » = un DORESE RH. À confirmer.")
c("SGA-02", "SGA", "Exception réserve", "La montée en puissance d'une division de réserve n'est pas soumise à la limite de 4 pions masse salariale.",
  "7", D, "Les options de réserve sont exclues du compteur SGA-01.", cible="SGA-RES-*")
c("SGA-03", "SGA", "Dépassement du plafond", "Le SGA peut dépasser le plafond par des campagnes de recrutement, de la robotique de soutien ou une revalorisation des filières ; chaque effort est chiffré, financé et discuté avec MEFR, MINARM et CEMA.",
  "5", D, "Drapeau « dérogation RH » qui relève le plafond de l'année, lié à une ligne de dépense SGA.", qui="SGA avec MEFR, MINARM, CEMA")
c("SGA-04", "SGA", "Ligne protégée", "Les dispositifs jeunesse (400 M€/an) ne peuvent être coupés sans conséquences politiques majeures.", "3, 4", D,
  "Candidat naturel au drapeau tricolore « contrainte politique » (non arbitrable) ; si l'animateur ne le coche pas, une coupe déclenche une alerte politique.",
  cible="SGA-JEUNESSE", qui="MINARM, animateur")
c("SGA-05", "SGA", "Plancher annuel", "Plan Famille : 800 M€ sur la LPM, au moins 100 M€ par an dès son lancement.", "4", A,
  "Alerte si une année après le lancement reçoit moins de 100 M€.", params={"min_annuel": 100, "total": 800}, cible="SGA-PLAN-FAMILLE")
c("SGA-06", "SGA", "Économie induite", "100 M€/an pendant 2 ans d'investissement énergie réduisent de 200 M€/an les coûts de carburants après la 2e année ; à coordonner avec le CEMA (Service de l'énergie opérationnelle).",
  "4", S, "Économie automatique de 200 M€/an sur la provision carburants à partir de la 3e année, si les 2 annuités sont financées.",
  params={"investissement": 100, "ans": 2, "economie_annuelle": 200}, cible="SGA-ENERGIE, MEFR-CARBU")
c("SGA-07", "SGA", "Infrastructure obligatoire", "Toute proposition capacitaire nécessitant implantation, quai, hangar ou base projetable doit inclure les infrastructures.",
  "2", A, "Alerte si une capacité étiquetée « implantation » est retenue sans ligne d'infrastructure liée.",
  donnees="Étiquette « besoin d'infrastructure » sur les options")
c("SGA-08", "SGA", "Soutenabilité", "Une capacité qui ne peut être soutenue durablement (personnels, infrastructures, énergie, maintenance) ne peut être considérée comme opérationnelle.",
  "5", D, "Le SGA peut marquer une capacité « non soutenable » : elle est comptée dégradée dans les indicateurs.", qui="SGA")
c("SGA-09", "SGA", "Projection", "La logistique projetable (hôpitaux de campagne, ateliers MCO, approvisionnements) doit être budgétée avec les capacités de projection des armées.",
  "4", A, "Alerte si un scénario de projection est retenu sans ligne de soutien projetable.")

# ---------------------------------------------------------------- MEFR
c("MEFR-01", "MEFR", "Plafond annuel", "Trajectoire de travail : 59, 58, 57, 58, 59, 60 Md€ de 2027 à 2032 ; hypothèse, ajustable par le MEFR.",
  "3, 4", A, "Plafond par année ; la ligne de flottaison sépare ce qui tient de ce qui dépasse. Le dépassement est une alerte (l'arbitrage tranche), pas un blocage de saisie.",
  params={"plafonds_mds": {"2027": 59, "2028": 58, "2029": 57, "2030": 58, "2031": 59, "2032": 60}}, qui="MEFR",
  note="L'outil a 590/580/570/590/590/590 cases par défaut : 2030-2032 diffèrent (58/59/60 Md€).")
c("MEFR-02", "MEFR", "Provision carburants", "Surcoûts carburants à provisionner dès la planification initiale, selon trois scénarios (optimiste, référence, pessimiste), de 100 M€ à 1,3 Md€ selon l'année.",
  "4, 5", S, "L'animateur choisit le scénario ; l'outil pose automatiquement le surcoût de chaque année (pion orange).",
  params={"optimiste": [100, 150, 200, 250, 300, 400], "reference": [250, 300, 350, 400, 500, 700], "pessimiste": [500, 650, 700, 800, 900, 1300]},
  qui="Animateur")
c("MEFR-03", "MEFR", "Inflation", "Scénarios d'inflation : stabilisation européenne −850 M€/an ; conflit régional prolongé −1 500 M€/an ; choc énergétique −2 800 M€/an ; guerre OTAN-Russie −4 900 M€/an de pouvoir d'achat.",
  "5", S, "Aléa déclenché par l'animateur : réduit d'autant le plafond effectif de chaque année concernée (ou pose un pion orange équivalent).",
  params={"stabilisation": -850, "conflit_regional": -1500, "choc_energetique": -2800, "guerre_otan_russie": -4900}, qui="Animateur")
c("MEFR-04", "MEFR", "Clause de solidarité OPEX", "Le MEFR peut lever la clause de solidarité : jusqu'à 50 % du coût des OPEX partagé avec d'autres budgets, en contrepartie d'un effort renforcé sur les postes classiques.",
  "6", S, "Réduit le pion « Surcoût OPEX » (900 M€) jusqu'à 50 % ; drapeau « contrepartie due » à documenter.", params={"part_max": 0.5}, qui="MEFR")
c("MEFR-05", "MEFR", "Financement européen", "Toute proposition de financement européen est élaborée avec la DGA, le MEAE et le MINARM, puis validée par les facilitateurs ; elle peut réduire partiellement le coût supporté par la LPM.",
  "6", D, "Mode de financement « subvention » ou « prêt » : la réduction ne s'applique qu'une fois le drapeau « validé animateur » posé.", qui="Animateur")
c("MEFR-06", "MEFR", "Réserve stratégique", "Le MEFR peut imposer une clause de révision budgétaire ou une réserve stratégique.", "6", S,
  "Une réserve gelée réduit le plafond disponible de l'année.", qui="MEFR, arbitrage MINARM")
c("MEFR-07", "MEFR", "Pouvoir de suspension", "Le MEFR peut autoriser, ajuster ou suspendre des programmes, et imposer redéploiements, reports ou révisions de priorités.",
  "2", D, "Statut « suspendu MEFR » sur une ligne ; levée par arbitrage MINARM.", qui="MINARM")
c("MEFR-08", "MEFR", "Surcoûts flanc Est", "Les coûts de présence avancée (Roumanie, Pologne, Baltique, logistique Est, soutien nation hôte) doivent être provisionnés dès la planification.",
  "4", A, "Alerte si une présence avancée est retenue sans provision sur toutes les années restantes (coût annuel récurrent).")

# ---------------------------------------------------------------- DGRIS / MEAE
c("DGRIS-01", "DGRIS", "Partenaire identifié", "Une capacité annoncée comme multinationale ne peut être considérée comme acquise sans partenaires identifiés et sans engagement plausible.",
  "2", B, "Une ligne en financement mutualisé reste « en attente » tant que l'animateur n'a pas validé la plausibilité du partenaire.",
  qui="Animateur", ed="2027-2033 (confirmée)")
c("DGRIS-02", "DGRIS", "Part française", "Dans toute brigade multinationale, programme commun ou présence avancée, la part française doit être explicitée et les carences alliées prises en compte.",
  "3", B, "Champ obligatoire « part française (%) » pour toute ligne mutualisée ; seule cette part est comptée, le reste hachuré.",
  ed="2027-2033 (confirmée)")
c("DGRIS-03", "DGRIS", "Défection alliée", "La planification ne doit pas présupposer une disponibilité automatique et illimitée des moyens alliés ; « que devient le modèle si un allié ne fournit pas les moyens annoncés ? »",
  "3, 7", S, "Aléa « défection » déclenché par l'animateur : la part alliée bascule sur la France (surcoût automatique) et la ligne repasse en arbitrage.",
  qui="Animateur", ed="2027-2033 (confirmée)")
c("DGRIS-04", "DGRIS", "Validation extérieure", "Chaque initiative est négociée ou instruite avec les joueurs responsables, puis soumise aux facilitateurs lorsqu'elle suppose une décision extérieure au ministère.",
  "7", D, "Drapeau « décision extérieure » : validation animateur requise avant arbitrage.", qui="Animateur", ed="2027-2033 (confirmée)")
c("DGRIS-05", "DGRIS", "Fiche d'engagement", "Pour chaque engagement nouveau : intérêt stratégique, moyens français nécessaires, contributions partenaires attendues, réversibilité et coût d'opportunité par rapport aux autres théâtres.",
  "2, 3", B, "Champs obligatoires sur les options diplomatico-militaires avant soumission.", ed="2027-2033 (confirmée)")
c("DGRIS-06", "DGRIS", "Partage des rôles du hub Pologne", "Hub divisionnaire Pologne : la DGRIS propose le cadre de coopération ; le CEMA et les armées définissent le besoin ; le SGA précise infrastructures et soutien.",
  "3", A, "Alerte si le hub est retenu sans besoin exprimé par une armée et sans ligne d'infrastructure SGA.", cible="EST-POL-HUB",
  ed="2027-2033 (confirmée)")
c("DGRIS-07", "DGRIS", "Dissuasion", "Le dialogue stratégique sur la dissuasion ne doit jamais être assimilé à une mise en commun de la décision nucléaire.",
  "3, 4", B, "Les pions Dissuasion ne peuvent pas passer en financement mutualisé.", ed="2027-2033 (confirmée)")
c("MEAE-01", "MEAE", "Validation des coûts", "Les coûts associés aux nouveaux partenariats sont validés par le MEFR ; les infrastructures des accords conclus sont préparées par le SGA.",
  "5", D, "Drapeaux « coût validé MEFR » et « infrastructure SGA » sur les options diplomatiques.", qui="MEFR, SGA", ed="2027-2033")

# ---------------------------------------------------------------- Armées
c("EMAT-01", "EMAT", "Haute intensité", "Le modèle 2027 repose sur une structure de 2020 : tout engagement d'une capacité en haute intensité double les DORESE nécessaires pour l'année en cours.",
  "2, 3", S, "Quand l'animateur déclare un engagement haute intensité, les DORESE des capacités Terre engagées sont doublées pour l'année.",
  params={"multiplicateur": 2}, qui="Animateur")
c("EMAT-02", "EMAT", "Taille minimale", "La plus petite tuile vaut 100 M€ ; un projet plus petit est rattaché à un programme existant, fusionné, ou traité comme signal sans tuile.",
  "4", B, "Refuser une ligne de moins de 100 M€ ; proposer le rattachement à une ligne existante. Même règle dans les fiches Air (p4) et Marine (p5).",
  params={"min": 100})
c("EMAT-03", "EMAT", "Objectif doctrinal", "Chaque capacité doit être liée à un objectif doctrinal clair (offensif, défensif, logistique, dissuasif) ; coût, volume et délai sont évalués par l'animateur ou les arbitres.",
  "6", D, "Champ obligatoire « objectif doctrinal » ; une piste non chiffrée porte le drapeau « à chiffrer par l'animateur ». Même règle Air (p6) et Marine (p8).")
c("EMAT-04", "EMAT", "Composition Titan", "Brigade Titan : 96 MGCS, 160 successeurs VBCI, 120 VBAE, 18 SABC ; 1 à 2 brigades Leclerc au standard Titan d'ici 2040.",
  "3", A, "Alerte si une brigade Titan est retenue sans les programmes qui la composent (MGCS, VBCI NG, VBAE, SABC).", cible="EMAT-TITAN, DGA-TITAN")
c("EMAAE-01", "EMAAE", "Fin de vie", "Les C-130H sont en fin de vie et coûteux à entretenir ; remplacement ou retrait à envisager.", "3", A,
  "Alerte de fin de vie si la capacité C-130H est maintenue sans décision.")
c("EMAAE-02", "EMAAE", "Exploitation sol-air", "Brigade anti-aérienne : 200 M€/an en version dégradée, 300 M€/an pour une capacité complète avec MCO renforcé.",
  "3", S, "Le coût d'exploitation suit le niveau choisi (dégradé ou complet) à partir de la mise en service.", cible="EMAAE-BSA")
c("EMM-01", "EMM", "Calendrier du second PA", "Second PA-NG : calendrier obligatoire sur 5 années, au moins une action de développement ou de financement par an ; capacité des cales limitée.",
  "5", B, "Le second PA exige une ligne financée chaque année pendant 5 ans ; une année manquante bloque la livraison et repousse le calendrier.",
  params={"ans": 5}, cible="EMM-PANG2, DGA-PANG2", ed="À vérifier : chronologie PANG 2036-2038")
c("EMM-02", "EMM", "Ports", "Seules Toulon et Brest peuvent accueillir PA, PHA ou porte-drones lourds ; vérifier la capacité des quais à accueillir deux PA.",
  "5", B, "Même mécanisme que DGA-22 (quai permanent requis pour deux PA).", cible="EMM-PANG2")
c("EMM-03", "EMM", "Rupture capacitaire", "Les FDA Forbin doivent être remplacées rapidement ; les Atlantique 2 arrivent en fin de vie (MAWS).", "3, 4", A,
  "Alerte de rupture si aucune ligne de remplacement FDA ou MAWS n'est retenue sur la période.")
c("EMM-04", "EMM", "Validation doctrinale", "L'IA navale doit être intégrée dans une doctrine interarmées validée par le CEMA.", "6", D,
  "Drapeau « validation CEMA » sur les projets IA navals.", qui="CEMA")

# ---------------------------------------------------------------- CEMA, MINARM, COCA
c("CEMA-01", "CEMA", "Projets transverses", "Le CEMA a le dernier mot sur tout ce qui dépasse une seule armée et peut demander modification, mutualisation, fusion ou réorientation (drones, IA, spatial, GE, cyber, munitions).",
  "4, 5", D, "Les lignes multi-armées ou transverses passent obligatoirement par l'arbitrage CEMA ; action « fusionner » dans l'écran d'arbitrage.", qui="CEMA")
c("CEMA-02", "CEMA", "Contrats opérationnels", "Contrats 2027 : Air 45 chasseurs, 6 MRTT, 15 avions de transport, 8 systèmes MALE ; Mer 1 groupe aéronaval, 2 SNA et 3 frégates en permanence à la mer, 6 ATL2/MAWS ; Terre 1 brigade Guépard, 120 chars disponibles, 1 capacité d'intervention rapide permanente.",
  "2", A, "Alerte si un renoncement fait passer une armée sous un contrat opérationnel (nécessite le lien pion ↔ contrat).", donnees="Correspondance pions ↔ contrats",
  ed="2027-2033")
c("MINARM-01", "MINARM", "Arbitrage politique", "Le MINARM tranche les désaccords majeurs et valide ou ajuste toute évolution majeure des forces ou tout programme d'armement.",
  "5", D, "Seuls MINARM et l'animateur cochent le drapeau tricolore « contrainte politique » ; une ligne ainsi marquée est non arbitrable et placée au-dessus de la ligne de flottaison.",
  qui="MINARM, animateur", ed="2027-2033")
c("MINARM-02", "MINARM", "Priorités politiques", "Sujets d'attention : flanc Est, munitions (pérenniser le plan munitions), drones et anti-drones, Rafale F6 et combat collaboratif, espace, PANG « France Libre » à l'eau en 2036, réserves, division de réserve, SMV.",
  "4", D, "Liste de contrôle politique (onglet « Exigences politiques ») ; chaque ligne peut être étiquetée par exigence.", ed="2027-2033")
c("COCA-01", "COCA", "Rapport d'alerte", "Le rapport COCA (ou Red team) peut créer une urgence stratégique, annuler ou requalifier une tuile, justifier un renoncement assumé ou transmettre une alarme au Ministre ou au PR.",
  "4", D, "Statuts « urgence COCA », « renoncement assumé » et « alarme exécutif » sur les lignes ; repris dans le tableau de bord.", qui="CEMA")
c("COCA-02", "COCA", "Évaluation des scénarios", "Chaque scénario de crise est évalué Satisfaisant, Partiel ou Insuffisant, avec l'écart capacitaire et une recommandation (renforcement, alerte, renoncement assumé).",
  "3, 7", D, "Grille COCA saisie dans l'outil ; elle alimente l'indicateur de couverture des scénarios.")
c("COCA-03", "COCA", "Alliés défaillants", "Haute intensité Baltique : si les partenaires européens limitent leur participation, la France doit fournir jusqu'à 30 % de capacités supplémentaires.",
  "6", S, "Aléa de scénario : +30 % de besoin sur les capacités concernées, à confronter au modèle retenu.", params={"supplement": 0.3}, qui="Animateur")

for x in C:
    if x["role"] in ("DGRIS",) and not x["edition"].startswith("2027-2033"):
        x["edition"] = "2027-2033 (confirmée)"

# ---------------------------------------------------------------- Exigences politiques (ambition PR + MINARM)
EXIG = [
    ("PR-01", "Domaines essentiels", "Munitions", "PR p3 ; MINARM p4"),
    ("PR-02", "Domaines essentiels", "Capacités de commandement", "PR p3"),
    ("PR-03", "Domaines essentiels", "Soutiens logistiques", "PR p3"),
    ("PR-04", "Domaines essentiels", "Cyber", "PR p3"),
    ("PR-05", "Domaines essentiels", "Espace", "PR p3, p6 ; MINARM p4"),
    ("PR-06", "Domaines essentiels", "Communications", "PR p3"),
    ("PR-07", "Domaines essentiels", "Guerre électronique", "PR p3"),
    ("PR-08", "Domaines essentiels", "Défense aérienne", "PR p3, p6"),
    ("PR-09", "Domaines essentiels", "Réserves", "PR p3 ; MINARM p4"),
    ("PR-10", "Domaines essentiels", "Capacités de projection", "PR p3"),
    ("PR-11", "Terre", "Déployer une division complète (nation-cadre)", "PR p4"),
    ("PR-12", "Terre", "Division de réserve, volume des réserves, SMV renforcé", "PR p4 ; MINARM p4"),
    ("PR-13", "Terre", "Lutte anti-drone, robotisation, logistique haute intensité, survivabilité", "PR p4"),
    ("PR-14", "Marine", "PANG « France Libre » à l'eau à l'horizon 2036 (ports, groupe aéronaval, escortes)", "PR p5 ; MINARM p4"),
    ("PR-15", "Marine", "Lutte anti-sous-marine, drones navals, défense aérienne navale, missiles longue portée, renseignement maritime", "PR p5"),
    ("PR-16", "Air", "Accélérer Rafale F5 puis F6, combat collaboratif, drones accompagnateurs", "PR p5 ; MINARM p4"),
    ("PR-17", "Air", "Renforcer la défense aérienne (balistique, hypersonique, drones, croisière)", "PR p6"),
    ("PR-18", "Flanc Est", "Présence crédible et soutien divisionnaire à l'Est (Roumanie, Pologne, pays baltes)", "PR p1 ; MINARM p4"),
    ("PR-19", "Flanc Est", "Transit des forces alliées par le territoire national (infrastructures, soutien nation hôte)", "PR p1, p7"),
    ("PR-20", "Industrie", "Économie de guerre : capacités de production, stocks, chaînes d'approvisionnement", "PR p2, p6 ; MINARM p4"),
    ("PR-21", "Europe", "Soutenir l'Europe de la Défense sans perte d'autonomie stratégique", "PR p3"),
    ("PR-22", "Dissuasion", "Crédibilité de la dissuasion nucléaire", "PR p3 ; MINARM p4"),
]

# ---------------------------------------------------------------- Tableau de bord
IND = [
    # id, famille, indicateur, définition / calcul, données, ventilation, visuel, public
    ("I-01", "Réponse aux besoins", "Taux de satisfaction en montant", "Somme retenue ÷ somme demandée (M€), sur la table 2032 puis sur 2027-2032.", "Lignes : montant demandé, statut", "Armée, rôle demandeur, année", "Barre horizontale par armée (demandé / retenu)", "CEMA, MINARM"),
    ("I-02", "Réponse aux besoins", "Taux de satisfaction en nombre", "Demandes retenues ÷ demandes déposées.", "Lignes, statut", "Armée, rôle", "Chiffre clé + barre", "CEMA"),
    ("I-03", "Réponse aux besoins", "Taux de P1 retenues", "Demandes P1 retenues ÷ demandes P1 (priorité du pôle). Indicateur phare : a-t-on tenu l'essentiel de chaque armée ?", "Priorité pôle, statut", "Armée", "Jauge par armée", "CEMA, armées"),
    ("I-04", "Réponse aux besoins", "Écart de priorité pôle / CEMA", "Nombre de lignes dont le CEMA a changé la priorité, et sens (relevée, abaissée).", "Priorité pôle, priorité CEMA", "Armée", "Tableau croisé P pôle × P CEMA", "CEMA, animateur"),
    ("I-05", "Réponse aux besoins", "Opérationnalité des capacités", "Part des capacités en face verte (100 %), moyenne pondérée du taux d'opérationnalité (50 à 100 %+).", "DORESE posées par capacité", "Armée, année", "Barre empilée verte / rouge", "CEMA, SC-Plans"),
    ("I-06", "Renoncements", "Liste et montant des renoncements", "Lignes renoncées, montant cumulé, motif, et renoncements « assumés » par la COCA.", "Statut, motif, statut COCA", "Armée, catégorie", "Tableau trié par montant", "MINARM, CEMA"),
    ("I-07", "Renoncements", "Différés et glissements", "Nombre de lignes différées et glissement moyen (année retenue − année demandée).", "Année demandée, année retenue", "Armée", "Frise des glissements", "CEMA"),
    ("I-08", "Renoncements", "Capacités retirées du socle", "Pions du socle renoncés, économie réelle après le délai de retrait de 2 à 3 ans.", "Retraits, année de décision", "Armée, année", "Courbe d'économie", "CEMA, MEFR"),
    ("I-09", "Politique", "Respect des contraintes politiques", "Lignes à drapeau tricolore tenues ÷ lignes à drapeau tricolore ; doit valoir 100 % (sinon alerte).", "Drapeau politique, statut", "Exigence, armée", "Chiffre clé vert / rouge", "MINARM"),
    ("I-10", "Politique", "Couverture des exigences présidentielles", "Pour chaque exigence (onglet « Exigences politiques ») : couverte, partielle ou non couverte, selon les lignes retenues qui portent son étiquette.", "Étiquettes d'exigence sur les lignes", "Exigence", "Grille à pastilles", "MINARM, PR"),
    ("I-11", "Politique", "Projets politico-diplomatiques", "Options DGRIS et MEAE arbitrées favorablement, différées ou abandonnées (nombre et montant).", "Rôle demandeur, statut", "Rôle, théâtre", "Barre empilée", "MINARM, DGRIS, MEAE"),
    ("I-12", "Politique", "Engagements internationaux tenus", "Engagements contractés respectés (ex. 21 Eurodrones, part française des programmes communs).", "Lignes à étiquette « engagement »", "Partenaire", "Liste à pastilles", "MEAE, DGRIS"),
    ("I-13", "Budget", "Consommation du plafond", "Total retenu ÷ plafond, par année ; marge ou dépassement ; ligne de flottaison.", "Lignes retenues, plafonds", "Année", "Barres empilées par armée + ligne de plafond", "Tous"),
    ("I-14", "Budget", "Part de la table par armée", "Part de chaque armée avant et après arbitrage.", "Lignes, armée imputée", "Armée, année", "Barres 100 %", "CEMA, MINARM"),
    ("I-15", "Budget", "Surcoûts subis", "Surcoûts automatiques posés : carburants, inflation, OPEX, défection alliée, doublement haute intensité.", "Aléas déclenchés", "Type, année", "Cascade (waterfall)", "MEFR, animateur"),
    ("I-16", "Budget", "Financement hors LPM", "Montants mutualisés (part alliée), subventionnés, prêtés (et remboursements à venir).", "Mode de financement", "Mode, partenaire", "Barre empilée", "MEFR, DGRIS"),
    ("I-17", "Budget", "Dépendance alliée", "Montant et nombre de capacités « dépendantes d'un allié » ; impact d'une défection.", "Lignes mutualisées", "Partenaire", "Liste + montant exposé", "DGRIS, CEMA"),
    ("I-18", "Contraintes", "Alertes actives", "Nombre d'alertes non résolues par type (cadence, MCA, délai, RH, munitions, infrastructure).", "Journal des contraintes", "Type, rôle", "Compteurs", "SC-Plans, CEMA"),
    ("I-19", "Contraintes", "Passages en force", "Lignes retenues malgré une alerte ou un avis DGA défavorable, avec la justification saisie.", "Journal des dérogations", "Rôle qui a levé", "Tableau", "MINARM, animateur"),
    ("I-20", "Contraintes", "Plafond RH", "DORESE RH posées par an face à la limite de 4 (hors réserve).", "DORESE RH, année", "Année, armée", "Barre avec seuil", "SGA"),
    ("I-21", "Cohérence", "Couverture des scénarios COCA", "Scénarios Satisfaisant / Partiel / Insuffisant et écarts identifiés.", "Grille COCA", "Scénario", "Grille à pastilles", "CEMA, COCA"),
    ("I-22", "Cohérence", "Contrats opérationnels", "Contrats 2027 tenus ou non avec le modèle retenu.", "Lien pions ↔ contrats", "Armée", "Grille", "CEMA"),
]

MODELE = [
    ("role_demandeur", "Rôle qui dépose la ligne", "Existe"),
    ("armee_imputee", "Armée qui assume le coût", "Existe"),
    ("code_catalogue", "Option du catalogue des rôles ou pion de la base", "Existe (catalogue branché)"),
    ("annee_demandee / annee_retenue", "Pour mesurer les glissements", "Année demandée existe ; année retenue à ajouter"),
    ("statut", "En attente, retenu, différé, renoncé", "Existe"),
    ("priorite_pole / priorite_cema", "P1 à P4, deux valeurs conservées", "En cours (lot de conception)"),
    ("contrainte_politique", "Drapeau tricolore, posé par MINARM ou l'animateur ; demandé par un pôle", "En cours (lot de conception)"),
    ("mode_financement", "National, mutualisé (partenaires, part française), subvention, prêt", "En cours (lot de conception)"),
    ("etiquettes_exigence", "Exigences présidentielles couvertes (PR-01 à PR-22)", "À ajouter"),
    ("motif_renoncement", "Texte court ; « assumé COCA » oui ou non", "À ajouter"),
    ("avis_dga", "Favorable, report, mutualisation, alternative, refus", "À ajouter"),
    ("quantite", "Nombre d'unités commandées (pour cadence et MCA)", "À ajouter"),
    ("liens", "Capacité ↔ munitions, ↔ infrastructure, ↔ quai, ↔ programme porteur", "À ajouter"),
    ("journal_contraintes", "Alertes levées, dérogations, qui et pourquoi", "À ajouter"),
    ("grille_coca", "Scénarios et évaluation S/P/I", "À ajouter"),
]

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "contraintes_roles.json"), "w", encoding="utf-8") as f:
    json.dump({"meta": {"titre": "Contraintes de jeu tirées des fiches de rôle (Strategikon)",
                        "application": "blocage | alerte | surcoût automatique | drapeau",
                        "nombre": len(C)},
               "contraintes": C,
               "exigences_politiques": [dict(id=a, domaine=b, exigence=c_, source=d) for a, b, c_, d in EXIG],
               "indicateurs": [dict(id=a, famille=b, indicateur=c_, calcul=d, donnees=e, ventilation=f_, visuel=g, public=h)
                               for a, b, c_, d, e, f_, g, h in IND],
               "modele_donnees": [dict(champ=a, role=b, etat=c_) for a, b, c_ in MODELE]},
              f, ensure_ascii=False, indent=1)

HEAD = [("id", "Code"), ("porteur", "Rôle"), ("theme", "Thème"), ("regle", "Règle"), ("source", "Fiche"),
        ("pages", "Pages"), ("application", "Application"), ("mise_en_oeuvre", "Comment l'outil l'applique"),
        ("declencheur", "Déclencheur"), ("cible", "Options visées"), ("parametres", "Paramètres"),
        ("donnees_necessaires", "Données nécessaires"), ("qui_peut_lever", "Qui peut lever"), ("edition", "Édition"),
        ("a_verifier", "À vérifier")]
with open(os.path.join(OUT, "contraintes_roles.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow([h for _, h in HEAD])
    for x in C:
        w.writerow([json.dumps(x[k], ensure_ascii=False) if k == "parametres" and x[k] else ("" if k == "parametres" else x[k]) for k, _ in HEAD])

wb = Workbook()
BOLD = Font(bold=True, color="FFFFFF"); FILL = PatternFill("solid", fgColor="1F3864")
WRAP = Alignment(wrap_text=True, vertical="top")
COUL = {B: "F8CBAD", A: "FFE699", S: "BDD7EE", D: "E2EFDA"}


def feuille(ws, titres, lignes, larg, nom, col_couleur=None):
    ws.append(titres)
    for l in lignes:
        ws.append(l)
    for i, cell in enumerate(ws[1], 1):
        cell.font = BOLD; cell.fill = FILL; cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = larg[i - 1]
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = WRAP
        if col_couleur is not None and row[col_couleur].value in COUL:
            row[col_couleur].fill = PatternFill("solid", fgColor=COUL[row[col_couleur].value])
    ws.freeze_panes = "B2"
    t = Table(displayName=nom, ref="A1:%s%d" % (get_column_letter(len(titres)), len(lignes) + 1))
    t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws.add_table(t)


ws = wb.active; ws.title = "Contraintes"
feuille(ws, [h for _, h in HEAD],
        [[json.dumps(x[k], ensure_ascii=False) if k == "parametres" and x[k] else ("" if k == "parametres" else x[k]) for k, _ in HEAD] for x in C],
        [10, 16, 18, 60, 22, 8, 14, 60, 22, 22, 30, 26, 18, 16, 30], "Contraintes", col_couleur=6)
cnt = Counter((x["porteur"], x["application"]) for x in C)
roles = list(OrderedDict.fromkeys(x["porteur"] for x in C))
feuille(wb.create_sheet("Par rôle"), ["Rôle", "Blocage", "Alerte", "Surcoût automatique", "Drapeau", "Total"],
        [[r, cnt[(r, B)], cnt[(r, A)], cnt[(r, S)], cnt[(r, D)], sum(cnt[(r, t)] for t in (B, A, S, D))] for r in roles],
        [28, 10, 10, 18, 10, 10], "ParRole")
feuille(wb.create_sheet("Tableau de bord"), ["Code", "Famille", "Indicateur", "Calcul", "Données", "Ventilation", "Visuel", "Public"],
        [list(i) for i in IND], [8, 18, 30, 60, 28, 20, 28, 18], "Indicateurs")
feuille(wb.create_sheet("Exigences politiques"), ["Code", "Domaine", "Exigence", "Source"], [list(e) for e in EXIG],
        [8, 20, 80, 26], "Exigences")
feuille(wb.create_sheet("Données à suivre"), ["Champ", "Rôle", "État dans l'outil"], [list(m) for m in MODELE],
        [28, 70, 32], "Modele")
ws = wb.create_sheet("Légende")
for r in [["Application", "Effet dans l'outil"],
          [B, "La saisie ou l'arbitrage est refusé tant que la règle n'est pas respectée (dérogation par le rôle indiqué)."],
          [A, "La ligne passe mais porte un avertissement visible, repris dans le tableau de bord."],
          [S, "L'outil calcule et pose lui-même un coût (ou une économie)."],
          [D, "Marque d'état ou de validation sur la ligne (avis, négociation, validation animateur)."]]:
    ws.append(r)
ws.column_dimensions["A"].width = 22; ws.column_dimensions["B"].width = 100
ws["A1"].font = Font(bold=True); ws["B1"].font = Font(bold=True)
wb.save(os.path.join(OUT, "contraintes_roles.xlsx"))
print(len(C), Counter(x["application"] for x in C), len(IND), len(EXIG))
for r in roles:
    print(r, sum(cnt[(r, t)] for t in (B, A, S, D)))
