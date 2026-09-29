"""Génère frontend_new/src/data/verbForms.ts à partir de la liste officielle data/ods8.txt.

Pour chaque verbe de masterVerbsDb.ts, on vérifie dans l'ODS 8 les formes qui piègent
les joueurs de Scrabble : participe passé féminin (FELEE ✓ / FLUEE ✗), temps manquants
des verbes défectifs, verbes à la 3e personne seulement, rallonges avant et arrière.

Encodage compact par verbe : "pp|manquants|flags|arriere|avant"
  pp        : 'v' participe féminin valide, 'i' participe invariable, '' non déterminé
  manquants : codes des temps absents (P présent, I imparfait, S passé simple,
              F futur, J subj. imparfait, N participe présent, Q participe passé)
  flags     : '3' = 3e personne seulement, 'n' = verbe absent de l'ODS 8 (rien n'est calculé)
  arriere   : lettres ajoutables à la fin (ENTER + A -> ENTERA)
  avant     : lettres ajoutables au début (A + GIR -> ... )

Usage : python scripts/build_verb_forms.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ODS_PATH = ROOT / "data" / "ods8.txt"
VERBS_PATH = ROOT / "frontend_new" / "src" / "data" / "masterVerbsDb.ts"
OUT_PATH = ROOT / "frontend_new" / "src" / "data" / "verbForms.ts"

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def load_ods() -> set[str]:
    return {w.strip() for w in ODS_PATH.read_text(encoding="utf-8").splitlines() if w.strip()}


def load_verbs() -> list[str]:
    words = re.findall(r'word: "([A-Z]+)"', VERBS_PATH.read_text(encoding="utf-8"))
    return list(dict.fromkeys(words))


def analyse_er(w: str, ods: set[str]) -> tuple[str, str, str]:
    """Verbes du 1er groupe (-ER). Seules des formes sans changement de radical sont testées."""
    s = w[:-2]
    sa = s + "E" if s.endswith("G") and not s.endswith("GG") else s  # MANGEA ; mais JOGGA
    has = lambda *forms: any(f in ods for f in forms)

    fut_variants = [w + "A", s + s[-1] + "ERA"]  # ENTERA, JETTERA / APPELLERA
    if s.endswith("Y"):
        fut_variants.append(s[:-1] + "IERA")  # PAIERA, NETTOIERA
    if w.endswith("VOYER"):
        fut_variants.append(s[:-2] + "ERRA")  # ENVERRA
    pres_il = [s + "E", s + s[-1] + "E"]  # FELE, JETTE
    if s.endswith("Y"):
        pres_il.append(s[:-1] + "IE")  # NETTOIE

    tenses_il = {
        "P": has(*pres_il),
        "I": has(sa + "AIT"),
        "S": has(sa + "A"),
        "F": has(*fut_variants),
        "J": has(sa + "AT"),
        "N": has(sa + "ANT"),
        "Q": has(s + "E"),
    }
    personal = has(sa + "ONS", s + "EZ", sa + "AIS", sa + "AMES", sa + "ASSE", w + "AI")

    if s + "EE" in ods:
        pp = "v"
    elif tenses_il["Q"]:
        pp = "i"
    else:
        pp = ""

    missing = "".join(k for k, ok in tenses_il.items() if not ok)
    if len(missing) == len(tenses_il):
        # Infinitif présent dans l'ODS 8 mais comme nom (COMPUTER, STREAMER) : verbe inconnu
        return "", "", "n"
    if len(missing) >= 4:
        # Quasi réduit à l'infinitif (ESTER) : les rares formes trouvées sont des homographes
        return "", missing, ""
    only_third = not personal and any(tenses_il[k] for k in "PIS")
    return pp, missing, "3" if only_third else ""


def analyse_ir2(w: str, ods: set[str]) -> tuple[str, str, str] | None:
    """Verbes du 2e groupe (-IR, nous -ISSONS). None si ce n'est pas un 2e groupe."""
    s = w[:-2]
    if s + "ISSONS" not in ods and s + "ISSAIT" not in ods:
        return None
    has = lambda *forms: any(f in ods for f in forms)
    tenses_il = {
        "P": has(s + "IT"),
        "I": has(s + "ISSAIT"),
        "F": has(w + "A"),
        "N": has(s + "ISSANT"),
        "Q": has(s + "I"),
    }
    personal = has(s + "ISSONS", s + "ISSEZ", s + "ISSAIS", w + "AI")
    pp = "v" if s + "IE" in ods else ("i" if tenses_il["Q"] else "")
    missing = "".join(k for k, ok in tenses_il.items() if not ok)
    only_third = not personal and any(tenses_il[k] for k in "PI")
    return pp, missing, "3" if only_third else ""


def hooks(w: str, ods: set[str]) -> tuple[str, str]:
    back = "".join(c for c in LETTERS if w + c in ods)
    front = "".join(c for c in LETTERS if c + w in ods)
    return back, front


def main() -> None:
    ods = load_ods()
    verbs = load_verbs()
    out: dict[str, str] = {}
    stats = {"v": 0, "i": 0, "": 0, "def": 0, "3": 0}

    for w in verbs:
        pp, missing, flags = "", "", ""
        if w not in ods:
            out[w] = "||n||"
            stats[""] += 1
            stats["n"] = stats.get("n", 0) + 1
            continue
        if w.endswith("ER") and w not in {"ALLER"}:
            pp, missing, flags = analyse_er(w, ods)
        elif w.endswith("IR") and not w.endswith("OIR"):
            res = analyse_ir2(w, ods)
            if res:
                pp, missing, flags = res
        back, front = hooks(w, ods)
        out[w] = f"{pp}|{missing}|{flags}|{back}|{front}"
        stats[pp] += 1
        stats["def"] += bool(missing)
        stats["3"] += bool(flags)

    body = ",\n".join(f"  {w}: {json.dumps(code)}" for w, code in out.items())
    OUT_PATH.write_text(
        "// Fichier généré par scripts/build_verb_forms.py à partir de data/ods8.txt — ne pas éditer.\n"
        "// Format : \"pp|temps manquants|flags|rallonges arrière|rallonges avant\" (voir le script).\n"
        f"export const VERB_FORMS_RAW: Record<string, string> = {{\n{body},\n}};\n",
        encoding="utf-8",
    )
    print(f"{len(out)} verbes -> {OUT_PATH.relative_to(ROOT)}")
    print("participe variable:", stats["v"], "invariable:", stats["i"], "non déterminé:", stats[""])
    print("avec temps manquants:", stats["def"], "3e personne seulement:", stats["3"])
    print("absents de l'ODS 8:", stats.get("n", 0))


if __name__ == "__main__":
    main()
