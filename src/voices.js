import fs from "node:fs";
import { voicesPath } from "./paths.js";

const ENGINES = new Set(["kokoro", "piper", "openai"]);

export function loadVoices(filePath = voicesPath()) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!raw || !Array.isArray(raw.voices) || raw.voices.length === 0) {
    throw new Error(`No voices defined in ${filePath}`);
  }
  const voices = raw.voices.map((voice, index) => validateVoice(voice, index));
  const names = new Set();
  for (const voice of voices) {
    if (names.has(voice.name)) {
      throw new Error(`Duplicate voice name "${voice.name}" in ${filePath}`);
    }
    names.add(voice.name);
  }
  const defaultName = raw.default || voices[0].name;
  if (!names.has(defaultName)) {
    throw new Error(`Default voice "${defaultName}" is not in ${filePath}`);
  }
  return { default: defaultName, voices };
}

export function findVoice(catalog, name) {
  const wanted = name || catalog.default;
  const voice = catalog.voices.find((item) => item.name === wanted);
  if (!voice) {
    const known = catalog.voices.map((item) => item.name).join(", ");
    throw new Error(`Unknown voice "${wanted}". Presets: ${known}`);
  }
  return voice;
}

function validateVoice(voice, index) {
  const name = String(voice?.name ?? "").trim();
  const engine = String(voice?.engine ?? "").trim();
  const voiceId = String(voice?.voice ?? "").trim();
  const speed = Number(voice?.speed ?? 1);
  if (!name) throw new Error(`voices[${index}] is missing name`);
  if (!ENGINES.has(engine)) {
    throw new Error(`voices[${index}] "${name}" has unknown engine "${engine}"`);
  }
  if (!voiceId) throw new Error(`voices[${index}] "${name}" is missing voice id`);
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`voices[${index}] "${name}" has invalid speed`);
  }
  return {
    name,
    engine,
    voice: voiceId,
    speed,
    model: voice.model ? String(voice.model) : undefined,
  };
}

export function groupVoices(voices) {
  const groups = [
    { engine: "kokoro", label: "Local · Kokoro", privacy: "local" },
    { engine: "piper", label: "Local · Piper", privacy: "local" },
    { engine: "openai", label: "Hosted · OpenAI", privacy: "hosted" },
  ];
  return groups
    .map((group) => ({
      ...group,
      voices: voices.filter((voice) => voice.engine === group.engine),
    }))
    .filter((group) => group.voices.length > 0);
}
