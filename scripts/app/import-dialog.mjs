import { MODULE_ID, debug } from "../foundry/constants.mjs";
import { parseTransferFile, summarize } from "../lib/normalize.mjs";
import { bareId } from "../lib/ids.mjs";
import { importCharacters, existingActorFor } from "../foundry/import.mjs";
import { showReport } from "./report-dialog.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

let NAMES = null;
async function loadNames() {
  if (NAMES) return NAMES;
  try {
    const res = await fetch(`modules/${MODULE_ID}/data/names.json`);
    NAMES = res.ok ? (await res.json()).names : {};
  } catch {
    NAMES = {};
  }
  return NAMES;
}

/**
 * Phase 0: reads a builder file (picked or pasted), lists the characters it holds, and lets the
 * user tick the ones to import. The Import button is wired to a not-implemented notice.
 */
export class ImportDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ actor = null } = {}) {
    super({});
    this.actor = actor;
    this.parsed = null;
    this.selected = new Set();
    this.pasted = "";
  }

  static DEFAULT_OPTIONS = {
    id: "dhci-import-dialog",
    tag: "form",
    classes: ["daggerheart", "dh-style", "dhci-dialog"],
    window: { title: "DHCI.Dialog.Title", icon: "fa-solid fa-file-import", resizable: true },
    position: { width: 520, height: "auto" },
    actions: {
      parsePasted: ImportDialog.#onParsePasted,
      toggleCharacter: ImportDialog.#onToggle,
      import: ImportDialog.#onImport,
    },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/import-dialog.hbs` },
  };

  async _prepareContext() {
    const names = await loadNames();
    const nameOf = (id) => names[bareId(id)] ?? id;
    const characters = (this.parsed?.characters ?? []).map((ch, index) => ({
      index,
      name: ch.name || "(unnamed)",
      level: ch.level,
      summary: summarize(ch, nameOf),
      selected: this.selected.has(index),
      updates: (this.actor ?? existingActorFor(ch))?.name ?? null,
    }));
    return {
      targetActor: this.actor,
      pasted: this.pasted,
      characters,
      canImport: this.selected.size > 0,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const input = this.element.querySelector('input[type="file"]');
    input?.addEventListener("change", (ev) => this.#readFile(ev.target.files?.[0]));
    const ta = this.element.querySelector("textarea[name=pasted]");
    ta?.addEventListener("input", () => { this.pasted = ta.value; });
  }

  async #readFile(file) {
    if (!file) return;
    this.#setParsed(await file.text());
  }

  #setParsed(text) {
    const result = parseTransferFile(text);
    if (!result.ok) {
      ui.notifications.error(game.i18n.format("DHCI.Notifications.ParseFailed", { error: result.error }));
      this.parsed = null;
      this.selected.clear();
    } else {
      this.parsed = result;
      this.selected = new Set(result.characters.map((_, i) => i));
      if (this.actor && result.characters.length > 1) this.selected = new Set([0]);
      debug("parsed", result);
    }
    this.render();
  }

  static #onParsePasted() {
    const ta = this.element.querySelector("textarea[name=pasted]");
    if (ta?.value.trim()) this.#setParsed(ta.value);
  }

  static #onToggle(event, target) {
    const index = Number(target.dataset.index);
    if (target.checked) this.selected.add(index); else this.selected.delete(index);
    if (this.actor && this.selected.size > 1) this.selected = new Set([index]);
    this.render();
  }

  static async #onImport() {
    if (!this.parsed || !this.selected.size || this.busy) return;
    this.busy = true;
    const button = this.element.querySelector('[data-action=import]');
    button.disabled = true;
    const indexes = [...this.selected].sort((a, b) => a - b);
    try {
      const results = await importCharacters(this.parsed, indexes, {
        actor: this.actor,
        progress: (name, step) => { button.textContent = game.i18n.format("DHCI.Dialog.Step", { name, step }); },
      });
      for (const r of results) {
        if (r.actor) ui.notifications.info(game.i18n.format("DHCI.Notifications.Done", { name: r.actor.name }));
        else ui.notifications.error(game.i18n.format("DHCI.Notifications.Fatal", { name: r.name, reasons: r.fatal.join("; ") }));
      }
      await this.close();
      await showReport(results);
      results.find((r) => r.actor)?.actor.sheet.render({ force: true });
    } finally {
      this.busy = false;
    }
  }
}
