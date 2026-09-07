// In-Foundry regression check: imports every sample into temporary actors, compares the sheet's
// derived numbers with samples/expected-derived.json, and deletes the actors again.
// Run from the console:  await game.modules.get("daggerheart-character-import").api.selfTest()
import { MODULE_ID, log } from "./constants.mjs";
import { importFile } from "./import.mjs";
import { importHomebrewSource, removeHomebrewSource } from "./homebrew.mjs";

const SAMPLES = ["level1-bard.json", "level5-ranger-multiclass.json", "legacy-pre-levels.json"];

export async function selfTest({ keep = false } = {}) {
  const base = `modules/${MODULE_ID}/samples/`;
  const expected = await (await fetch(`${base}expected-derived.json`)).json();
  const failures = [];
  const checked = [];
  const created = [];
  const check = (label, actual, want) => {
    checked.push(label);
    if (JSON.stringify(actual) !== JSON.stringify(want)) failures.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(want)}`);
  };
  for (const file of SAMPLES) {
    const text = await (await fetch(base + file)).text();
    const results = await importFile(text);
    for (const r of results) {
      if (!r.actor) { failures.push(`${file}: ${r.name} not imported: ${r.fatal.join("; ")}`); continue; }
      created.push(r.actor);
      const a = r.actor, s = a.system;
      const id = a.getFlag(MODULE_ID, "builder")?.id;
      const exp = expected[id]?.statsSummary;
      const errors = r.report.filter((x) => x.level === "warn" && !/no level-up history/.test(x.message));
      check(`${a.name} warnings`, errors.map((x) => x.message), []);
      if (!exp) continue;
      check(`${a.name} HP max`, s.resources.hitPoints.max, exp.hitPoints);
      check(`${a.name} Stress max`, s.resources.stress.max, exp.stress);
      check(`${a.name} Evasion`, s.evasion, exp.evasion);
      check(`${a.name} Armor`, s.armorScore.max, exp.armorScore);
      check(`${a.name} thresholds`, s.damageThresholds, exp.thresholds);
      check(`${a.name} Proficiency`, s.proficiency, exp.proficiency);
      check(`${a.name} traits`, Object.fromEntries(Object.entries(s.traits).map(([k, v]) => [k, v.value])), exp.traits);
      const sheet = expected[id].sheet;
      check(`${a.name} experiences`, Object.values(s.experiences).map((e) => `${e.name} ${e.value >= 0 ? "+" : ""}${e.value}`), sheet.experiences.map((e) => `${e.name} ${e.display}`));
      check(`${a.name} level`, s.levelData.level.current, sheet.level);
      check(`${a.name} class`, s.class.value?.name, sheet.className);
      check(`${a.name} subclass`, s.class.subclass?.name, sheet.subclassName);
      check(`${a.name} ancestry`, s.ancestry?.name, sheet.ancestryNames.join("/"));
      check(`${a.name} community`, s.community?.name, sheet.communityName);
      check(`${a.name} armor name`, s.armor?.name ?? "—", sheet.armorName);
      check(`${a.name} weapons`, [s.primaryWeapon?.name, s.secondaryWeapon?.name].filter(Boolean), sheet.weapons.map((w) => w.name));
    }
  }
  // ---- homebrew: import the sample source into a world compendium, then a character that uses it ----
  let homebrew = null;
  try {
    const names = ["source.json", "classes.json", "subclasses.json", "ancestries.json", "communities.json", "transformations.json", "domain-cards.json", "items.json", "weapons.json", "armors.json", "consumables.json", "effects.json"];
    const files = await Promise.all(names.map(async (n) => ({ name: n, text: await (await fetch(`${base}homebrew/tinker/${n}`)).text() })));
    homebrew = await importHomebrewSource(files);
    check("homebrew items", [homebrew.created, homebrew.warnings], [31, []]);
    check("homebrew domain registered", CONFIG.DH.DOMAIN.allDomains().gears?.id, "gears");
    check("homebrew custom item features registered", [CONFIG.DH.ITEM.allWeaponFeatures()["dhci-tinker-coiled"]?.name, CONFIG.DH.ITEM.allArmorFeatures()["dhci-tinker-greased"]?.name], ["Coiled", "Greased"]);
    check("homebrew pack searched", game.settings.get(MODULE_ID, "packs").includes(homebrew.pack.collection), true);
    const packDocs = await homebrew.pack.getDocuments();
    const packDoc = (n) => packDocs.find((d) => d.name === n);
    check("homebrew weapon feature applied by the system", [packDoc("Wrench Hammer")?.system.weaponFeatures.map((f) => [f.value, f.effectIds.length]), packDoc("Wrench Hammer")?.effects.size], [[["reliable", 1]], 1]);
    check("homebrew armor feature applied by the system", [packDoc("Brass Plate")?.system.armorFeatures.map((f) => [f.value, f.effectIds.length]), packDoc("Gasket Weave")?.system.armorFeatures.map((f) => f.value)], [[["flexible", 1]], ["dhci-tinker-greased"]]);
    check("homebrew effects.json on features", [packDoc("Steady Gears")?.effects.contents[0]?.changes?.[0]?.key ?? packDoc("Steady Gears")?.effects.contents[0]?.system.changes[0].key, packDoc("Gear Toss")?.system.vaultActive], ["system.traits.instinct.value", true]);
    const results = await importFile(await (await fetch(`${base}homebrew-level1-tinker.json`)).text());
    const r = results[0];
    if (!r.actor) failures.push(`tinker not imported: ${r.fatal.join("; ")}`);
    else {
      created.push(r.actor);
      const a = r.actor, s = a.system;
      check("tinker warnings", r.report.filter((x) => x.level === "warn").map((x) => x.message), []);
      check("tinker class", [s.class.value?.name, s.class.subclass?.name], ["Tinker", "Clockwright"]);
      check("tinker heritage", [s.ancestry?.name, s.community?.name, a.items.find((i) => i.type === "transformation")?.name], ["Cogborn", "Guildborne", "Clockwork Heart"]);
      // class 6 HP + Precision Tools; 6 Stress + Ticking Resolve; class 11 Evasion + Flexible + Gear Toss; Instinct 0 + Steady Gears; Jury-Rig +1 attack
      check("tinker HP/stress/evasion", [s.resources.hitPoints.max, s.resources.stress.max, s.evasion], [7, 7, 13]);
      check("tinker instinct and attack bonus from effects.json", [s.traits.instinct.value, s.bonuses.roll.attack.bonus], [1, 1]);
      check("tinker domain cards", a.items.filter((i) => i.type === "domainCard").map((i) => [i.name, i.system.domain]).sort(), [["Book of Ava", "codex"], ["Gear Toss", "gears"]]);
      const features = a.items.filter((i) => i.type === "feature").map((i) => i.name);
      check("tinker features granted", ["Spare Parts", "Jury-Rig", "Field Repair", "Wind-Up Companion", "Precision Tools", "Steady Gears", "Oil-Slick", "Union Card", "Ticking Resolve", "Wind-Down"].filter((n) => !features.includes(n)), []);
      check("tinker gear", [s.primaryWeapon?.name, s.secondaryWeapon?.name, s.armor?.name, a.items.filter((i) => i.type === "consumable").map((i) => i.name)], ["Wrench Hammer", "Spring Dagger", "Brass Plate", ["Oil Flask"]]);
      check("tinker armor score", s.armorScore?.max, 4);
      check("tinker starting kit", a.items.filter((i) => i.type === "loot").map((i) => i.name).sort(), ["A half-built clockwork sparrow", "A roll of well-worn tools"]);
      check("tinker background questions", s.biography.background.includes("What did you build that you wish you hadn"), true);
    }
    // a second import of the source replaces the same documents (ids are stable)
    const again = await importHomebrewSource(files);
    check("homebrew re-import replaces in place", [again.created, again.replaced, again.domainsAdded], [31, 31, []]);
  } catch (err) {
    console.error(err);
    failures.push(`homebrew: ${err.message}`);
  }
  if (!keep) for (const a of created) await a.delete();
  if (!keep && homebrew) await removeHomebrewSource("tinker", { deleteDomains: true });
  const summary = { ok: failures.length === 0, checks: checked.length, failures, actors: created.map((a) => a.name) };
  log("self-test", summary);
  ui.notifications[summary.ok ? "info" : "error"](`${MODULE_ID}: self-test ${summary.ok ? "passed" : "FAILED"} (${checked.length} checks, ${failures.length} failures)`);
  return summary;
}
