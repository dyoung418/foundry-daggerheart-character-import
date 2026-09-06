import { MODULE_ID, SETTINGS } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.logLevel, {
    name: "DHCI.Settings.LogLevel.Name",
    hint: "DHCI.Settings.LogLevel.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: { info: "info", debug: "debug" },
    default: "info",
  });
}
