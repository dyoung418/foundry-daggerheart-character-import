import { escapeHtml } from "../lib/plan.mjs";

/** Shows what happened, per character, after an import run. */
export async function showReport(results) {
  const sections = results.map((r) => {
    const title = r.actor ? `<a class="content-link" data-uuid="${r.actor.uuid}" data-link><i class="fa-solid fa-user"></i> ${escapeHtml(r.actor.name)}</a>` : `<strong>${escapeHtml(r.name)}</strong>`;
    const lines = r.report.filter((x) => x.level !== "info");
    const infos = r.report.filter((x) => x.level === "info");
    const status = r.fatal?.length
      ? `<p class="dhci-fatal">${escapeHtml(game.i18n.format("DHCI.Report.Failed", { name: r.name, reasons: r.fatal.join("; ") }))}</p>`
      : "";
    const list = lines.length
      ? `<ul>${lines.map((x) => `<li class="dhci-${x.level}">${escapeHtml(x.message)}</li>`).join("")}</ul>`
      : (r.fatal?.length ? "" : `<p>${game.i18n.localize("DHCI.Report.NoIssues")}</p>`);
    const notes = infos.length ? `<ul class="dhci-info">${infos.map((x) => `<li>${escapeHtml(x.message)}</li>`).join("")}</ul>` : "";
    return `<section class="dhci-report-item"><h3>${title}</h3>${status}${list}${notes}</section>`;
  });
  const done = results.filter((r) => r.actor).length;
  const content = `<div class="dhci-report"><p>${escapeHtml(game.i18n.format("DHCI.Report.Done", { count: done }))}</p>${sections.join("")}</div>`;
  return foundry.applications.api.DialogV2.prompt({
    window: { title: "DHCI.Report.Title", icon: "fa-solid fa-clipboard-check" },
    classes: ["daggerheart", "dh-style", "dhci-report-dialog"],
    position: { width: 520 },
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" },
    rejectClose: false,
  });
}
