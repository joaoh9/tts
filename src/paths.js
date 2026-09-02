import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(thisDir, "..");

export function expandHome(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

export function libraryRoot(env = process.env) {
  return path.resolve(expandHome(env.TTS_LIBRARY_DIR || path.join("~", "TTS")));
}

export function cacheRoot(env = process.env) {
  return path.resolve(
    expandHome(env.TTS_CACHE_DIR || path.join("~", ".cache", "tts-workbench")),
  );
}

export function piperModelsDir(env = process.env) {
  return path.resolve(
    expandHome(env.PIPER_MODELS_DIR || path.join(cacheRoot(env), "piper")),
  );
}

export function kokoroCacheDir(env = process.env) {
  return path.join(cacheRoot(env), "kokoro");
}

export function voicesPath() {
  return path.join(PROJECT_ROOT, "voices.json");
}

export function publicDir() {
  return path.join(PROJECT_ROOT, "public");
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dateStamp(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function libraryDayDir(root, now = new Date()) {
  return path.join(root, dateStamp(now));
}
