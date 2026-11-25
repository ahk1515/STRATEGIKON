# -*- coding: utf-8 -*-
import csv, json, sys, os
from collections import OrderedDict, defaultdict
sys.path.insert(0, os.path.dirname(__file__))
from donnees import O, COLS, REGLES, MUNITIONS, EDITIONS
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

codes = [o["code"] for o in O]
assert len(codes) == len(set(codes)), [c for c in codes if codes.count(c) > 1]

ORDRE = ["DGRIS", "MEAE", "MEFR", "SGA", "DGA", "EMAT", "EMAAE", "EMM", "CEMA", "COCA", "SC-Plans", "MINARM"]
O.sort(key=lambda o: ORDRE.index(o["role"]))


def cases(v):
    return None if v is None else round(v / 100, 2)


HEAD = OrderedDict([
    ("code", "Code"), ("groupe", "Option commune"), ("entite", "Entité"), ("role", "Code rôle (outil)"),
    ("categorie", "Catégorie"), ("nom", "Nom"), ("description", "Description"), ("statut_cout", "Statut du coût"),
    ("cout_min", "Coût min (M€)"), ("cout_max", "Coût max (M€)"), ("cases_min", "Cases min"), ("cases_max", "Cases max"),
    ("unite", "Unité du coût"), ("periodicite", "Annuel / ponctuel"), ("etalement", "Étalement"),
    ("dorese_ao", "DORESE activité"), ("dorese_mco", "DORESE MCO"), ("dorese_rh", "DORESE RH"),
    ("dorese_note", "DORESE (détail)"), ("delai", "Délai / mise en service"), ("conditions", "Conditions et règles"),
    ("partenaires", "Partenaires"), ("effets", "Effets"), ("imputation_source", "Imputation donnée par la fiche"),
    ("armee_suggeree", "Plateau suggéré (à valider)"), ("type_pion", "Type de pion"),
    ("source_fiche", "Fiche source"), ("source_pages", "Pages"), ("edition", "Édition"), ("alerte", "À vérifier"),
])
for o in O:
    o["cases_min"], o["cases_max"] = cases(o["cout_min"]), cases(o["cout_max"])
    if o["unite"].startswith("M€ par char"):
        o["cases_min"] = o["cases_max"] = None

# CSV
with open(os.path.join(OUT, "catalogue_options_roles.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(HEAD.values())
    for o in O:
        w.writerow(["" if o[k] is None else o[k] for k in HEAD])

# JSON pour l'outil
LIB = {"chiffré": "chiffre", "fourchette": "fourchette", "à définir": "a_definir", "non chiffré": "non_chiffre", "renvoi": "renvoi"}
js = []
for o in O:
    d = OrderedDict()
    d["code"] = o["code"]; d["groupe"] = o["groupe"]; d["role"] = o["role"]; d["armee"] = o["armee_suggeree"]
    d["libelle"] = o["nom"]; d["description"] = o["description"]; d["categorie"] = o["categorie"]
    d["statut_cout"] = LIB[o["statut_cout"]]
    d["cout"] = o["cout_min"]; d["cout_max"] = o["cout_max"]; d["unite"] = o["unite"]
    d["periodicite"] = o["periodicite"]; d["etalement"] = o["etalement"] or None
    d["annuel"] = o["periodicite"] == "annuel"
    d["proposable_tel_quel"] = (o["statut_cout"] == "chiffré" and o["periodicite"] == "annuel"
                                and o["cout_min"] is not None and o["cout_min"] % 100 == 0)
    dor = {k: o["dorese_" + k] for k in ("ao", "mco", "rh") if o["dorese_" + k] is not None}
    d["dorese"] = {"ao": dor.get("ao", 0), "mco": dor.get("mco", 0), "rh": dor.get("rh", 0)} if dor else None
    d["dorese_note"] = o["dorese_note"] or None
    for k in ("delai", "conditions", "partenaires", "effets", "type_pion", "edition", "alerte"):
        d[k] = o[k] or None
    d["source"] = "%s, p. %s" % (o["source_fiche"].split(" (")[0], o["source_pages"])
    js.append(d)
meta = {"titre": "Catalogue des options de dépense par rôle (Strategikon)",
        "unites": "Montants en M€ ; 1 case = 100 M€ ; 1 DORESE = 100 M€",
        "regle": "Aucun montant ajouté : les coûts « a_definir » et « non_chiffre » restent nuls jusqu'à l'arbitrage de l'animateur.",
        "champs": {"cout": "M€, valeur basse si fourchette", "proposable_tel_quel": "vrai si coût annuel fixe, multiple de 100 M€"},
        "nombre": len(js)}
with open(os.path.join(OUT, "catalogue_options_roles.json"), "w", encoding="utf-8") as f:
    json.dump({"meta": meta, "options": js}, f, ensure_ascii=False, indent=1)
with open(os.path.join(OUT, "catalogue_options_roles.js"), "w", encoding="utf-8") as f:
    f.write("// Généré depuis le catalogue des fiches de rôle. Montants en M€ (1 case = 100 M€).\n")
    f.write("// Ne pas modifier à la main : régénérer depuis catalogue_options_roles.json.\n")
    f.write("window.STRAT_CATALOGUE_ROLES = ")
    json.dump(js, f, ensure_ascii=False, indent=1)
    f.write(";\n")

# XLSX
wb = Workbook()
BOLD = Font(bold=True, color="FFFFFF")
FILL = PatternFill("solid", fgColor="1F3864")
WRAP = Alignment(wrap_text=True, vertical="top")
COUL = {"à définir": "FCE4D6", "non chiffré": "EDEDED", "renvoi": "DDEBF7", "fourchette": "FFF2CC"}


def feuille(ws, titres, lignes, largeurs, nom_table, couleur_col=None):
    ws.append(titres)
    for l in lignes:
        ws.append(l)
    for i, c in enumerate(ws[1], 1):
        c.font = BOLD; c.fill = FILL; c.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = largeurs[i - 1] if i - 1 < len(largeurs) else 14
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = WRAP
        if couleur_col is not None:
            v = row[couleur_col].value
            if v in COUL:
                row[couleur_col].fill = PatternFill("solid", fgColor=COUL[v])
    ws.freeze_panes = "C2" if couleur_col is not None else "A2"
    ref = "A1:%s%d" % (get_column_letter(len(titres)), len(lignes) + 1)
    t = Table(displayName=nom_table, ref=ref)
    t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws.add_table(t)


ws = wb.active; ws.title = "Catalogue"
larg = [16, 14, 16, 10, 18, 30, 44, 12, 10, 10, 8, 8, 18, 14, 18, 9, 9, 9, 26, 20, 44, 18, 34, 22, 16, 18, 30, 8, 22, 40]
feuille(ws, list(HEAD.values()), [[o[k] for k in HEAD] for o in O], larg, "Catalogue",
        couleur_col=list(HEAD).index("statut_cout"))

# Par rôle
ws2 = wb.create_sheet("Par rôle")
agg = defaultdict(lambda: defaultdict(int))
for o in O:
    agg[o["entite"]][o["statut_cout"]] += 1
lig = []
for e in OrderedDict.fromkeys(o["entite"] for o in O):
    a = agg[e]
    lig.append([e, sum(a.values()), a["chiffré"], a["fourchette"], a["à définir"], a["non chiffré"], a["renvoi"]])
for e in ["CEMA", "Sous-chef Plans", "MINARM"]:
    if e not in agg:
        lig.append([e, 0, 0, 0, 0, 0, 0])
feuille(ws2, ["Entité", "Options", "Chiffrées", "Fourchette", "À définir", "Non chiffrées", "Renvoi vers une autre fiche"],
        lig, [30, 10, 10, 10, 10, 12, 16], "ParRole")

# Options communes
ws3 = wb.create_sheet("Options communes")
g = defaultdict(list)
for o in O:
    g[o["groupe"]].append(o)
lig = []
for k, v in g.items():
    if len({x["role"] for x in v}) > 1:
        vals = []
        for x in v:
            c = "à définir" if x["statut_cout"] == "à définir" else ("non chiffré" if x["cout_min"] is None else (
                "%g" % x["cout_min"] if x["cout_min"] == x["cout_max"] else "%g à %g" % (x["cout_min"], x["cout_max"])))
            vals.append("%s : %s %s" % (x["entite"], c, x["unite"] if x["cout_min"] is not None else ""))
        lig.append([k, v[0]["nom"], len(v), "\n".join(vals)])
feuille(ws3, ["Option commune", "Intitulé", "Mentions", "Coût selon chaque fiche"], lig, [16, 40, 10, 80], "Communes")

ws4 = wb.create_sheet("Règles transverses")
feuille(ws4, ["Thème", "Règle", "Source", "Remarque"], [list(r) for r in REGLES], [14, 90, 26, 26], "Regles")
ws5 = wb.create_sheet("Munitions")
feuille(ws5, ["Munition", "Coût unitaire", "Quantité pour 100 M€"], [list(m) for m in MUNITIONS], [44, 18, 20], "Munitions")
ws6 = wb.create_sheet("Éditions des fiches")
feuille(ws6, ["Fiche", "Période affichée", "Verdict", "Indices"], [list(e) for e in EDITIONS], [20, 16, 26, 80], "Editions")
ws7 = wb.create_sheet("Légende")
for r in [["Statut du coût", "Signification"],
          ["chiffré", "Montant unique donné par la fiche."],
          ["fourchette", "La fiche donne une fourchette ; coût min / max."],
          ["à définir", "La fiche écrit « à définir » : coût à arbitrer, rien n'a été inventé."],
          ["non chiffré", "Option ou piste citée sans montant."],
          ["renvoi", "Option sans coût dans cette fiche, chiffrée dans une autre (voir « À vérifier »)."],
          ["", ""],
          ["Plateau suggéré", "Proposition de rattachement à un plateau de l'outil (Terre, Marine, Air et Espace, Interarmées), à valider."],
          ["Cases", "Coût / 100 M€. Une valeur décimale (1,5 ou 2,5) signale un montant qui ne tombe pas sur la case."],
          ["Pages", "Pages du PDF original, telles que repérées dans le corpus converti."]]:
    ws7.append(r)
ws7["A1"].font = Font(bold=True); ws7["B1"].font = Font(bold=True)
ws7.column_dimensions["A"].width = 18; ws7.column_dimensions["B"].width = 100
wb.save(os.path.join(OUT, "catalogue_options_roles.xlsx"))

print(len(O), "options")
for e, a in agg.items():
    print(e, dict(a))
print("communes", len(lig))
