# -*- coding: utf-8 -*-
# Catalogue des options de dépense tirées des fiches de rôle Strategikon.
# Aucun montant n'est inventé : chaque chiffre vient de la fiche citée.

F = {
    "DGRIS": "strat_role-dgris-fr (DGRIS 2027 x16.pdf)",
    "MEAE": "strat_role-meae-fr (MEAE 2027 x16.pdf)",
    "MEFR": "strat_role-mefr-fr (MEFR 2027 x14.pdf)",
    "SGA": "strat_role-sga-fr (SGA 2027 x16.pdf)",
    "DGA": "strat_role-dga-fr (DGA 2027 x28.pdf)",
    "EMAT": "strat_role-armee-de-terre-fr (Armée de Terre 2027 x28.pdf)",
    "EMAAE": "strat_role-armee-de-l-air-fr (Armée de l'Air 2027 x28.pdf)",
    "EMM": "strat_role-marine-fr (Marine Nationale 2027 x28.pdf)",
    "CEMA": "strat_role-cema-fr (CEMA 2027 x8.pdf)",
    "COCA": "strat_role-coca-fr (COCA 2027 x35.pdf)",
    "SC-Plans": "strat_role-sc-plans-fr (Sous-Chef Plan 2027 x50.pdf)",
    "MINARM": "strat_role-minarm-fr (MINARM 2027 x14.pdf)",
    "RED": "strat_role-red-team-fr (Red team 2027 x5.pdf)",
}
ENTITE = {
    "DGRIS": "DGRIS", "MEAE": "MEAE", "MEFR": "MEFR", "SGA": "SGA", "DGA": "DGA",
    "EMAT": "Armée de Terre", "EMAAE": "Armée de l'Air et de l'Espace", "EMM": "Marine nationale",
    "CEMA": "CEMA", "COCA": "COCA", "SC-Plans": "Sous-chef Plans", "MINARM": "MINARM",
}
ED_OK = "2027-2033 (confirmée)"
ED_2027 = "2027-2032 (en-tête de la fiche)"
ED_3540 = "À vérifier : passage rédigé pour 2035-2040"

O = []


def opt(code, role, nom, desc, *, groupe="", cat="", statut="chiffré", cmin=None, cmax=None,
        unite="", per="", etal="", ao=None, mco=None, rh=None, dnote="", delai="",
        cond="", part="", eff="", imput="", armee="Interarmées", typ="", pages="",
        ed=ED_2027, alerte=""):
    O.append(dict(code=code, groupe=groupe or code, role=role, entite=ENTITE[role], categorie=cat,
                  nom=nom, description=desc, statut_cout=statut, cout_min=cmin, cout_max=cmax,
                  unite=unite, periodicite=per, etalement=etal, dorese_ao=ao, dorese_mco=mco,
                  dorese_rh=rh, dorese_note=dnote, delai=delai, conditions=cond, partenaires=part,
                  effets=eff, imputation_source=imput, armee_suggeree=armee, type_pion=typ,
                  source_fiche=F[role], source_pages=pages, edition=ed, alerte=alerte))


# ---------------------------------------------------------------- DGRIS
COND_DGRIS = ("Initiative négociée ou instruite avec les joueurs responsables, puis soumise aux "
              "facilitateurs si elle suppose une décision extérieure au ministère (p7). Une capacité "
              "multinationale n'est acquise qu'avec des partenaires identifiés et un engagement plausible (p2).")
DGRIS_E = dict(ed=ED_OK)
opt("DGRIS-BFA2", "DGRIS", "Seconde brigade franco-allemande",
    "Brigade binationale (mixte) à 50 % française.", groupe="BRIG-FRA-ALL", cat="Partenariat européen",
    statut="à définir", unite="M€/an", per="annuel", cond=COND_DGRIS + " Part française à expliciter (p3).",
    part="Allemagne", eff="Renforcement bilatéral structurant (p6) ; renforcement bilatéral symbolique (p8).",
    armee="Terre", pages="6, 8", **DGRIS_E)
opt("DGRIS-BEM", "DGRIS", "Brigade européenne multinationale",
    "Brigade composée de 3 à 5 partenaires, part française de 25 à 40 %.", groupe="BRIG-EUR",
    cat="Partenariat européen", statut="à définir", unite="M€/an", per="annuel",
    cond=COND_DGRIS + " Part française et carences alliées à expliciter (p3).",
    part="3 à 5 partenaires européens", eff="Symbole / vecteur d'Europe de la Défense.", armee="Terre",
    pages="6, 8", **DGRIS_E)
opt("DGRIS-ROU", "DGRIS", "Renforcement Roumanie (forces prépositionnées)",
    "Forces prépositionnées aériennes, terrestres et navales en Roumanie.", groupe="EST-ROU",
    cat="Présence avancée (flanc Est)", cmin=200, cmax=200, unite="M€/an", per="annuel", cond=COND_DGRIS,
    part="Roumanie (pays hôte), OTAN",
    eff="Forte visibilité, forte présence, crédibilité OTAN. Risque : perçu comme belliqueux.",
    pages="6, 8", alerte="Même option sous deux intitulés (p6 « forces prépositionnées », p8 « renforcement ») : ne la poser qu'une fois.",
    **DGRIS_E)
opt("DGRIS-POL-PREPO", "DGRIS", "Forces prépositionnées en Pologne",
    "Forces prépositionnées aériennes et terrestres uniquement.", groupe="EST-POL-PREPO",
    cat="Présence avancée (flanc Est)", cmin=100, cmax=100, unite="M€/an", per="annuel", cond=COND_DGRIS,
    part="Pologne (pays hôte)", eff="Gain diplomatique ; tensions avec la Russie.", pages="6", **DGRIS_E,
    alerte="Recouvre peut-être le hub divisionnaire Pologne (p8) : à trancher par l'animateur.")
opt("DGRIS-POL-HUB", "DGRIS", "Hub divisionnaire Pologne",
    "Forces terrestres et aériennes : soutien d'une division française ou alliée, stockage, accès aux "
    "réseaux de transport, coordination avec le pays hôte, protection des infrastructures (p3).",
    groupe="EST-POL-HUB", cat="Présence avancée (flanc Est)", statut="fourchette", cmin=150, cmax=300,
    unite="M€/an", per="annuel",
    cond=COND_DGRIS + " La DGRIS propose le cadre de coopération ; le CEMA et les armées définissent le besoin ; "
    "le SGA précise infrastructures et soutien. Acceptabilité politique à apprécier (p3).",
    part="Pologne (pays hôte)", eff="Soutien du flanc Est.", armee="Terre", pages="3, 8", **DGRIS_E,
    alerte="Le MEFR et le SGA le chiffrent à 300 M€/an : retenir une valeur commune.")
opt("DGRIS-POL-LOG", "DGRIS", "Hub logistique Pologne", "Hub logistique en soutien divisionnaire.",
    groupe="EST-POL-LOG", cat="Présence avancée (flanc Est)", cmin=250, cmax=250, unite="M€",
    per="non précisée", cond=COND_DGRIS, part="Pologne", eff="Soutien divisionnaire.", armee="Terre",
    pages="8", **DGRIS_E,
    alerte="Périodicité non dite (colonne « coût estimé »). 250 M€ n'est pas un multiple de la case de 100 M€.")
opt("DGRIS-BAL", "DGRIS", "Base Baltique", "Base dans les États baltes.", groupe="EST-BAL",
    cat="Présence avancée (flanc Est)", cmin=150, cmax=150, unite="M€", per="non précisée", cond=COND_DGRIS,
    part="États baltes", eff="Présence avancée.", pages="8", **DGRIS_E,
    alerte="Périodicité non dite ; le MEFR chiffre un « pré-positionnement Baltique » à 150 M€/an. 150 M€ n'est pas un multiple de la case.")
opt("DGRIS-DJI", "DGRIS", "Renforcement Djibouti", "Renforcement du point d'appui de Djibouti.",
    groupe="MONDE-DJI", cat="Présence mondiale", cmin=100, cmax=100, unite="M€", per="non précisée",
    cond=COND_DGRIS, part="Djibouti", eff="Afrique / mer Rouge (Bab el-Mandeb).", pages="4, 8", **DGRIS_E,
    alerte="Périodicité non dite.")
opt("DGRIS-IPAC", "DGRIS", "Renforcement Indo-Pacifique", "Renforcement de la présence en Indo-Pacifique.",
    groupe="MONDE-IPAC", cat="Présence mondiale", cmin=200, cmax=200, unite="M€", per="non précisée",
    cond=COND_DGRIS, eff="Présence mondiale.", pages="8", **DGRIS_E, alerte="Périodicité non dite.")
for c, n, d, p, g, a in [
    ("SCAF", "Soutien au SCAF / Rafale F6", "Aviation de combat du futur.", "France, Allemagne, Espagne", "PROG-SCAF", "Air et Espace"),
    ("MALE", "Soutien au programme MALE (Eurodrone)", "Drone MALE européen.", "France, Allemagne, Italie, Espagne", "PROG-MALE", "Air et Espace"),
    ("MGCS", "Soutien au MGCS", "Char de combat du futur.", "France, Allemagne", "PROG-MGCS", "Terre"),
    ("CIFS", "Soutien au CIFS", "Artillerie du futur.", "France, Allemagne et partenaires", "PROG-CIFS", "Terre"),
]:
    opt("DGRIS-PROG-" + c, "DGRIS", n, d + " Programme européen à soutenir ; symbole politique autant que capacité.",
        groupe=g, cat="Programme européen à soutenir", statut="à définir", unite="M€/an", per="annuel",
        cond="La DGRIS favorise l'adoption et la visibilité ; la conduite du programme et les prix relèvent de la DGA (p5, p7).",
        part=p, eff="Orientation européenne de la France.", armee=a, pages="6", **DGRIS_E,
        alerte="Coût « à définir » côté DGRIS ; voir les fiches programme DGA pour les montants.")
for c, n, d, e, g in [
    ("INFL-EURODRONE", "Influence industrielle : commande d'Eurodrone", "Soutenir la commande française d'Eurodrone malgré l'existence d'une alternative nationale.", "Image de partenaire fiable, soutien industriel européen.", "PROG-MALE"),
    ("SIGNAL-PA2", "Signal diplomatique fort : 2e porte-avions", "Acquisition d'un 2e porte-avions, avec justification de projection.", "Renforcement des alliances indo-pacifiques.", "PA2"),
    ("SAHEL", "Stabilisation régionale : mission hybride au Sahel", "Lancement d'une mission hybride (armée + humanitaire) au Sahel.", "Prévention de crise, réduction des critiques internationales.", "SAHEL"),
    ("CONTRE-INFL", "Contre-influence : projet européen contre équipement américain", "Opposer un projet européen à un équipement américain (ex. P-8 contre MAWS).", "Affirmation de souveraineté stratégique.", "MAWS"),
]:
    opt("DGRIS-ACT-" + c, "DGRIS", n, d, groupe=g, cat="Action diplomatique", statut="non chiffré",
        cond=COND_DGRIS, eff=e, pages="8", **DGRIS_E,
        alerte="Non chiffré dans la fiche ; le coût vient de l'équipement concerné (voir DGA) ou de l'arbitrage animateur.")

# ---------------------------------------------------------------- MEAE (mêmes tableaux que DGRIS)
COND_MEAE = "Proposition à coordonner avec CEMA, MINARM, SGA, DGA, MEFR (valide les coûts) et les armées (p5)."
for c, src in [("BFA2", "DGRIS-BFA2"), ("BEM", "DGRIS-BEM"), ("ROU", "DGRIS-ROU"), ("POL-PREPO", "DGRIS-POL-PREPO"),
               ("POL-HUB", "DGRIS-POL-HUB"), ("POL-LOG", "DGRIS-POL-LOG"), ("BAL", "DGRIS-BAL"),
               ("DJI", "DGRIS-DJI"), ("IPAC", "DGRIS-IPAC"), ("PROG-SCAF", "DGRIS-PROG-SCAF"),
               ("PROG-MALE", "DGRIS-PROG-MALE"), ("PROG-MGCS", "DGRIS-PROG-MGCS"), ("PROG-CIFS", "DGRIS-PROG-CIFS"),
               ("ACT-INFL-EURODRONE", "DGRIS-ACT-INFL-EURODRONE"), ("ACT-SIGNAL-PA2", "DGRIS-ACT-SIGNAL-PA2"),
               ("ACT-SAHEL", "DGRIS-ACT-SAHEL"), ("ACT-CONTRE-INFL", "DGRIS-ACT-CONTRE-INFL")]:
    b = dict(next(x for x in O if x["code"] == src))
    pg = {"ROU": "4, 6", "POL-PREPO": "4", "BFA2": "4, 6", "BEM": "4, 6"}.get(c, "4" if c.startswith("PROG") else "6")
    b.update(code="MEAE-" + c, role="MEAE", entite="MEAE", source_fiche=F["MEAE"], source_pages=pg,
             conditions=COND_MEAE, edition="2027-2033 (texte de la fiche)")
    if c == "POL-HUB":
        b["description"] = "Forces terrestres et aériennes."
    O.append(b)
for c, n, d in [
    ("LEV-INDUS", "Coopérations industrielles", "Programmes européens, développements communs, partage de capacités, achats conjoints."),
    ("LEV-MIL", "Coopérations militaires", "Prépositionnements, forces multinationales, états-majors conjoints, exercices communs."),
    ("LEV-STRAT", "Coopérations stratégiques", "Accords de défense, soutien nation hôte, accords de transit, bases permanentes, accords d'accès aux infrastructures."),
]:
    opt("MEAE-" + c, "MEAE", n, d, cat="Levier diplomatique", statut="non chiffré", cond=COND_MEAE,
        pages="4, 5", ed="2027-2033 (texte de la fiche)",
        alerte="Levier sans coût dans la fiche : à chiffrer avec le MEFR ou l'animateur.")

# ---------------------------------------------------------------- MEFR
COND_MEFR = "Présenté comme un surcoût à provisionner dès la planification initiale (p4)."
for c, n, v, g, a, al in [
    ("ROU", "Renforcement Roumanie", 200, "EST-ROU", "Interarmées", ""),
    ("POL-HUB", "Hub divisionnaire Pologne", 300, "EST-POL-HUB", "Terre", "DGRIS et MEAE donnent 150 à 300 M€/an."),
    ("BAL", "Pré-positionnement Baltique", 150, "EST-BAL", "Interarmées", "150 M€ n'est pas un multiple de la case de 100 M€."),
    ("LOG-EST", "Renforcement logistique Est", 100, "EST-LOG", "Interarmées", ""),
    ("HNS", "Soutien nation hôte OTAN (HNS)", 150, "EST-HNS", "Interarmées", "150 M€ n'est pas un multiple de la case de 100 M€."),
]:
    opt("MEFR-" + c, "MEFR", n, "Présence avancée et soutien du flanc Est.", groupe=g,
        cat="Présence avancée (flanc Est)", cmin=v, cmax=v, unite="M€/an", per="annuel", cond=COND_MEFR,
        armee=a, pages="4", alerte=al)
opt("MEFR-DIV-RES", "MEFR", "Division de réserve", "Financement de la résilience nationale.", groupe="RES-DIV",
    cat="Résilience nationale", cmin=1000, cmax=1000, unite="M€/an (impact annuel moyen)", per="annuel",
    pages="4", alerte="Le SGA chiffre la division de réserve nationale à 2 à 3 Md€/an : écart à arbitrer.")
opt("MEFR-SMV-R", "MEFR", "SMV renforcé", "Service militaire volontaire renforcé.", groupe="SMV-R",
    cat="Résilience nationale", cmin=1700, cmax=1700, unite="M€/an", per="annuel", pages="4",
    alerte="Le plateau porte déjà un pion orange « SMV 2,5 Md€ » : préciser s'il s'ajoute ou le remplace.")
opt("MEFR-SMV-E", "MEFR", "SMV élargi", "Service militaire volontaire élargi.", groupe="SMV-E",
    cat="Résilience nationale", cmin=5000, cmax=5000, unite="M€/an", per="annuel", pages="4")
opt("MEFR-SN", "MEFR", "Service national ambitieux", "Service national de grande ampleur.", groupe="SMV-HI",
    cat="Résilience nationale", statut="fourchette", cmin=7000, cmax=10000, unite="M€/an", per="annuel", pages="4")
opt("MEFR-CARBU", "MEFR", "Provision surcoût carburants",
    "Surcoût carburants à provisionner selon trois scénarios. Optimiste : 100, 150, 200, 250, 300, 400 M€ ; "
    "référence : 250, 300, 350, 400, 500, 700 M€ ; pessimiste : 500, 650, 700, 800, 900, 1 300 M€ (2027 à 2032).",
    groupe="CARBU", cat="Provision / aléa", statut="fourchette", cmin=100, cmax=1300, unite="M€/an (selon année et scénario)",
    per="annuel, variable par année", cond="Ignorer ces surcoûts entraîne des gels ou coupes tardives (p5).",
    typ="Orange (scénario / aléa) [suggestion]", pages="4, 5")
opt("MEFR-OPEX50", "MEFR", "Lever la clause de solidarité OPEX",
    "Partager jusqu'à 50 % du coût des opérations extérieures avec d'autres budgets.", groupe="OPEX",
    cat="Levier budgétaire", statut="non chiffré",
    eff="Allège le pion gris « Surcoût OPEX » (900 M€) jusqu'à 50 %.",
    cond="Contrepartie : effort renforcé exigé sur les postes classiques (p6).", pages="6",
    alerte="Effet à paramétrer par l'animateur (montant non donné par la fiche).")
opt("MEFR-UE", "MEFR", "Financements européens / mutualisation",
    "Réduire la charge pesant sur la LPM par des financements européens ou une mutualisation.", groupe="UE-FIN",
    cat="Levier budgétaire", statut="non chiffré", eff="Réduction partielle du coût supporté par la LPM française.",
    cond="Avec la DGA (faisabilité industrielle), le MEAE (cohérence européenne), le MINARM (cohérence politique), puis validation des facilitateurs (p6).",
    pages="6")
opt("MEFR-DUAL", "MEFR", "Investissements duaux civil-militaire",
    "Partage de charge avec d'autres ministères : cyberdéfense, programme spatial ARGONAUTE.", groupe="DUAL",
    cat="Levier budgétaire", statut="non chiffré", eff="Partage des coûts entre ministères.", pages="3, 6")
opt("MEFR-RESERVE", "MEFR", "Clause de révision budgétaire ou réserve stratégique",
    "Le MEFR peut imposer une clause de révision budgétaire ou une réserve stratégique.", groupe="RESERVE-STRAT",
    cat="Levier budgétaire", statut="non chiffré", pages="6")

# ---------------------------------------------------------------- SGA
opt("SGA-JEUNESSE", "SGA", "Dispositifs jeunesse (lien armée-nation)",
    "SNU, classes Défense, cadets, stages.", cat="Dépense protégée", cmin=400, cmax=400, unite="M€/an",
    per="annuel", cond="Ligne qui ne peut être coupée sans conséquences politiques majeures (p4).",
    typ="Gris (dépense fixe) [suggestion]", pages="3, 4")
opt("SGA-PLAN-FAMILLE", "SGA", "Plan Famille",
    "Logement militaire rénové, soutien aux conjoints et à l'emploi local, places en crèche et aide familiale.",
    cat="Fidélisation", cmin=800, cmax=800, unite="M€ sur la LPM", per="pluriannuel",
    etal="Au moins 100 M€ par an dès le lancement", eff="Moral des troupes et fidélisation.", pages="4")
opt("SGA-DD-AMB", "SGA", "Développement durable : politique ambitieuse",
    "Transition écologique complète, rénovation large des infrastructures.", groupe="DD", cat="Infrastructures",
    cmin=900, cmax=900, unite="M€ sur la LPM", per="pluriannuel", etal="Non précisé", pages="4")
opt("SGA-DD-LIM", "SGA", "Développement durable : politique limitée",
    "Rénovation partielle, actions ciblées sur les sites les plus énergivores.", groupe="DD", cat="Infrastructures",
    cmin=600, cmax=600, unite="M€ sur la LPM", per="pluriannuel", etal="Non précisé", pages="4")
opt("SGA-ENERGIE", "SGA", "Investissement énergie (économie de carburant)",
    "Investissement spécifique de 100 M€/an pendant 2 ans.", cat="Infrastructures", cmin=100, cmax=100,
    unite="M€/an", per="annuel", etal="2 ans", eff="Réduit de 200 M€/an les coûts de carburants après la 2e année.",
    cond="À coordonner avec le Service de l'énergie opérationnelle, incarné par le CEMA (p4).", pages="4")
opt("SGA-LOG-PROJ", "SGA", "Logistique projetable (soutien humain et technique)",
    "Hôpitaux de campagne, cantonnement temporaire, ateliers MCO projetables, équipes de maintenance, approvisionnements déployés.",
    cat="Soutien", statut="non chiffré", cond="À budgétiser avec les capacités de projection des armées (p4).", pages="4")
opt("SGA-RH-PLUS", "SGA", "Dépasser le plafond de recrutement",
    "Campagnes nationales de recrutement, robotique administrative ou de soutien, revalorisation des filières.",
    cat="Ressources humaines", statut="non chiffré",
    cond="Chaque effort doit être chiffré, financé et discuté avec MEFR, MINARM et CEMA (p5).",
    eff="Permet de dépasser la limite de 4 pions « masse salariale » par an.", pages="3, 5")
for c, n, a, b, u, g, arm, al in [
    ("POL-HUB", "Hub divisionnaire Pologne", 300, 300, "M€/an", "EST-POL-HUB", "Terre", "DGRIS et MEAE donnent 150 à 300 M€/an."),
    ("ROU", "Renforcement Roumanie (infrastructures)", 200, 200, "M€/an", "EST-ROU", "Interarmées", ""),
    ("PORTS", "Adaptation des ports militaires", 100, 300, "M€", "PORTS", "Marine", "Périodicité non dite."),
    ("INFRA-PANG", "Infrastructures PANG France Libre", 500, 1000, "M€", "PANG-INFRA", "Marine", "Périodicité non dite. Recoupe peut-être les quais DGA."),
    ("DIRISI", "Renforcement DIRISI", 100, 200, "M€", "DIRISI", "Interarmées", "Périodicité non dite."),
    ("DEPOTS", "Dépôts de munitions renforcés", 100, 300, "M€", "DEPOTS-MUN", "Interarmées", "Périodicité non dite."),
]:
    opt("SGA-" + c, "SGA", n, "Soutien du flanc Est et infrastructures (coût estimatif).", groupe=g,
        cat="Infrastructures" if c in ("PORTS", "INFRA-PANG", "DIRISI", "DEPOTS") else "Présence avancée (flanc Est)",
        statut="chiffré" if a == b else "fourchette", cmin=a, cmax=b, unite=u,
        per="annuel" if u.endswith("/an") else "non précisée", armee=arm, pages="6", alerte=al)
opt("SGA-SMV-R", "SGA", "SMV renforcé",
    "Environ 3 000 à 50 000 volontaires/an (6-9 mois), 12-15 centres + antennes ; 55-70 k€ par volontaire.",
    groupe="SMV-R", cat="Résilience nationale", cmin=1700, cmax=1700, unite="M€/an", per="annuel", pages="6, 7")
opt("SGA-SMV-E", "SGA", "SMV élargi",
    "Environ 60 000 à 80 000 jeunes/an (9-12 mois), 20-25 centres ; 60-80 k€ par volontaire.",
    groupe="SMV-E", cat="Résilience nationale", cmin=5000, cmax=5000, unite="M€/an", per="annuel", pages="6, 7")
opt("SGA-SMV-HI", "SGA", "Service national de haute intensité",
    "Environ 150 000 à 200 000 jeunes/an (9-12 mois), 30-40 centres ; 50-65 k€ par volontaire ; contraintes de pic logistique.",
    groupe="SMV-HI", cat="Résilience nationale", statut="fourchette", cmin=7000, cmax=10000, unite="M€/an",
    per="annuel", pages="7")
COND_RES = "Programme stratégique national non soumis à la limite de 4 pions « masse salariale » par an (p7)."
for c, n, d, a, b, g in [
    ("RES-RENF", "Renforcement de la réserve existante", "Augmentation des effectifs et de l'activité des réservistes.", 500, 500, "RES-RENF"),
    ("RES-BRIG", "Brigade de réserve opérationnelle", "Brigade complète dotée de ses moyens de soutien.", 1000, 1500, "RES-BRIG"),
    ("RES-DIV", "Division de réserve nationale", "Division complète capable de générer plusieurs brigades.", 2000, 3000, "RES-DIV"),
    ("RES-DIV-EU", "Division de réserve renforcée à vocation européenne", "Division de réserve intégrée aux plans OTAN et UE.", 3000, 4000, "RES-DIV-EU"),
]:
    opt("SGA-" + c, "SGA", n, d, groupe=g, cat="Réserves", statut="chiffré" if a == b else "fourchette",
        cmin=a, cmax=b, unite="M€/an", per="annuel", cond=COND_RES, armee="Terre", pages="7, 8",
        alerte="Le MEFR chiffre la division de réserve à 1 Md€/an." if c == "RES-DIV" else "")

# ---------------------------------------------------------------- DGA
ED_DGA_27 = "2027-2032 (en-tête de la fiche)"
opt("DGA-SAMPT", "DGA", "Système sol-air SAMP/T NG (brigade sol-air)",
    "1 pion principal = 1 radar + 1 C2 + 3 lanceurs ; dotation minimale de 33 missiles ASTER pour la brigade. "
    "Format brigade complet = ce pion + 1 DORESE MCO. MCO ~40 M€/an ; RH opérateurs optionnel ~20-30 M€/an si doctrine complète ; "
    "recomplètement munitions à estimer selon l'usage.",
    groupe="SAMPT", cat="Capacité", cmin=400, cmax=400, unite="M€ (investissement initial)", per="ponctuel",
    mco=1, dnote="1 MCO obligatoire ; 1 RH optionnel si doctrine complète.",
    cond="Limite industrielle : 1 brigade sol-air tous les 2 ans au maximum. Pas de montée en puissance sans effort RH et doctrine (SGA/DGA).",
    eff="Défense sol-air moyenne à longue portée : protection d'un groupe aéronaval, d'une base aérienne ou d'un bataillon terrestre. Exportation possible pour amortissement (avec MEAE).",
    armee="Air et Espace", typ="Capacité", pages="4, 7", ed=ED_DGA_27)
opt("DGA-SEAD", "DGA", "Escadron SEAD Rafale F5",
    "1 pion principal 300 M€ (12 avions + pods) + 1 pion munitions 100 M€ (AARGM ou équivalent), soit ~400 M€. "
    "Détail : escadron 240 M€, pods EW 50-80 M€, stock initial 40-50 missiles 100 M€, cellule doctrine 10-20 M€. "
    "Exploitation : MCO ~40 M€/an, entraînement ~20-30 M€/an, doctrine ~10-20 M€/an.",
    groupe="SEAD", cat="Capacité", cmin=400, cmax=400, unite="M€ (investissement, 2 pions)", per="ponctuel",
    mco=1, rh=2, dnote="1 MCO + 1 RH (entraînement) + 1 RH (doctrine).", delai="3 ans minimum",
    cond="Formation pilote SEAD ; coordination Marine (si SCAF embarqué) et Terre (ouverture de théâtre).",
    eff="Ouvre un théâtre contesté ; multiplicateur des frappes air-sol.", armee="Air et Espace",
    typ="Capacité", pages="8", ed=ED_DGA_27)
for c, n, a, b, d, dl in [
    ("IA-TAC", "IA embarquée tactique (drone, robot)", 100, 100, "Logique embarquée + liaison plateforme (80-100 M€).", ""),
    ("IA-C2", "IA C2 interarmées / aide à la décision", 300, 300, "Fusion de données, tempo de décision (250-300 M€).", "+1 RH ou MCO au choix (interarmées)."),
    ("IA-PROJ", "IA système projetable (Marine, cyber)", 300, 400, "Guerre sonar, ASM, cybersécurité avancée (400 M€ max).", "+1 RH ou MCO au choix (projetée)."),
]:
    opt("DGA-" + c, "DGA", n, d + " Exploitation : MCO logiciel 20-50 M€/an, entraînement ~20 M€/an, cellule doctrine ~10 M€/an.",
        groupe="IA", cat="Investissement / innovation", statut="chiffré" if a == b else "fourchette", cmin=a, cmax=b,
        unite="M€ (investissement)", per="ponctuel", mco=1, rh=1, dnote="1 MCO + 1 RH. " + dl,
        delai="3 à 4 ans (2 ans démonstrateur, 1 an intégration, 1 an doctrine)", typ="Violet (indiqué par la fiche)",
        eff="Réactivité en combat dénié, latence décisionnelle réduite.", pages="9", ed=ED_DGA_27)
opt("DGA-LAD-PORT", "DGA", "Anti-drones : système portable (jammer)",
    "Protection ponctuelle (forces spéciales, infanterie, convois). Aucun pion : effet narratif.", groupe="LAD",
    cat="Capacité", cmin=10, cmax=20, statut="fourchette", unite="M€/an (exploitation)", per="annuel",
    delai="Immédiat à 1 an", typ="Aucun pion (indiqué par la fiche)", pages="10", ed=ED_DGA_27,
    alerte="Sous le seuil de 100 M€ : à rattacher à un programme existant.")
opt("DGA-LAD-INT", "DGA", "Anti-drones : système intégré (véhicule, tourelle)",
    "Effet sol-air tactique anti-UAV, protection de QG ou PHA. Pion violet 100 M€ ; exploitation 100 M€/an.",
    groupe="LAD", cat="Capacité", cmin=100, cmax=100, unite="M€ (investissement) + 100 M€/an d'exploitation",
    per="ponctuel + annuel", delai="2 ans", typ="Violet (indiqué par la fiche)", pages="10", ed=ED_DGA_27)
opt("DGA-LAD-LOURD", "DGA", "Anti-drones : système lourd (base fixe, PA, SAMP/T)",
    "Défense multi-dôme intégrée aux radars, IA, C2. Pion violet 200-300 M€ ; exploitation 300 M€/an.",
    groupe="LAD", cat="Capacité", statut="fourchette", cmin=200, cmax=300,
    unite="M€ (investissement) + 300 M€/an d'exploitation", per="ponctuel + annuel", delai="3 à 4 ans",
    typ="Violet (indiqué par la fiche)", pages="10", ed=ED_DGA_27)
COND_MUN = "La DGA peut refuser des plans non alignés sur les cadences industrielles. Objectif : 30 jours de combat, recomplètement en 4 à 6 semaines (p6, p11)."
opt("DGA-STOCK-ART", "DGA", "Stock 30 jours artillerie (division)", "1 pion obus (logistique).", groupe="MUN",
    cat="Munitions", cmin=100, cmax=100, unite="M€/an", per="annuel", delai="1 an (stockage passif)", cond=COND_MUN,
    armee="Terre", typ="Infrastructure (indiqué par la fiche)", pages="11", ed=ED_DGA_27)
opt("DGA-STOCK-AIR", "DGA", "Stock de missiles air-sol (SCALP / MICA)", "1 pion munitions tactiques.", groupe="MUN",
    cat="Munitions", cmin=100, cmax=100, unite="M€/an", per="annuel", delai="1 an (stockage passif)", cond=COND_MUN,
    armee="Air et Espace", typ="Infrastructure (indiqué par la fiche)", pages="11", ed=ED_DGA_27)
opt("DGA-STOCK-MIXTE", "DGA", "Stock mixte recomplètement + prépositionnement", "1 pion + liaison logistique (SGA).",
    groupe="MUN", cat="Munitions", cmin=200, cmax=200, unite="M€/an", per="annuel", cond=COND_MUN + " Liaison logistique avec le SGA.",
    typ="Infrastructure (indiqué par la fiche)", pages="11", ed=ED_DGA_27)
opt("DGA-MUN-ACHAT", "DGA", "Achat de munitions (au pion de 100 M€)",
    "Quantités pour 100 M€ données par la fiche : voir l'onglet « Munitions ».", groupe="MUN", cat="Munitions",
    cmin=100, cmax=100, unite="M€ par pion", per="ponctuel", cond=COND_MUN, pages="4, 5, 6", ed=ED_DGA_27)
opt("DGA-EURODRONE", "DGA", "Eurodrone (3 drones + soutien)",
    "1 pion capacité = 3 Eurodrones + soutien. Unité : 50-60 M€ (ISR), 60-80 M€ (armé).", groupe="PROG-MALE",
    cat="Capacité", statut="fourchette", cmin=180, cmax=200, unite="M€ par pion", per="ponctuel",
    mco=1, rh=1, delai="3 ans après commande ; capacité ISR partielle dès 2 drones",
    cond="Engagement français : 21 drones sur 63. Commande minimale annuelle : 2.",
    part="Allemagne, Espagne, Italie", armee="Air et Espace", typ="Capacité", pages="3, 12", ed=ED_DGA_27,
    alerte="180-200 M€ : arrondir à 2 cases (200 M€) sur le plateau ?")
opt("DGA-LW", "DGA", "Loyal Wingmen (drones ailiers)",
    "Par tranche de 100 M€ : 3-4 drones d'attaque (40-50 M€) ou 4-6 drones EW/polyvalents (25-35 M€). "
    "Paquet complet conseillé : 600-800 M€ sur la période.", groupe="LW", cat="Capacité", statut="fourchette",
    cmin=600, cmax=800, unite="M€ sur la période", per="pluriannuel", etal="Peut être étalé", mco=1,
    dnote="1 MCO si stockage et déploiement en escadron ; pas de RH si connectés au cloud de combat SCAF.",
    cond="1/3 à 1/2 des NGF déployés accompagnés. Commande minimale annuelle : 4.", armee="Air et Espace",
    pages="4, 14", ed=ED_3540, alerte="Raisonne en « NGF » (SCAF) : vérifier la cohérence avec un SCAF retardé en 2027-2033.")
opt("DGA-MGCS-ESC", "DGA", "Escadron MGCS (12 chars + soutien)", "1 pion MGCS opérationnel.", groupe="PROG-MGCS",
    cat="Capacité", cmin=400, cmax=400, unite="M€ par pion", per="ponctuel", mco=1, rh=1,
    delai="Arrive 1 an après la mise en production (production à partir de 2029)",
    cond="Cadence : 36 à 120 chars/an. Commande minimale annuelle : 20. Coût mutualisable avec l'Allemagne (bonus MEAE ou diplomatique possible).",
    part="Allemagne", armee="Terre", typ="Capacité", pages="4, 15", ed=ED_DGA_27,
    alerte="Cible « 100 pour 2035, 200 d'ici 2045 » : calendrier à confronter à 2027-2033.")
opt("DGA-MGCS-DRONES", "DGA", "Drones d'escorte MGCS (3-4 unités)", "Option IA de flanc / reconnaissance.",
    groupe="PROG-MGCS", cat="Capacité", cmin=100, cmax=100, unite="M€", per="ponctuel", armee="Terre", pages="15", ed=ED_DGA_27)
opt("DGA-TITAN", "DGA", "Brigade lourde TITAN (96 chars MGCS)",
    "Capacité de percée / confrontation directe. 3,2 Md€ d'achat + 400 M€ d'exploitation par an (RH + MCO).",
    groupe="TITAN", cat="Capacité", cmin=3200, cmax=3200, unite="M€ (achat) + 400 M€/an d'exploitation",
    per="ponctuel + annuel", armee="Terre", pages="15", ed=ED_DGA_27,
    alerte="La fiche Terre vise 1 à 2 brigades Titan d'ici 2040.")
opt("DGA-CIFS-BAT", "DGA", "Batterie CIFS (8-10 pièces + véhicules)", "1 pion tactique ; 1 pièce = 8-10 M€.",
    groupe="PROG-CIFS", cat="Capacité", cmin=100, cmax=100, unite="M€ par pion", per="ponctuel",
    cond="Commande minimale annuelle : 10. Cible : 10-15 pièces d'ici 2032, 50 d'ici 2045 ; première mise en service vers 2035.",
    part="Allemagne", armee="Terre", typ="Capacité", pages="4, 17", ed=ED_DGA_27)
opt("DGA-CIFS-BRIG", "DGA", "Brigade CIFS (40-50 pièces)", "4 à 5 pions.", groupe="PROG-CIFS", cat="Capacité",
    statut="fourchette", cmin=400, cmax=500, unite="M€", per="ponctuel", part="Allemagne", armee="Terre",
    pages="17", ed=ED_DGA_27)
for c, n, d, mca, liv, arm in [
    ("VBCI-NG", "Successeur VBCI (20 véhicules)", "1 VBCI NG = 5 M€ ; 20 unités par pion.", 40, "Livraison initiale 2032 ou avant ; capacité complète 2038", "Terre"),
    ("VBAE", "VBAE (60 véhicules)", "1 VBAE = 1,6 M€ ; 60 unités par pion. Coopération Belgique.", 20, "Livraison initiale 2030 ; capacité complète 2038", "Terre"),
    ("TIGRE-SUCC", "Successeur Tigre (3 hélicoptères)", "1 hélicoptère d'attaque lourd = 33 M€ ; 3 unités par pion.", 10, "Livraison initiale 2030 ; capacité complète 2038", "Terre"),
    ("HIL", "HIL H160M Guépard (10 hélicoptères)", "1 hélicoptère léger = 10 M€ ; 10 unités par pion. Modèle interarmées Terre, Marine, Air.", 10, "Livraison initiale 2035 ; capacité complète 2038", "Interarmées"),
]:
    opt("DGA-" + c, "DGA", n, d, groupe=c, cat="Capacité", cmin=100, cmax=100, unite="M€ par pion", per="ponctuel",
        delai=liv, cond="Commande minimale annuelle : %d." % mca, armee=arm, typ="Capacité", pages="4, 18", ed=ED_DGA_27)
opt("DGA-CDG", "DGA", "Prolongation du Charles de Gaulle",
    "Maintien en service : permet deux porte-avions en 2037 (le CDG en fin de vie, le PANG en essais).", groupe="PA-CDG",
    cat="Programme naval", cmin=1000, cmax=1000, unite="M€", per="ponctuel / pluriannuel",
    etal="p5 : 1 Md€ en 2039, étalé sur 2 ans ; p13 : 1 Md€ unique (pion spécifique)",
    eff="Gain politique narratif fort (année présidentielle 2037).", armee="Marine", pages="5, 13", ed=ED_3540,
    alerte="Les deux pages se contredisent (étalé sur 2 ans / unique) ; dates 2038-2039 hors fenêtre 2027-2033.")
opt("DGA-QUAI-TEMP", "DGA", "Quai temporaire porte-avions", "Accueil d'un seul PA ou PHA, avec limites d'entretien.",
    groupe="QUAI", cat="Infrastructure", cmin=200, cmax=200, unite="M€", per="ponctuel", delai="Actif en N+2",
    cond="Toulon ou Brest uniquement (fiche Marine p5).", armee="Marine", pages="5, 13", ed=ED_DGA_27)
opt("DGA-QUAI-PERM", "DGA", "Quai permanent porte-avions", "Accueil PA + navires alliés, ou double PA possible.",
    groupe="QUAI", cat="Infrastructure", cmin=300, cmax=300, unite="M€", per="ponctuel", delai="Actif en N+3",
    cond="Toulon ou Brest uniquement (fiche Marine p5).", armee="Marine", pages="5, 13", ed=ED_DGA_27)
opt("DGA-PANG2", "DGA", "Second PANG : lancement du chantier",
    "Remobilisation de cale incluse sauf si saturée. Peut accueillir un groupe mixte franco-allié.", groupe="PA2",
    cat="Programme naval", cmin=5000, cmax=5000, unite="M€ sur 5 ans", per="pluriannuel", etal="5 ans (2039-2044)",
    cond="Au moins une action de développement/financement par an (fiche Marine p5).", armee="Marine",
    pages="13", ed=ED_3540, alerte="Dates 2039-2044 hors fenêtre 2027-2033.")
opt("DGA-GAN2", "DGA", "Groupe aéronaval additionnel", "Accompagne le second PANG.", groupe="PA2",
    cat="Programme naval", cmin=2000, cmax=2000, unite="M€ sur 3 ans", per="pluriannuel", etal="3 ans, dès 2042",
    armee="Marine", pages="13", ed=ED_3540, alerte="Dates hors fenêtre 2027-2033.")
for c, n, d, a, dl, al in [
    ("AED-10", "Armes à énergie dirigée (opérationnel N+10)", "", 300, "N+10", ""),
    ("AED-15", "Armes à énergie dirigée (opérationnel N+15)", "", 200, "N+15", ""),
    ("HYPER-5", "Missiles hypersoniques (opérationnel N+5)", "", 200, "N+5", ""),
    ("HYPER-10", "Missiles hypersoniques (opérationnel N+10)", "", 100, "N+10", ""),
    ("QUANT", "Cyberdéfense quantique", "Parer la menace des ordinateurs quantiques sur le chiffrement (horizon 2050).", 200, "", ""),
]:
    opt("DGA-" + c, "DGA", n, d or "Programme de R&D.", groupe=c.split("-")[0], cat="R&D", cmin=a, cmax=a,
        unite="M€/an", per="annuel", delai=dl, typ="Violet (investissement) [suggestion]", pages="5, 6", ed=ED_3540,
        alerte="Section « R&D pour l'horizon 2035-2040 ».")
opt("DGA-ESSAIM", "DGA", "Essaim de drones",
    "Essaims autonomes de drones aériens et terrestres armés. Le financement ne présume pas de la mise en production.",
    groupe="ESSAIM", cat="R&D", cmin=300, cmax=300, unite="M€ (lancement) puis 200 M€/an", per="ponctuel + annuel",
    delai="Opérationnel en N+6", typ="Violet (investissement) [suggestion]", pages="5", ed=ED_3540,
    alerte="Section « R&D pour l'horizon 2035-2040 ».")
opt("DGA-ARGONAUTE", "DGA", "Argonaute (sécurité spatiale, ESA)",
    "Réduction du risque spatial (débris) ; technologie duale de protection contre les actions hostiles.",
    groupe="ARGONAUTE", cat="R&D", cmin=500, cmax=500, unite="M€ (lancement) puis 200 M€/an",
    per="ponctuel + annuel", delai="Opérationnel en N+10",
    cond="Investissement nécessaire pour convaincre les partenaires européens. Coûts partageables avec d'autres ministères (MEFR).",
    part="Agence spatiale européenne", armee="Air et Espace", typ="Violet (investissement) [suggestion]",
    pages="6", ed=ED_3540, alerte="Section « R&D pour l'horizon 2035-2040 ».")
for m, o_, cu, mco_, dl, ach, rq in [
    ("Leopard 2A8", "Allemagne", "15-20", "0,5-1", "2-3 ans", "faible", "Très répandu en Europe, interopérable."),
    ("M1A2 Abrams SEPv3", "États-Unis", "10-12", "1-1,5", "2-3 ans", "élevé (transatlantique)", "Coûteux à entretenir et transporter."),
    ("KF51 Panther", "Allemagne", "15-20", "0,5-1", "3-4 ans", "faible", "Nouvelle génération en développement."),
    ("EMBT (Leclerc Evolution)", "France / Allemagne", "8-10", "0,5-0,8", "2-3 ans", "N/A (national)", "Char intermédiaire franco-allemand."),
    ("K2 Black Panther", "Corée du Sud", "8-10", "0,5-0,8", "2-3 ans", "élevé (maritime)", "Moderne, coûts logistiques importants."),
    ("M10 Booker", "États-Unis", "5-6", "0,3-0,5", "2-3 ans", "élevé (transatlantique)", "Char léger récent."),
    ("Leclerc XLR (rénové)", "France", "4-5", "0,3-0,5", "1-2 ans", "N/A (national)", "Prolonge le Leclerc jusqu'en 2040."),
    ("AMX-10 RC (rénové)", "France", "2-3", "0,2-0,3", "1-2 ans", "N/A (national)", "Reconnaissance, peu adapté à la haute intensité."),
]:
    a_, b_ = [float(x.replace(",", ".")) for x in cu.split("-")]
    opt("DGA-CHAR-" + m.split()[0].upper().replace("-", ""), "DGA", "Achat sur étagère : " + m,
        "Origine : %s. %s MCO : %s M€/an par char. Acheminement : %s." % (o_, rq, mco_, ach), groupe="CHARS",
        cat="Achat sur étagère", statut="fourchette", cmin=a_, cmax=b_, unite="M€ par char", per="ponctuel",
        delai=dl, armee="Terre", pages="16", ed=ED_3540,
        alerte="Grille « 2035-2040 ». Coût unitaire : nombre de chars par case à fixer par l'animateur.")

# ---------------------------------------------------------------- Armées
opt("EMAAE-BSA", "EMAAE", "Brigade anti-aérienne (type SAMP/T NG) : exploitation",
    "Structure cible : 4 batteries SAMP/T NG (1 radar + 1 C2 + 4 lanceurs), 2 batteries SHORAD (MICA VL / Mistral), "
    "1 radar longue portée + 1 C2 brigade.", groupe="SAMPT", cat="Capacité", statut="fourchette", cmin=200, cmax=300,
    unite="M€/an (exploitation)", per="annuel",
    dnote="200 M€/an en version dégradée ; 300 M€/an pour une capacité complète avec MCO renforcé.",
    eff="Défense sol-air de théâtre.", armee="Air et Espace", typ="Capacité", pages="3",
    alerte="Investissement initial : voir DGA-SAMPT (400 M€ par pion, 3 lanceurs et non 4).")
PISTE = "Piste de la fiche : coût, volume et délai évalués par l'animateur ou les arbitres ; tuile ≥ 100 M€, sinon rattacher à un programme existant."
for role, pages, items, ed in [
    ("EMAT", "5, 6", [
        ("IA-TAC", "IA tactique terrestre", "Coordination automatisée des unités robotisées (UGV, drones), appui-feu intelligent, intégration Scorpion/SICS, action sans GPS."),
        ("DRONES", "Drones, munitions autonomes et essaims", "Munitions vagabondes, drones FPV à bas coût (~300 à 1 000 € l'unité) en masse, fonctionnement sans GPS."),
        ("ROBOT", "Robotique terrestre interopérable", "UGV, URV ou USV en appui, intégrés à la manœuvre Scorpion."),
        ("LOG", "Logistique projetable et soutien opérationnel", "Hubs logistiques avancés pour brigades projetables, ravitaillement inter-théâtres, prépositionnement de Caesar, VBCI, blindés du génie."),
        ("CYBER", "Cyberguerre terrestre et guerre électronique", "Protection des réseaux Scorpion et SICS, brouillage, interception, unités cyber de réaction rapide."),
        ("FEUX", "Dissuasion conventionnelle et feux profonds", "LRM longue portée (type HIMARS, M270), missiles balistiques tactiques conventionnels, appui-feu autonome."),
        ("SPATIAL", "Appui spatialisé militaire", "Géolocalisation, imagerie multispectrale, communications déployables, surveillance logistique adverse."),
        ("COOP", "Coopérations OTAN / UE", "MGCS, achats mutualisés (drones, sol-air), brigades conjointes, achats en complément national (Boxer, Lynx)."),
    ], ED_2027),
    ("EMAAE", "4, 5, 6", [
        ("SEAD", "Capacité SEAD", "Escadron Rafale F5 ou NGF en configuration SEAD, nacelles EW, missiles anti-radar (chiffré côté DGA : DGA-SEAD)."),
        ("IA", "IA opérationnelle embarquée", "Ciblage, guerre électronique, détection ; supervision humaine intégrée au C2."),
        ("DRONES", "Drones, munitions autonomes et essaims", "Drones kamikazes ou de harcèlement compatibles Reaper, Eurodrone."),
        ("SPATIAL", "Capacités spatiales militaires", "Surveillance, antisatellite passif ou actif, lancements nationaux, ARGONAUTE."),
        ("FURTIF", "Furtivité et supériorité multi-domaines", "Signature multibande SCAF, Loyal Wingman furtifs, brouillage actif."),
        ("LOG", "Logistique projetable et soutien avancé", "Bases aériennes avancées, extension de pistes, renforcement MRTT / A400M."),
        ("CYBER", "Cyberguerre aérienne", "Cybersécurité SCAF, drones, liaisons ; guerre électronique offensive."),
        ("PROF", "Frappe dans la profondeur conventionnelle", "Missiles air-sol longue portée, saturation des zones aériennes ennemies."),
        ("COOP", "Coopérations OTAN / UE", "SCAF, drones MALE/HALE, munitions intelligentes, satellites partagés (EU SST)."),
        ("C130H", "Retrait ou remplacement des C-130H", "C-130H en fin de vie et coûteux ; C-130J conservés pour missions spéciales (p3)."),
    ], "À vérifier : le guide de la fiche vise la « LPM 2035-2040 » (p4)"),
    ("EMM", "4 à 8", [
        ("FDA", "Remplacement des frégates de défense aérienne (Forbin)", "Protection des groupes aéronavals contre missiles hypersoniques et saturation de drones (p4)."),
        ("MAWS", "MAWS, successeur des Atlantique 2", "Arbitrage entre solution européenne, nationale ou achat américain (P-8 Poseidon) (p4)."),
        ("IA", "IA navale et commandement embarqué", "IA sur frégate, SNA ou drone de surface ; doctrine interarmées validée par le CEMA."),
        ("DRONES", "Drones, munitions autonomes et essaims maritimes", "Munitions à détection passive, déploiement par USV ou frégates."),
        ("ROBOT", "Robotique navale et sous-marine", "USV de surveillance portuaire, URV de lutte anti-mines et guerre des fonds marins."),
        ("FURTIF", "Furtivité multi-domaine", "Camouflage thermique, revêtement adaptatif, leurres numériques."),
        ("LOG", "Logistique projetable", "Renforcement des BRF, points de repli à l'étranger, déploiement portuaire temporaire."),
        ("CYBER", "Cyberguerre navale", "Protection des frégates, SNLE, SNA ; déni d'accès ; renseignement cyber."),
        ("FRAPPE", "Dissuasion conventionnelle et frappe navale", "MdCN sur frégates et sous-marins, frappe mer-terre longue distance."),
        ("SPATIAL", "Capacité spatiale appliquée à la Marine", "Surveillance satellite des routes maritimes et des ZEE."),
        ("COOP", "Coopérations OTAN / UE", "Co-construction de frégates, normalisation des munitions, mise en réseau des ZEE (France, Italie, Grèce)."),
        ("EST", "Soutien des opérations sur le flanc Est", "Lignes logistiques maritimes, escorte de convois, infrastructures sous-marines, accès Baltique et mer du Nord, lutte ASM."),
        ("STOCKS", "Stocks de munitions navales", "Besoins en MdCN, Exocet, Aster, MU90 et munitions téléopérées ; prix unitaires dans la fiche DGA."),
        ("CABLES", "Protection des infrastructures critiques", "Câbles sous-marins, réseaux énergétiques, infrastructures offshore (p3)."),
    ], "À vérifier : le guide de la fiche vise la « LPM 2035-2040 » (p4)"),
]:
    for c, n, d in items:
        arm = {"EMAT": "Terre", "EMAAE": "Air et Espace", "EMM": "Marine"}[role]
        opt(role + "-" + c, role, n, d, cat="Piste capacitaire", statut="non chiffré", cond=PISTE, armee=arm,
            pages=pages, ed=ed)
opt("EMAT-TITAN", "EMAT", "Brigade Titan (1 à 2 brigades Leclerc d'ici 2040)",
    "Matériel requis par brigade : 96 MGCS, 160 successeurs VBCI, 120 VBAE, 18 SABC.", groupe="TITAN",
    cat="Capacité", statut="renvoi", cond="Horizon 2040.", armee="Terre", pages="3",
    alerte="Non chiffré dans la fiche Terre ; la DGA donne 3,2 Md€ + 400 M€/an (DGA-TITAN).")
opt("EMM-PANG2", "EMM", "Second porte-avions (PA-NG 2)",
    "Format permanent à deux groupes aéronavals.", groupe="PA2", cat="Programme naval", statut="renvoi",
    cond="Calendrier obligatoire sur 5 ans, au moins une action de développement/financement par an ; capacité des cales limitée ; "
    "seules Toulon et Brest peuvent accueillir le bâtiment, vérifier les quais.", armee="Marine", pages="4, 5",
    ed="À vérifier : chronologie PANG 2036-2038", alerte="Coût dans la fiche DGA (DGA-PANG2, DGA-GAN2, quais).")
opt("EMM-CDG", "EMM", "Maintien exceptionnel du Charles de Gaulle en 2037",
    "Deux porte-avions la même année (l'un en fin de vie, l'autre en essais).", groupe="PA-CDG", cat="Programme naval",
    statut="renvoi", eff="Symbole politique fort (année présidentielle).", armee="Marine", pages="5",
    ed="À vérifier : chronologie PANG 2036-2038", alerte="Coût dans la fiche DGA (DGA-CDG, 1 Md€).")

# ---------------------------------------------------------------- Rôles sans dépense propre
opt("COCA-SPATIAL", "COCA", "Programme capacitaire spatial d'urgence",
    "Nouveau satellite ou système de contre-mesures spatiales, lancé à la suite du scénario « menace satellitaire ».",
    cat="Programme issu d'un scénario", statut="non chiffré", delai="Effet dans 3 à 5 tours",
    eff="Le rapport COCA peut créer une urgence stratégique, annuler ou requalifier une tuile.", armee="Air et Espace",
    pages="5", alerte="La même fiche existe en version « Red team » (chef d'équipe DGRIS au lieu de MEAE).")

COLS = ["code", "groupe", "role", "entite", "categorie", "nom", "description", "statut_cout", "cout_min", "cout_max",
        "unite", "periodicite", "etalement", "dorese_ao", "dorese_mco", "dorese_rh", "dorese_note", "delai",
        "conditions", "partenaires", "effets", "imputation_source", "armee_suggeree", "type_pion",
        "source_fiche", "source_pages", "edition", "alerte"]

# Imputation indiquée par la fiche elle-même
IMPUT = {"EMAAE-BSA": "Air et Espace (fiche AAE)", "DGA-SAMPT": "Interarmées (« portée interarmées »)",
         "DGA-HIL": "Interarmées (Terre, Marine, Air)", "DGA-STOCK-MIXTE": "Liaison logistique SGA",
         "SGA-RES-DIV": "Hors plafond masse salariale"}
for o in O:
    if o["code"] in IMPUT:
        o["imputation_source"] = IMPUT[o["code"]]

# Règles transverses
REGLES = [
    ("Plateau", "1 case = 100 M€ ; 1 DORESE = 100 M€ (règle de l'exercice).", "Consigne", ""),
    ("Plateau", "La plus petite tuile vaut 100 M€ ; un projet plus petit est rattaché à un programme existant, fusionné, ou traité comme signal politique sans tuile.", "Terre p4, Air p4, Marine p5", ""),
    ("Plateau", "Seul le Sous-chef Plans place, déplace, active ou dégrade les pions.", "SC-Plans p2, p3", ""),
    ("DORESE", "Full ops (100 %) = niveau de dotation 2020, atteint quand tous les DORESE additionnels (MCO, entraînement/activité, effectifs) indiqués sur le pion sont posés à côté : face verte.", "SC-Plans p3", ""),
    ("DORESE", "Pion sans tous ses DORESE : face rouge, opérationnalité de 90 % à 50 % ; capacité dégradée sans DORESE additionnel = 50 %.", "SC-Plans p3", ""),
    ("DORESE", "Des DORESE au-delà du besoin peuvent porter une capacité au-dessus de 100 % (durcissement haute intensité).", "SC-Plans p3", ""),
    ("DORESE", "Armée de Terre : tout engagement d'une capacité en haute intensité double les DORESE nécessaires pour l'année en cours.", "Terre p2, p3", ""),
    ("Délais", "Activation d'une nouvelle capacité : 3 ans minimum. Retrait : 2 à 3 ans après décision en COCEM (le SC-Plans exécute, ne décide pas seul).", "SC-Plans p2, p3", ""),
    ("Industrie", "Le volume d'une commande ne varie pas de plus de 25 % d'une année à l'autre ; la DGA peut imposer reports, mutualisations, glissements ou refuser une tuile.", "DGA p2", ""),
    ("Industrie", "Toute création de chaîne de production exige un préavis de 3 ans et une commande minimale annuelle (tableau MCA).", "DGA p3", ""),
    ("Industrie", "Commandes minimales annuelles : SCAF 10 ; Eurodrone 2 ; A400M G2 3 ; MAWS 2 ; Rafale F6 8 ; CIFS 10 ; MGCS 20 ; SABC 5 ; VBAE 20 ; successeur VBCI 40 ; successeur Tigre 10 ; Loyal Wingmen 4 ; SAMP/T NG 1 brigade tous les 2 ans ; drones FPV et anti-drones en production continue ; HIL 10.", "DGA p3, p4", ""),
    ("Industrie", "Les chaînes Rafale sont censées s'arrêter en 2035.", "DGA p2 (note)", ""),
    ("RH", "4 pions « masse salariale » supplémentaires par an au maximum, toutes armées confondues ; le SGA surveille, le SC-Plans applique.", "SGA p2, p3", ""),
    ("RH", "Une division de réserve n'est pas soumise à cette limite de 4 pions.", "SGA p7", ""),
    ("Budget", "Trajectoire de travail (Md€) : 2027 = 59 ; 2028 = 58 ; 2029 = 57 ; 2030 = 58 ; 2031 = 59 ; 2032 = 60. Le MEFR peut l'ajuster.", "MEFR p3, p4", ""),
    ("Budget", "Inflation : stabilisation européenne −850 M€/an ; conflit régional prolongé −1 500 M€/an ; choc énergétique −2 800 M€/an ; guerre OTAN-Russie −4 900 M€/an.", "MEFR p5", "Aléas, à jouer en pions orange"),
    ("Arbitrage", "Le CEMA a le dernier mot sur tout projet qui concerne plusieurs armées et peut en demander la mutualisation, la fusion ou la réorientation.", "CEMA p4, p5", ""),
    ("Arbitrage", "Le MINARM tranche les désaccords majeurs et valide toute évolution majeure des forces ou programme d'armement.", "MINARM p5", ""),
    ("Arbitrage", "Les options diplomatiques (DGRIS, MEAE) sont négociées avec les joueurs responsables, puis soumises aux facilitateurs si elles supposent une décision extérieure au ministère.", "DGRIS p7", ""),
    ("Arbitrage", "Coûts, volumes et délais des pistes non chiffrées sont évalués par l'animateur ou les arbitres ; les joueurs peuvent créer des tuiles personnalisées s'ils les justifient.", "Terre p6, Air p6, Marine p8", ""),
    ("Munitions", "Objectif OTAN : 30 jours de combat haute intensité, recomplètement en 4 à 6 semaines. Une division en engagement soutenu consomme 500 à 600 obus/jour ; 50 Rafale armés demandent 200 à 250 MICA.", "DGA p6, p11", ""),
]

MUNITIONS = [
    ("Obus de 20 mm (VAB, AMX 10)", "50 €", "2 000 000"), ("Obus de 25 mm (VBCI)", "150 €", "670 000"),
    ("Cartouche de 5,56 mm", "0,35 €", "32 000 000"), ("Fusée FRAPPE (artillerie)", "5 500 €", "18 000"),
    ("155 mm classique (sol-sol)", "6 000 €", "17 000"), ("155 mm guidé (sol-sol)", "60 000 €", "1 700"),
    ("Obus anti-char BONUS", "25 000 €", "4 000"), ("Missile anti-char Milan", "7 000 €", "14 000"),
    ("Missile anti-aérien Crotale", "7 600 €", "13 000"), ("Missile HOT", "40 000 €", "2 500"),
    ("Bombe guidée Paveway II (GBU 12, 16)", "25 000 €", "4 000"),
    ("Bombe guidée Paveway III et IV (GBU 22, 24, 49)", "60 000 €", "1 700"),
    ("Roquette LRU (M31 MLRS)", "90 000 €", "1 100"), ("MMP", "190 000 €", "525"),
    ("Missile Mistral", "130 000 €", "770"), ("A2SM", "250 000 €", "400"),
    ("Missile de croisière SCALP-EG", "850 000 €", "117"), ("Missile METEOR (air-air)", "1 200 000 €", "83"),
    ("ASTER 30 (sol-air)", "2 000 000 €", "50"), ("Torpille F17 mod", "1 500 000 €", "200"),
    ("Torpille MU-90", "800 000 €", "125"), ("MM-40 EXOCET (antinavire)", "1 500 000 €", "67"),
    ("Torpille F-21", "2 300 000 €", "43"), ("FPV tactique", "1 000 à 5 000 €", "non donnée"),
    ("Munition rôdeuse", "50 000 €", "non donnée"), ("MICA (air-air)", "600 000 €", "170"),
]

EDITIONS = [
    ("DGRIS", "2027-2033", "Confirmée", "Seule fiche titrée 2027-2033 dans sa source."),
    ("MEAE", "2027-2033", "Cohérente", "Mêmes tableaux d'options que la DGRIS."),
    ("MEFR", "2027-2032", "Cohérente", "Budget et surcoûts annuels 2027-2032."),
    ("SGA", "2027-2033", "Cohérente", "Mentionne « STRATEGIKON 2027-2033 » (p5)."),
    ("CEMA", "2027-2033", "Cohérente", "Modèle d'armées 2027 ; parle aussi de « préparer les armées pour 2040 »."),
    ("MINARM", "2027-2033", "Cohérente", ""),
    ("Sous-chef Plans", "2027-2032", "Cohérente", "Règles du plateau, sans option de dépense."),
    ("COCA / Red team", "2027-2032", "Cohérente, mais deux versions", "Même fiche ; chef d'équipe MEAE (COCA) ou DGRIS (Red team)."),
    ("Armée de Terre", "2027-2032", "Mélangée", "Guide « LPM 2027-2030 » (p4) ; Titan horizon 2040."),
    ("Armée de l'Air", "2027-2032", "Mélangée", "Le guide de développement vise la « LPM 2035-2040 » (p4)."),
    ("Marine", "2027-2032", "Mélangée", "Guide « LPM 2035-2040 » (p4) ; PANG livré en 2036, opérationnel en 2038."),
    ("DGA", "2027-2032", "Mélangée", "Focus munitions 2027-2032, mais R&D « horizon 2035-2040 », grille chars 2035-2040, CDG 2038-2039, second PANG 2039-2044, HIL 2035."),
]

# Arbitrage d'artus (24/11) : coûts variables à dessein ; quand deux fiches divergent,
# garder la fourchette la plus large couvrant les deux. Le responsable fixe le prix en jeu.
for _g in ("EST-POL-HUB", "RES-DIV"):
    _rows = [o for o in O if o["groupe"] == _g and o["cout_min"] is not None]
    _a, _b = min(o["cout_min"] for o in _rows), max(o["cout_max"] for o in _rows)
    for o in _rows:
        _src = ("%g" % o["cout_min"]) if o["cout_min"] == o["cout_max"] else "%g à %g" % (o["cout_min"], o["cout_max"])
        o["cout_min"], o["cout_max"], o["statut_cout"] = _a, _b, "fourchette"
        o["alerte"] = ("Fourchette élargie aux fiches qui divergent (cette fiche : %s M€/an). "
                       "Coût variable à dessein : le responsable fixe le prix en jeu." % _src)
for o in O:
    if o["code"] == "MEFR-DIV-RES":
        o["unite"] = "M€/an"
