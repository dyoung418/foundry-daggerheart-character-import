#!/usr/bin/env python3
"""Exact-name match rate between the builder's SRD data and the Daggerheart system compendia.

Usage: tools/name-match.py <builder-data-dir> <system-src-packs-dir> [report.json]
  e.g. tools/name-match.py ~/daggerheart-character-builder/data/srd_2_0 <clone>/src/packs
"""
import collections, glob, json, os, re, sys, unicodedata

def norm(s):
    s = unicodedata.normalize("NFKD", s).replace("’", "'").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

builder, packs = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else None
sys_names = collections.defaultdict(dict)
for f in glob.glob(os.path.join(packs, "**", "*.json"), recursive=True):
    d = json.load(open(f))
    if "type" in d and "name" in d:
        sys_names[d["type"]][norm(d["name"])] = d.get("_id")

pairs = [("classes", "class", lambda r: r["name"].title()), ("subclasses", "subclass", None),
         ("ancestries", "ancestry", None), ("communities", "community", None),
         ("domain-cards", "domainCard", None), ("weapons", "weapon", None), ("armors", "armor", None),
         ("consumables", "consumable", None), ("transformations", "transformation", None)]
report = {}
for file, typ, fn in pairs:
    path = os.path.join(builder, file + ".json")
    if not os.path.exists(path):
        continue
    recs = json.load(open(path))
    miss = []
    for r in recs:
        n = fn(r) if fn else r["name"]["en-US"]
        if norm(n) not in sys_names[typ]:
            miss.append((r["id"], n))
    report[typ] = {"builder": len(recs), "matched": len(recs) - len(miss), "missing": miss}
    print(f"{typ}: {len(recs) - len(miss)}/{len(recs)} exact-name matches; system has {len(sys_names[typ])}")
    for m in miss[:12]:
        print("   miss", m)
if out:
    json.dump(report, open(out, "w"), indent=1)
