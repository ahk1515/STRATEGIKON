"""Convertit data/base_pions_strategikon.csv en data/pions.js.

Usage : python3 scripts/csv_vers_js.py
À relancer après chaque mise à jour du CSV (la base des pions fait foi).
"""
import csv
import json
import pathlib

RACINE = pathlib.Path(__file__).resolve().parent.parent
SOURCE = RACINE / "data" / "base_pions_strategikon.csv"
CIBLE = RACINE / "data" / "pions.js"

TYPES = {
    "Gris": "gris",
    "Violet": "violet",
    "Orange": "orange",
    "Capacité": "capacite",
}


def nombre(valeur):
    valeur = (valeur or "").strip().replace(",", ".")
    return int(float(valeur)) if valeur else 0


def type_court(libelle):
    for debut, code in TYPES.items():
        if libelle.startswith(debut):
            return code
    raise ValueError(f"Type de pion inconnu : {libelle}")


def main():
    pions = []
    with SOURCE.open(encoding="utf-8") as f:
        for ligne in csv.DictReader(f):
            dorese = {
                "ao": nombre(ligne["DORESE Activité opé. (botte)"]),
                "mco": nombre(ligne["DORESE MCO (camion)"]),
                "rh": nombre(ligne["DORESE RH (soldat)"]),
            }
            cout50 = nombre(ligne["Coût actuel (M€)"])
            # Situation de départ (photo 2027) : DORESE déjà posées.
            depart = {
                "ao": nombre(ligne.get("DORESE posées 2027 AO")),
                "mco": nombre(ligne.get("DORESE posées 2027 MCO")),
                "rh": nombre(ligne.get("DORESE posées 2027 RH")),
            }
            pions.append({
                "id": "P" + ligne["ID"].strip(),
                "armee": ligne["Armée / pôle"].strip(),
                "nom": ligne["Nom du pion"].strip(),
                "type": type_court(ligne["Type de pion"].strip()),
                "l": nombre(ligne["Largeur (cases)"]),
                "h": nombre(ligne["Hauteur (cases)"]),
                "cout50": cout50,
                "dorese": dorese,
                "cout100": cout50 + 100 * sum(dorese.values()),
                "depart": depart,
                "remarque": ligne["Fiabilité / remarques"].strip(),
            })
    entete = "// Fichier généré par scripts/csv_vers_js.py : ne pas modifier à la main.\n"
    CIBLE.write_text(
        entete + "window.STRAT_PIONS = " + json.dumps(pions, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(pions)} pions écrits dans {CIBLE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
