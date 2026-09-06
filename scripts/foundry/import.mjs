// The import pipeline used by the dialog and by the module API.
import { MODULE_ID, SETTINGS, log } from "./constants.mjs";
import { CompendiumMatcher } from "./matcher.mjs";
import { applyPlan } from "./writer.mjs";
import { levelupAuto } from "./settings.mjs";
import { buildPlan } from "../lib/plan.mjs";
import { parseTransferFile } from "../lib/normalize.mjs";

/**
 * Import characters from a parsed transfer file.
 * @param {object} parsed          result of parseTransferFile (ok: true)
 * @param {number[]} indexes       which characters
 * @param {object} [options]
 * @param {Actor} [options.actor]  update this actor (single character only)
 * @param {(name: string, step: string) => void} [options.progress]
 * @returns {Promise<Array<{ name, actor: Actor|null, fatal: string[], report: object[] }>>}
 */
export async function importCharacters(parsed, indexes, { actor = null, progress = () => {} } = {}) {
  const matcher = await new CompendiumMatcher().load();
  const options = {
    levelupAuto: levelupAuto(),
    addStartingKit: game.settings.get(MODULE_ID, SETTINGS.addStartingKit),
    moduleId: MODULE_ID,
    fileMeta: { version: parsed.version, exportedAt: parsed.exportedAt },
  };
  const results = [];
  for (const index of indexes) {
    const ch = parsed.characters[index];
    if (!ch) continue;
    const plan = buildPlan(ch, matcher, options);
    log("plan", plan);
    if (!plan.ok) {
      results.push({ name: plan.name, actor: null, fatal: plan.fatal, report: plan.report });
      continue;
    }
    try {
      const { actor: created, report } = await applyPlan(plan, { actor: indexes.length === 1 ? actor : null, progress: (step) => progress(plan.name, step) });
      results.push({ name: plan.name, actor: created, fatal: [], report });
    } catch (err) {
      console.error(err);
      results.push({ name: plan.name, actor: null, fatal: [String(err?.message ?? err)], report: plan.report });
    }
  }
  return results;
}

/** Convenience for macros: import every character (or `indexes`) from a JSON string. */
export async function importFile(json, { indexes = null, actor = null } = {}) {
  const parsed = parseTransferFile(json);
  if (!parsed.ok) throw new Error(parsed.error);
  return importCharacters(parsed, indexes ?? parsed.characters.map((_, i) => i), { actor });
}
