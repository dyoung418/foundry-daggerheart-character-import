// In-Foundry regression check: imports every sample into temporary actors, compares the sheet's
// derived numbers with samples/expected-derived.json, and deletes the actors again.
// Run from the console:  await game.modules.get("daggerheart-character-import").api.selfTest()
import { MODULE_ID, log } from "./constants.mjs";
import { importFile } from "./import.mjs";

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
  if (!keep) for (const a of created) await a.delete();
  const summary = { ok: failures.length === 0, checks: checked.length, failures, actors: created.map((a) => a.name) };
  log("self-test", summary);
  ui.notifications[summary.ok ? "info" : "error"](`${MODULE_ID}: self-test ${summary.ok ? "passed" : "FAILED"} (${checked.length} checks, ${failures.length} failures)`);
  return summary;
}
