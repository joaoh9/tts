import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { piperModelsDir } from "../paths.js";
import { decodeWav } from "../wav.js";

export function resolvePiperBin(env = process.env) {
  if (env.PIPER_BIN) return splitCommand(env.PIPER_BIN);
  for (const candidate of ["piper", "piper-tts"]) {
    const found = which(candidate);
    if (found) return [found];
  }
  return null;
}

export function resolvePiperModel(voiceId, env = process.env) {
  if (voiceId.endsWith(".onnx") && fs.existsSync(voiceId)) return path.resolve(voiceId);
  const dir = piperModelsDir(env);
  const named = path.join(dir, `${voiceId}.onnx`);
  if (fs.existsSync(named)) return named;
  return null;
}

export function isAvailable(env = process.env) {
  return Boolean(resolvePiperBin(env));
}

export function diagnose(env = process.env) {
  const bin = resolvePiperBin(env);
  const modelsDir = piperModelsDir(env);
  const models = listPiperModels(modelsDir);
  return {
    engine: "piper",
    available: Boolean(bin && models.length > 0),
    bin: bin ? bin.join(" ") : null,
    modelsDir,
    models,
    detail: bin
      ? models.length
        ? `${models.length} voice model(s) in ${modelsDir}`
        : `Binary found. Download a voice with: tts setup piper`
      : "Piper binary not found. See README for install steps.",
  };
}

export function listPiperModels(dir = piperModelsDir()) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".onnx"))
    .map((name) => name.replace(/\.onnx$/, ""))
    .sort();
}

export async function synthesize({ text, voiceId, speed, env = process.env }) {
  const bin = resolvePiperBin(env);
  if (!bin) {
    throw new Error("Piper is not installed. See README, then run: tts setup piper");
  }
  const model = resolvePiperModel(voiceId, env);
  if (!model) {
    throw new Error(
      `Piper model "${voiceId}" not found in ${piperModelsDir(env)}. Run: tts setup piper ${voiceId}`,
    );
  }
  const tmp = path.join(
    os.tmpdir(),
    `tts-piper-${process.pid}-${Date.now()}.wav`,
  );
  const lengthScale = speed > 0 ? 1 / speed : 1;
  const args = [
    ...bin.slice(1),
    "--model",
    model,
    "--output_file",
    tmp,
    "--length_scale",
    String(lengthScale),
  ];
  try {
    await runPiper(bin[0], args, text);
    const wav = fs.readFileSync(tmp);
    const { samples, sampleRate } = decodeWav(wav);
    return { pcm: samples, sampleRate };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function runPiper(command, args, text) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const errors = [];
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error(`Piper binary not found: ${command}`));
        return;
      }
      reject(err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(errors).toString("utf8").trim();
        reject(new Error(detail || `Piper exited with code ${code}`));
        return;
      }
      resolve();
    });
    child.stdin.end(text);
  });
}

function splitCommand(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function which(bin) {
  const parts = (process.env.PATH || "").split(path.delimiter);
  const extensions =
    process.platform === "win32" ? (process.env.PATHEXT || ".EXE").split(";") : [""];
  for (const dir of parts) {
    for (const ext of extensions) {
      const candidate = path.join(dir, bin + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return null;
}
