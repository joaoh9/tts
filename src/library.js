import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, libraryDayDir, libraryRoot } from "./paths.js";
import { slugify, uniqueSlug } from "./slug.js";

export function formatSidecar({ text, engine, voice, voiceId, speed, created }) {
  return [
    "# tts-workbench take",
    `created: ${created}`,
    `engine: ${engine}`,
    `voice: ${voice}`,
    `voice_id: ${voiceId}`,
    `speed: ${speed}`,
    "---",
    "",
    text,
    "",
  ].join("\n");
}

export async function saveTake({
  text,
  audio,
  voice,
  root = libraryRoot(),
  now = new Date(),
  extraDir,
}) {
  const dayDir = libraryDayDir(root, now);
  ensureDir(dayDir);
  const base = await allocateSlug(dayDir, slugify(text));
  const mp3Path = path.join(dayDir, `${base}.mp3`);
  const txtPath = path.join(dayDir, `${base}.txt`);
  const created = now.toISOString();
  await fs.writeFile(mp3Path, audio);
  await fs.writeFile(
    txtPath,
    formatSidecar({
      text,
      engine: voice.engine,
      voice: voice.name,
      voiceId: voice.voice,
      speed: voice.speed,
      created,
    }),
    "utf8",
  );

  let copyPath = null;
  if (extraDir) {
    ensureDir(extraDir);
    copyPath = path.join(extraDir, `${base}.mp3`);
    await fs.copyFile(mp3Path, copyPath);
  }

  return {
    slug: base,
    day: path.basename(dayDir),
    mp3Path,
    txtPath,
    copyPath,
    created,
    bytes: audio.length,
  };
}

async function allocateSlug(dayDir, base) {
  const entries = await fs.readdir(dayDir).catch((err) => {
    if (err.code === "ENOENT") return [];
    throw err;
  });
  const existing = entries
    .filter((name) => name.endsWith(".mp3") || name.endsWith(".txt"))
    .map((name) => name.replace(/\.(mp3|txt)$/, ""));
  return uniqueSlug(existing, base);
}

export async function listTakes({ root = libraryRoot(), limit = 20 } = {}) {
  let days;
  try {
    days = (await fs.readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  const takes = [];
  for (const day of days) {
    const dir = path.join(root, day);
    const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".mp3")).sort().reverse();
    for (const file of files) {
      const slug = file.replace(/\.mp3$/, "");
      const mp3Path = path.join(dir, file);
      const txtPath = path.join(dir, `${slug}.txt`);
      const stat = await fs.stat(mp3Path);
      let preview = "";
      let engine = "";
      let voice = "";
      try {
        const sidecar = await fs.readFile(txtPath, "utf8");
        engine = matchField(sidecar, "engine") || "";
        voice = matchField(sidecar, "voice") || "";
        preview = sidecar.split("---").slice(1).join("---").trim().slice(0, 140);
      } catch {
        // sidecar is best-effort for the tape log
      }
      takes.push({
        day,
        slug,
        engine,
        voice,
        preview,
        bytes: stat.size,
        created: stat.mtime.toISOString(),
        url: `/api/takes/${day}/${encodeURIComponent(slug)}.mp3`,
      });
      if (takes.length >= limit) return takes;
    }
  }
  return takes;
}

function matchField(sidecar, key) {
  const line = sidecar.split("\n").find((row) => row.startsWith(`${key}:`));
  return line ? line.slice(key.length + 1).trim() : "";
}

export function resolveTakeFile(root, day, file) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Invalid take date");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.mp3$/.test(file)) {
    throw new Error("Invalid take file");
  }
  const resolved = path.resolve(root, day, file);
  const rel = path.relative(path.resolve(root), resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Take path escapes the library");
  }
  return resolved;
}
