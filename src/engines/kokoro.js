import { kokoroCacheDir, ensureDir } from "../paths.js";
import { concatPcm, pcmFromTyped, silence } from "../wav.js";
import { splitForTts } from "../text.js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const MAX_CHARS = 280;

let loaded = null;
let loading = null;

export function isAvailable() {
  return true;
}

export async function diagnose({ onProgress } = {}) {
  return {
    engine: "kokoro",
    available: true,
    detail: "ONNX model downloads from Hugging Face on first use, then stays on disk.",
    cacheDir: kokoroCacheDir(),
  };
}

export async function synthesize({ text, voiceId, speed, onProgress }) {
  const tts = await loadKokoro({ onProgress });
  const chunks = splitForTts(text, MAX_CHARS);
  if (chunks.length === 0) {
    throw new Error("Nothing to speak");
  }
  const pcmChunks = [];
  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.({
      engine: "kokoro",
      stage: "speak",
      index: i + 1,
      total: chunks.length,
    });
    const audio = await tts.generate(chunks[i], { voice: voiceId, speed });
    pcmChunks.push(extractPcm(audio));
    if (i < chunks.length - 1) {
      pcmChunks.push(silence(audio.sampling_rate || 24000, 0.16));
    }
  }
  return { pcm: concatPcm(pcmChunks), sampleRate: 24000 };
}

function extractPcm(audio) {
  const data = audio?.audio ?? audio?.data;
  if (!data) {
    throw new Error("Kokoro returned no audio samples");
  }
  return pcmFromTyped(data);
}

async function loadKokoro({ onProgress } = {}) {
  if (loaded) return loaded;
  if (loading) return loading;
  loading = (async () => {
    const cacheDir = ensureDir(kokoroCacheDir());
    const { KokoroTTS, env } = await import("kokoro-js");
    env.cacheDir = cacheDir;
    const dtype = process.env.KOKORO_DTYPE || "q8";
    const preferred = process.env.KOKORO_DEVICE || "cpu";
    onProgress?.({ engine: "kokoro", stage: "load", device: preferred, dtype });
    try {
      loaded = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype,
        device: preferred,
        progress_callback: (report) =>
          onProgress?.({ engine: "kokoro", stage: "download", ...report }),
      });
    } catch (err) {
      if (preferred === "wasm") throw err;
      onProgress?.({
        engine: "kokoro",
        stage: "load",
        device: "wasm",
        fallbackFrom: preferred,
        error: err.message,
      });
      loaded = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype,
        device: "wasm",
        progress_callback: (report) =>
          onProgress?.({ engine: "kokoro", stage: "download", ...report }),
      });
    }
    return loaded;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export function _resetForTests() {
  loaded = null;
  loading = null;
}
