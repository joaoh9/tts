import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";
import { encodeWav } from "./wav.js";

export function resolveFfmpeg(env = process.env) {
  if (env.FFMPEG_PATH && existsSync(env.FFMPEG_PATH)) return env.FFMPEG_PATH;
  if (typeof ffmpegStatic === "string" && existsSync(ffmpegStatic)) return ffmpegStatic;
  return "ffmpeg";
}

export async function pcmToMp3(samples, sampleRate, env = process.env) {
  const wav = encodeWav(samples, sampleRate);
  return wavToMp3(wav, env);
}

export function wavToMp3(wavBuffer, env = process.env) {
  const bin = resolveFfmpeg(env);
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-f",
        "mp3",
        "-codec:a",
        "libmp3lame",
        "-qscale:a",
        "4",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const chunks = [];
    const errors = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "ffmpeg not found. Install it (brew install ffmpeg) or set FFMPEG_PATH.",
          ),
        );
        return;
      }
      reject(err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(errors).toString("utf8").trim();
        reject(new Error(detail || `ffmpeg exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    child.stdin.on("error", (err) => {
      if (err.code !== "EPIPE") reject(err);
    });
    child.stdin.end(wavBuffer);
  });
}
