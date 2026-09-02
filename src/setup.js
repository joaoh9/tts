import fs from "node:fs";
import path from "node:path";
import { ensureDir, piperModelsDir } from "./paths.js";

const HF_BASE =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0";

const DEFAULT_PIPER_VOICES = ["en_US-lessac-medium", "en_US-amy-medium"];

export function piperVoiceUrl(voiceId, ext) {
  const parsed = parsePiperVoiceId(voiceId);
  const rel = `${parsed.lang}/${parsed.locale}/${parsed.name}/${parsed.quality}/${voiceId}${ext}`;
  return `${HF_BASE}/${rel}`;
}

export function parsePiperVoiceId(voiceId) {
  const match = /^([a-z]{2})_([A-Z]{2})-([a-z0-9_]+)-([a-z]+)$/.exec(voiceId);
  if (!match) {
    throw new Error(
      `Unrecognized Piper voice id "${voiceId}". Expected like en_US-lessac-medium.`,
    );
  }
  return {
    lang: match[1],
    region: match[2],
    locale: `${match[1]}_${match[2]}`,
    name: match[3],
    quality: match[4],
  };
}

export async function downloadPiperVoices({
  voiceIds = DEFAULT_PIPER_VOICES,
  destDir = piperModelsDir(),
  fetchImpl = fetch,
  onProgress,
} = {}) {
  ensureDir(destDir);
  const saved = [];
  for (const voiceId of voiceIds) {
    for (const ext of [".onnx", ".onnx.json"]) {
      const url = piperVoiceUrl(voiceId, ext);
      const dest = path.join(destDir, `${voiceId}${ext}`);
      onProgress?.({ voiceId, url, dest });
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}) for ${url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(dest, bytes);
    }
    saved.push(voiceId);
  }
  return { destDir, voices: saved };
}
