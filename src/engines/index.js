import * as kokoro from "./kokoro.js";
import * as openai from "./openai.js";
import * as piper from "./piper.js";

export const engines = {
  kokoro,
  piper,
  openai,
};

export function getEngine(name) {
  const engine = engines[name];
  if (!engine) {
    throw new Error(`Unknown engine "${name}"`);
  }
  return engine;
}

export async function diagnoseAll(env = process.env) {
  return {
    kokoro: await kokoro.diagnose({ env }),
    piper: piper.diagnose(env),
    openai: openai.diagnose(env),
  };
}
