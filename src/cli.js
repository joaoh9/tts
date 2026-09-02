import fs from "node:fs/promises";
import path from "node:path";
import { runBatch } from "./batch.js";
import { bindHost, bindPort, loadEnv } from "./config.js";
import { diagnoseAll } from "./engines/index.js";
import { libraryRoot } from "./paths.js";
import { startServer } from "./server.js";
import { downloadPiperVoices } from "./setup.js";
import { synthesizeTake } from "./synthesize.js";
import { loadVoices } from "./voices.js";

const HELP = `tts — personal local-first text-to-speech workbench

Usage:
  tts speak [text] [--voice name] [--file path] [--out dir]
  tts batch <dir> [--voice name] [--out dir]
  tts serve [--port n]
  tts voices
  tts doctor
  tts setup piper [voice-id ...]
  tts help

Takes are always archived to ~/TTS/YYYY-MM-DD/<slug>.mp3 with a sidecar .txt.
Local engines: Kokoro (default) and Piper. Hosted: OpenAI, if OPENAI_API_KEY is set.
This tool does not clone voices.
`;

export function parseArgv(argv) {
  const args = [...argv];
  if (args.length === 0) return { command: "help", flags: {}, positionals: [] };
  let command = args[0];
  let rest = args.slice(1);
  if (command.startsWith("-")) {
    rest = args;
    command = args.includes("--help") || args.includes("-h") ? "help" : "speak";
  } else if (
    ![
      "speak",
      "batch",
      "serve",
      "voices",
      "doctor",
      "setup",
      "help",
      "--help",
      "-h",
    ].includes(command)
  ) {
    rest = args;
    command = "speak";
  }
  if (command === "--help" || command === "-h") command = "help";

  const flags = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--") {
      positionals.push(...rest.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else if (token.startsWith("-") && token.length === 2) {
      const map = { v: "voice", f: "file", o: "out", p: "port", h: "help" };
      const key = map[token.slice(1)];
      if (!key) throw new Error(`Unknown flag ${token}`);
      const next = rest[i + 1];
      if (key !== "help" && next && !next.startsWith("-")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }
  return { command, flags, positionals };
}

export async function main(argv, io = defaultIo()) {
  loadEnv();
  const { command, flags, positionals } = parseArgv(argv);
  if (flags.help) {
    io.stdout.write(HELP);
    return 0;
  }
  switch (command) {
    case "help":
      io.stdout.write(HELP);
      return 0;
    case "voices":
      return cmdVoices(io);
    case "doctor":
      return cmdDoctor(io);
    case "setup":
      return cmdSetup(positionals, io);
    case "serve":
      return cmdServe(flags, io);
    case "batch":
      return cmdBatch(positionals, flags, io);
    case "speak":
      return cmdSpeak(positionals, flags, io);
    default:
      throw new Error(`Unknown command "${command}"`);
  }
}

async function cmdVoices(io) {
  const catalog = loadVoices();
  io.stdout.write(`default: ${catalog.default}\n`);
  for (const voice of catalog.voices) {
    io.stdout.write(
      `${voice.name.padEnd(12)} ${voice.engine.padEnd(8)} ${voice.voice}  speed ${voice.speed}\n`,
    );
  }
  return 0;
}

async function cmdDoctor(io) {
  const report = await diagnoseAll();
  for (const engine of Object.values(report)) {
    const mark = engine.available ? "ok" : "no";
    io.stdout.write(`[${mark}] ${engine.engine}: ${engine.detail}\n`);
  }
  io.stdout.write(`library: ${libraryRoot()}\n`);
  return 0;
}

async function cmdSetup(positionals, io) {
  const kind = positionals[0] || "piper";
  if (kind !== "piper") {
    throw new Error(`Unknown setup target "${kind}". Try: tts setup piper`);
  }
  const voiceIds = positionals.slice(1);
  const result = await downloadPiperVoices({
    voiceIds: voiceIds.length ? voiceIds : undefined,
    onProgress: ({ voiceId, dest }) => io.stderr.write(`downloading ${voiceId} → ${dest}\n`),
  });
  io.stdout.write(`Piper voices saved in ${result.destDir}\n`);
  io.stdout.write(result.voices.join("\n") + "\n");
  return 0;
}

async function cmdServe(flags, io) {
  if (flags.port) process.env.PORT = String(flags.port);
  const port = bindPort();
  const host = bindHost();
  await startServer({ host, port });
  io.stdout.write(`Booth on http://${host}:${port}  (localhost only)\n`);
  io.stdout.write(`Takes → ${libraryRoot()}\n`);
  return new Promise(() => {});
}

async function cmdSpeak(positionals, flags, io) {
  const catalog = loadVoices();
  let text = positionals.join(" ").trim();
  if (flags.file) {
    text = await fs.readFile(flags.file, "utf8");
  }
  if (!text && !io.stdin.isTTY) {
    text = await readStdin(io.stdin);
  }
  const extraDir = flags.out ? path.resolve(flags.out) : undefined;
  const take = await synthesizeTake({
    text,
    voiceName: flags.voice,
    catalog,
    extraDir,
    onProgress: (event) => {
      if (event.stage === "speak") {
        io.stderr.write(`kokoro ${event.index}/${event.total}\n`);
      } else if (event.stage === "load") {
        io.stderr.write(`loading kokoro on ${event.device}\n`);
      }
    },
  });
  io.stdout.write(`${take.mp3Path}\n`);
  if (take.copyPath) io.stdout.write(`${take.copyPath}\n`);
  return 0;
}

async function cmdBatch(positionals, flags, io) {
  const inputDir = positionals[0];
  if (!inputDir) throw new Error("Usage: tts batch <dir> [--voice name] [--out dir]");
  const catalog = loadVoices();
  const resolvedIn = path.resolve(inputDir);
  const outputDir = path.resolve(flags.out || resolvedIn);
  const results = await runBatch({
    inputDir: resolvedIn,
    outputDir,
    voiceName: flags.voice,
    catalog,
    synthesize: synthesizeTake,
    onItem: (item) => {
      if (item.skipped) {
        io.stderr.write(`skip ${item.file} (${item.reason})\n`);
        return;
      }
      io.stdout.write(`${item.file} → ${item.mp3Path}\n`);
    },
  });
  const done = results.filter((item) => !item.skipped).length;
  io.stderr.write(`${done} take(s) in ${outputDir}\n`);
  return 0;
}

function readStdin(stdin) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => chunks.push(chunk));
    stdin.on("end", () => resolve(chunks.join("")));
    stdin.on("error", reject);
  });
}

function defaultIo() {
  return {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  };
}
