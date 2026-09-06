import { MODULE_ID, SETTINGS, debug } from "../foundry/constants.mjs";
import { parseSourceFiles, describeSource, artKey } from "../lib/homebrew.mjs";
import { importHomebrewSource, removeHomebrewSource } from "../foundry/homebrew.mjs";
import { escapeHtml } from "../lib/plan.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const IMAGE_RE = /\.(png|webp|jpe?g|svg)$/i;

/**
 * Imports a builder homebrew source: the user picks the source folder's JSON files (and card art)
 * and the module turns them into a world compendium the character importer can match against.
 */
export class HomebrewDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor() {
    super({});
    this.files = [];
    this.parsed = null;
    this.images = 0;
  }

  static DEFAULT_OPTIONS = {
    id: "dhci-homebrew-dialog",
    tag: "form",
    classes: ["daggerheart", "dh-style", "dhci-dialog"],
    window: { title: "DHCI.Homebrew.Title", icon: "fa-solid fa-flask", resizable: true },
    position: { width: 520, height: "auto" },
    actions: { import: HomebrewDialog.#onImport, clear: HomebrewDialog.#onClear, remove: HomebrewDialog.#onRemove },
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/homebrew-dialog.hbs` } };

  async _prepareContext() {
    const sources = game.settings.get(MODULE_ID, SETTINGS.homebrewSources) ?? {};
    return {
      isGM: game.user.isGM,
      summary: this.parsed?.ok ? describeSource(this.parsed.source) : null,
      error: this.parsed && !this.parsed.ok ? this.parsed.error : null,
      images: this.images,
      fileCount: this.files.length,
      ignored: this.parsed?.ignored ?? [],
      canImport: Boolean(this.parsed?.ok) && game.user.isGM && !this.busy,
      existing: Object.entries(sources).map(([id, s]) => ({ id, label: s.label, pack: s.pack, packLabel: game.packs.get(s.pack)?.metadata.label ?? s.pack, importedAt: s.importedAt?.slice(0, 10), counts: s.counts, domains: s.domains ?? [] })),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const input of this.element.querySelectorAll('input[type="file"]')) {
      input.addEventListener("change", (ev) => this.#readFiles([...(ev.target.files ?? [])]));
    }
  }

  /** Picks accumulate (the browser's picker takes one folder at a time: JSON, then card-art/domain, then card-art/subclass). */
  async #readFiles(files) {
    // A folder pick includes everything below it (card-art/domain, card-art/subclass); keep only
    // JSON and images, deduplicated by file name.
    const known = new Set(this.files.map((f) => f.name));
    const wanted = files.filter((f) => /\.json$/i.test(f.name) || IMAGE_RE.test(f.name));
    this.files = [...this.files, ...wanted.filter((f) => !known.has(f.name))];
    this.images = this.files.filter((f) => IMAGE_RE.test(f.name) && artKey(f.name)).length;
    const texts = await Promise.all(this.files.filter((f) => !IMAGE_RE.test(f.name)).map(async (f) => ({ name: f.name, text: await f.text() })));
    this.parsed = texts.length ? parseSourceFiles(texts) : null;
    debug("homebrew parsed", this.parsed);
    this.render();
  }

  /** Remove a source imported earlier: its compendium documents (and the pack), the pack-list entry, optionally its domains. */
  static async #onRemove(event, target) {
    const sourceId = target.dataset.sourceId;
    const entry = (game.settings.get(MODULE_ID, SETTINGS.homebrewSources) ?? {})[sourceId];
    if (!entry || this.busy) return;
    const packLabel = game.packs.get(entry.pack)?.metadata.label ?? entry.pack;
    const domains = entry.domains ?? [];
    const usedBy = game.actors.filter((a) => a.items.some((i) => String(i._stats?.compendiumSource ?? "").includes(`Compendium.${entry.pack}.`))).map((a) => a.name);
    const f = (key, data = {}) => escapeHtml(game.i18n.format(key, data));
    const content = `<div class="dhci-report">
      <p>${f("DHCI.Homebrew.RemoveWhat", { label: entry.label, count: entry.counts?.items ?? "?", pack: packLabel })}</p>
      <ul><li>${f("DHCI.Homebrew.RemovePack")}</li><li>${f("DHCI.Homebrew.RemoveSetting")}</li>${usedBy.length ? `<li class="dhci-warn">${f("DHCI.Homebrew.RemoveActors", { actors: usedBy.join(", ") })}</li>` : ""}</ul>
      ${domains.length ? `<label class="dhci-check"><input type="checkbox" name="deleteDomains"> ${f("DHCI.Homebrew.RemoveDomains", { domains: domains.join(", ") })}</label>` : ""}
    </div>`;
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: "DHCI.Homebrew.RemoveTitle", icon: "fa-solid fa-trash" },
      classes: ["daggerheart", "dh-style", "dhci-report-dialog"],
      position: { width: 480 },
      content,
      buttons: [
        { action: "remove", label: "DHCI.Homebrew.RemoveConfirm", icon: "fa-solid fa-trash", callback: (_ev, button) => ({ deleteDomains: button.form?.elements.deleteDomains?.checked ?? false }) },
        { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark", default: true },
      ],
      rejectClose: false,
    });
    if (!choice || choice === "cancel") return;
    this.busy = true;
    try {
      const result = await removeHomebrewSource(sourceId, { deleteDomains: choice.deleteDomains });
      ui.notifications.info(game.i18n.format("DHCI.Homebrew.Removed", { label: entry.label, count: result.deleted }));
      for (const w of result.warnings ?? []) ui.notifications.warn(w);
    } catch (err) {
      console.error(err);
      ui.notifications.error(game.i18n.format("DHCI.Homebrew.RemoveFailed", { error: err.message }));
    } finally {
      this.busy = false;
      this.render();
    }
  }

  static #onClear() {
    this.files = [];
    this.parsed = null;
    this.images = 0;
    this.render();
  }

  static async #onImport() {
    if (!this.parsed?.ok || this.busy) return;
    this.busy = true;
    const button = this.element.querySelector("[data-action=import]");
    button.disabled = true;
    try {
      const result = await importHomebrewSource(this.files, { progress: (step) => { button.textContent = game.i18n.format("DHCI.Homebrew.Step", { step }); } });
      ui.notifications.info(game.i18n.format("DHCI.Homebrew.Done", { label: result.source.label, count: result.created, pack: result.pack.metadata.label }));
      await this.close();
      await showHomebrewReport(result);
    } catch (err) {
      console.error(err);
      ui.notifications.error(game.i18n.format("DHCI.Homebrew.Failed", { error: err.message }));
      this.busy = false;
      this.render();
    }
  }
}

async function showHomebrewReport(result) {
  const li = (s) => `<li>${escapeHtml(s)}</li>`;
  const lines = [
    game.i18n.format("DHCI.Homebrew.ReportItems", { count: result.created, replaced: result.replaced, pack: result.pack.metadata.label }),
    result.domainsAdded.length ? game.i18n.format("DHCI.Homebrew.ReportDomains", { domains: result.domainsAdded.join(", ") }) : null,
    ...result.ignored.map((f) => game.i18n.format("DHCI.Homebrew.ReportIgnored", { file: f })),
  ].filter(Boolean);
  const warnings = result.warnings.map((w) => `<li class="dhci-warn">${escapeHtml(w)}</li>`).join("");
  const content = `<div class="dhci-report"><p>${escapeHtml(describeSource(result.source))}</p><ul>${lines.map(li).join("")}</ul>${warnings ? `<ul>${warnings}</ul>` : ""}<p>${escapeHtml(game.i18n.localize("DHCI.Homebrew.ReportNext"))}</p></div>`;
  return foundry.applications.api.DialogV2.prompt({
    window: { title: "DHCI.Homebrew.Title", icon: "fa-solid fa-flask" },
    classes: ["daggerheart", "dh-style", "dhci-report-dialog"],
    position: { width: 520 },
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" },
    rejectClose: false,
  });
}
