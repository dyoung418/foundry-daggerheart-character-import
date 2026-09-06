import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { DEFAULT_PACKS } from "./matcher.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.packs, {
    name: "DHCI.Settings.Packs.Name",
    hint: "DHCI.Settings.Packs.Hint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_PACKS.join(", "),
  });
  game.settings.register(MODULE_ID, SETTINGS.portraitFolder, {
    name: "DHCI.Settings.PortraitFolder.Name",
    hint: "DHCI.Settings.PortraitFolder.Hint",
    scope: "world",
    config: true,
    type: String,
    default: `${MODULE_ID}/portraits`,
  });
  game.settings.register(MODULE_ID, SETTINGS.addStartingKit, {
    name: "DHCI.Settings.AddStartingKit.Name",
    hint: "DHCI.Settings.AddStartingKit.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, SETTINGS.actorFolder, {
    name: "DHCI.Settings.ActorFolder.Name",
    hint: "DHCI.Settings.ActorFolder.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });
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

export function levelupAuto() {
  try {
    return game.settings.get("daggerheart", "Automation")?.levelupAuto ?? true;
  } catch {
    return true;
  }
}
