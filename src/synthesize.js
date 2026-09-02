import { pcmToMp3 } from "./encode.js";
import { getEngine } from "./engines/index.js";
import { saveTake } from "./library.js";
import { libraryRoot } from "./paths.js";
import { normalizeText } from "./text.js";
import { findVoice } from "./voices.js";

export async function synthesizeTake({
  text,
  voiceName,
  catalog,
  extraDir,
  now,
  onProgress,
  root = libraryRoot(),
  engineFor = getEngine,
}) {
  const body = normalizeText(text);
  if (!body) throw new Error("Paste or pass some text first.");
  const voice = findVoice(catalog, voiceName);
  const engine = engineFor(voice.engine);
  onProgress?.({ stage: "engine", engine: voice.engine, voice: voice.name });
  const result = await engine.synthesize({
    text: body,
    voiceId: voice.voice,
    speed: voice.speed,
    model: voice.model,
    onProgress,
  });
  const audio = result.mp3
    ? result.mp3
    : await pcmToMp3(result.pcm, result.sampleRate);
  const take = await saveTake({
    text: body,
    audio,
    voice,
    root,
    now,
    extraDir,
  });
  return { ...take, voice, engine: voice.engine };
}
