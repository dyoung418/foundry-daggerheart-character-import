// File uploads into the user data folder. Builder portraits are data URLs; Foundry's actor `img`
// must be a file path, so they are uploaded to the folder configured in settings. Homebrew card art
// goes through the same helper.
import { MODULE_ID, SETTINGS, log } from "./constants.mjs";

export async function uploadPortrait(dataUrl, baseName) {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const folder = game.settings.get(MODULE_ID, SETTINGS.portraitFolder) || `${MODULE_ID}/portraits`;
  const m = /^data:image\/(webp|jpeg|png);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const safe = (baseName || "portrait").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) || "portrait";
  const file = new File([bytes], `${safe}-${Date.now()}.${ext}`, { type: `image/${m[1]}` });
  return uploadFile(folder, file);
}

/**
 * Upload a File to `folder` under the user data root (created if missing).
 * @returns {Promise<string|null>} the stored path, or null on any failure
 */
export async function uploadFile(folder, file) {
  if (!game.user.can("FILES_UPLOAD")) { log("no FILES_UPLOAD permission; upload skipped"); return null; }
  const FP = foundry.applications.apps.FilePicker.implementation;
  try {
    await ensureFolder(FP, folder);
    const res = await FP.upload("data", folder, file, {}, { notify: false });
    return res?.path ?? null;
  } catch (err) {
    log(`upload of ${file?.name} failed`, err);
    return null;
  }
}

async function ensureFolder(FP, folder) {
  const parts = folder.split("/").filter(Boolean);
  let path = "";
  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    try { await FP.createDirectory("data", path); } catch (err) {
      if (!/EEXIST|already exists/i.test(String(err?.message ?? err))) throw err;
    }
  }
}
