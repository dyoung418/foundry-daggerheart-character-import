export const MODULE_ID = "daggerheart-character-import";
export const SETTINGS = { logLevel: "logLevel", packs: "packs", portraitFolder: "portraitFolder", addStartingKit: "addStartingKit", actorFolder: "actorFolder", homebrewSources: "homebrewSources" };

export function log(...args) {
  console.log(`${MODULE_ID} |`, ...args);
}
export function debug(...args) {
  let level = "info";
  try { level = game.settings.get(MODULE_ID, SETTINGS.logLevel); } catch { /* before init */ }
  if (level === "debug") console.debug(`${MODULE_ID} |`, ...args);
}
