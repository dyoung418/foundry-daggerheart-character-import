// Ancestry composition. Pure.
//
// The system stores one `ancestry` item per character. A mixed ancestry is one item named "A/B"
// whose `system.features` hold A's primary and B's secondary (that is what the system's own
// character-creation wizard writes). The builder records the two chosen feature names instead,
// so we map each chosen name to its position in that ancestry's feature list.

/**
 * @param {object} heritage   builder `heritage`
 * @param {object} ctx
 * @param {(ancestryId: string) => { uuid, name, features: [{type, item}] } | null} ctx.ancestry
 * @param {(ancestryId: string) => string[]} ctx.featureNames   builder feature names in order
 * @param {(msg: string) => void} [ctx.warn]
 * @returns {{ uuid: string, name: string, features: [{type:'primary',item},{type:'secondary',item}] | null, composed: boolean } | null}
 */
export function composeAncestry(heritage, ctx) {
  const warn = ctx.warn ?? (() => {});
  const ids = heritage?.ancestryIds ?? [];
  if (!ids.length) return null;
  const primaryId = ids[0];
  const primary = ctx.ancestry(primaryId);
  if (!primary) { warn(`ancestry ${primaryId} not found`); return null; }
  if (heritage.ancestryMode !== "mixed" || ids.length < 2) {
    return { uuid: primary.uuid, name: primary.name, features: null, composed: false };
  }
  const secondaryId = ids[1];
  const secondary = ctx.ancestry(secondaryId);
  if (!secondary) { warn(`second ancestry ${secondaryId} not found; using ${primary.name} alone`); return { uuid: primary.uuid, name: primary.name, features: null, composed: false }; }

  // Which slot (0 = primary, 1 = secondary) did the builder pick from each ancestry?
  const slotOf = (ancestryId) => {
    const chosen = (heritage.chosenFeatures ?? []).find((c) => c.ancestryId === ancestryId);
    if (!chosen) return null;
    const names = ctx.featureNames(ancestryId) ?? [];
    const at = names.findIndex((n) => sameName(n, chosen.featureName));
    return at >= 0 ? at : null;
  };
  const sysFeature = (entry, type) => entry.features?.find((f) => f.type === type)?.item ?? entry.features?.[type === "primary" ? 0 : 1]?.item ?? null;
  const pSlot = slotOf(primaryId), sSlot = slotOf(secondaryId);
  let first = primary, second = secondary;
  if (pSlot === 1 && sSlot === 0) [first, second] = [secondary, primary];
  else if (pSlot !== null && sSlot !== null && pSlot === sSlot) warn(`mixed ancestry chose two ${pSlot === 0 ? "primary" : "secondary"} features (${primary.name}, ${secondary.name}); the system needs one of each, using ${first.name}'s ${pSlot === 0 ? "primary" : "secondary"} and ${second.name}'s ${pSlot === 0 ? "secondary" : "primary"}`);
  const features = [
    { type: "primary", item: sysFeature(first, "primary") },
    { type: "secondary", item: sysFeature(second, "secondary") },
  ];
  if (!features[0].item || !features[1].item) warn(`could not find both ancestry features for ${primary.name}/${secondary.name}`);
  return { uuid: primary.uuid, name: `${primary.name}/${secondary.name}`, features, composed: true };
}

function sameName(a, b) {
  const n = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const x = n(a), y = n(b);
  return x === y || (x.length > 4 && y.length > 4 && (x.startsWith(y) || y.startsWith(x)));
}
