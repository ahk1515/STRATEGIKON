"""Assemble l'outil en un seul fichier HTML (CSS, données et scripts inclus).

Usage : python3 scripts/assembler.py
Produit :
  - apps-script/Index.html : la page à coller dans le projet Apps Script ;
  - dist/apercu.html       : la même page sans enveloppe, pour un aperçu publié.
"""
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent.parent


def lire(chemin):
    return (RACINE / chemin).read_text(encoding="utf-8")


def assembler():
    page = lire("index.html")
    page = page.replace(
        '<link rel="stylesheet" href="css/style.css">',
        "<style>\n" + lire("css/style.css") + "\n</style>",
    )

    def script(m):
        code = lire(m.group(1))
        if "</script" in code:
            raise ValueError(f"{m.group(1)} contient </script>")
        return "<script>\n" + code + "\n</script>"

    page = re.sub(r'<script src="([^"]+)"></script>', script, page)
    (RACINE / "apps-script" / "Index.html").write_text(page, encoding="utf-8")

    # Aperçu : on retire l'enveloppe html/head/body.
    apercu = page
    for motif in (r"<!doctype html>\s*", r"<html[^>]*>\s*", r"</?head>\s*", r"</?body>\s*", r"</html>\s*", r'<meta charset="utf-8">\s*'):
        apercu = re.sub(motif, "", apercu, flags=re.I)
    (RACINE / "dist").mkdir(exist_ok=True)
    (RACINE / "dist" / "apercu.html").write_text(apercu, encoding="utf-8")
    print("apps-script/Index.html :", len(page) // 1024, "Ko")


if __name__ == "__main__":
    assembler()
