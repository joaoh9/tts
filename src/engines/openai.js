import { splitForTts } from "../text.js";

const MAX_CHARS = 3500;

export function isAvailable(env = process.env) {
  return Boolean(env.OPENAI_API_KEY);
}

export function diagnose(env = process.env) {
  const available = isAvailable(env);
  return {
    engine: "openai",
    available,
    model: env.OPENAI_TTS_MODEL || "tts-1-hd",
    detail: available
      ? "API key present. This path leaves the machine."
      : "No OPENAI_API_KEY. Hosted voices stay disabled.",
  };
}

export async function synthesize({
  text,
  voiceId,
  speed,
  model,
  env = process.env,
  clientFactory,
}) {
  if (!isAvailable(env)) {
    throw new Error("OPENAI_API_KEY is not set. Hosted fallback is optional.");
  }
  const OpenAI = (await import("openai")).default;
  const client = clientFactory
    ? clientFactory()
    : new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const speechModel = model || env.OPENAI_TTS_MODEL || "tts-1-hd";
  const chunks = splitForTts(text, MAX_CHARS);
  if (chunks.length === 0) throw new Error("Nothing to speak");
  if (chunks.length === 1) {
    return requestMp3(client, {
      input: chunks[0],
      voice: voiceId,
      speed,
      model: speechModel,
    });
  }
  const parts = [];
  for (const chunk of chunks) {
    const { mp3 } = await requestMp3(client, {
      input: chunk,
      voice: voiceId,
      speed,
      model: speechModel,
    });
    parts.push(mp3);
  }
  return { mp3: Buffer.concat(parts) };
}

async function requestMp3(client, { input, voice, speed, model }) {
  const response = await client.audio.speech.create({
    model,
    voice,
    input,
    speed,
    response_format: "mp3",
  });
  const mp3 = Buffer.from(await response.arrayBuffer());
  return { mp3 };
}
