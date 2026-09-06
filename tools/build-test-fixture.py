#!/usr/bin/env python3
"""Builds tests/fixtures/compendium-index.json from a clone of Foundryborne/daggerheart (src/packs).

Usage: tools/build-test-fixture.py <clone>/src/packs
Keys are Foundry item type -> normalised name -> the fields the plan builder reads.
"""
import glob, json, os, re, sys, unicodedata

def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).replace("’", "'").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

packs = sys.argv[1]
idx = {}
for f in glob.glob(os.path.join(packs, "**", "*.json"), recursive=True):
    d = json.load(open(f))
    if not d.get("type") or not d.get("name"):
        continue
    rel = os.path.relpath(f, packs).split(os.sep)
    pack = rel[1] if rel[0] == "items" else rel[0]
    sy = d.get("system", {})
    e = {"uuid": f"Compendium.daggerheart.{pack}.Item.{d['_id']}", "name": d["name"], "type": d["type"], "pack": pack}
    for k in ("domain", "level", "tier", "secondary", "burden", "featureState", "spellcastingTrait", "domains", "linkedClass", "features", "levelupOptionTiers"):
        if k in sy:
            e[k] = sy[k]
    if d["type"] == "class":
        e["hitPoints"] = sy.get("hitPoints"); e["evasion"] = sy.get("evasion"); e["inventory"] = sy.get("inventory")
    idx.setdefault(d["type"], {})[norm(d["name"])] = e
out = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "compendium-index.json")
json.dump({"_comment": "Compendium index fixture generated from Foundryborne/daggerheart v14 src/packs (2.9.2) by tools/build-test-fixture.py; keys are type -> normalized name.", "index": idx}, open(out, "w"), indent=0)
print({k: len(v) for k, v in idx.items()})
