#!/usr/bin/env python3
"""Assemble refonte/ en une page unique (aperçu en mode local) : dist/refonte-apercu.html."""
import os, re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(RACINE, "refonte")


def lire(chemin):
    with open(chemin, encoding="utf-8") as f:
        return f.read()


html = lire(os.path.join(REF, "index.html"))
html = html.replace('<link rel="stylesheet" href="style.css">',
                    "<style>\n" + lire(os.path.join(REF, "style.css")) + "\n</style>")


def script(m):
    src = m.group(1)
    if src.endswith("config.js"):
        code = 'window.STRAT_CONFIG = { supabaseUrl: "", supabaseCle: "", appsScriptUrl: "" };'
    else:
        code = lire(os.path.normpath(os.path.join(REF, src)))
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


html = re.sub(r'<script src="([^"]+)"></script>', script, html)
os.makedirs(os.path.join(RACINE, "dist"), exist_ok=True)
sortie = os.path.join(RACINE, "dist", "refonte-apercu.html")
with open(sortie, "w", encoding="utf-8") as f:
    f.write(html)
print(sortie, len(html))
