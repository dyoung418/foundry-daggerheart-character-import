// Daggerheart Character Import — entry point.
import { MODULE_ID, log } from "./foundry/constants.mjs";
import { registerSettings } from "./foundry/settings.mjs";
import { ImportDialog } from "./app/import-dialog.mjs";
import { parseTransferFile } from "./lib/normalize.mjs";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  mod.api = {
    /** Open the import dialog, optionally targeting an existing actor. */
    open: (options = {}) => new ImportDialog(options).render({ force: true }),
    parseTransferFile,
  };
  log("ready");
});

/** Button in the Actors sidebar header. `html` is an HTMLElement in v13+. */
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.can("ACTOR_CREATE")) return;
  const el = html instanceof HTMLElement ? html : html[0];
  const actions = el?.querySelector(".header-actions");
  if (!actions) return log("no .header-actions in ActorDirectory; sidebar button not added");
  actions.querySelector(".dhci-open")?.remove();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dhci-open";
  button.innerHTML = `<i class="fa-solid fa-file-import"></i> ${game.i18n.localize("DHCI.Sidebar.Button")}`;
  button.addEventListener("click", () => new ImportDialog().render({ force: true }));
  actions.append(button);
});

/** Header control on the system's character sheet: import into / update this actor. */
Hooks.on("getHeaderControlsCharacterSheet", (sheet, controls) => {
  const actor = sheet.document ?? sheet.actor;
  if (!actor?.isOwner || actor.type !== "character" || !game.user.can("ACTOR_CREATE")) return;
  controls.push({
    icon: "fa-solid fa-file-import",
    label: "DHCI.Sheet.Control",
    action: "dhciImport",
    onClick: () => new ImportDialog({ actor }).render({ force: true }),
  });
});
