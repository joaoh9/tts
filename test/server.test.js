import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/server.js";
import { saveTake } from "../src/library.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "tts-http-"));
const catalog = {
  default: "heart",
  voices: [{ name: "heart", engine: "kokoro", voice: "af_heart", speed: 1 }],
};

const app = createApp({
  catalog,
  root,
  synthesize: async ({ text, voiceName }) => {
    if (!String(text ?? "").trim()) throw new Error("Paste or pass some text first.");
    return saveTake({
      text,
      audio: Buffer.from("ID3fake-mp3"),
      voice: catalog.voices.find((voice) => voice.name === (voiceName || "heart")),
      root,
      now: new Date("2026-09-02T12:00:00Z"),
    }).then((take) => ({ ...take, engine: "kokoro", voice: catalog.voices[0] }));
  },
  diagnose: async () => ({
    kokoro: { engine: "kokoro", available: true, detail: "ok" },
    piper: { engine: "piper", available: false, detail: "missing" },
    openai: { engine: "openai", available: false, detail: "no key" },
  }),
});

const server = http.createServer(app);
let base = "";

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
});

describe("localhost booth", () => {
  it("serves the workbench page", async () => {
    const res = await fetch(base);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /TTS Workbench/);
    assert.match(html, /Record take/);
  });

  it("lists grouped voices and engine status", async () => {
    const voices = await fetch(`${base}/api/voices`).then((res) => res.json());
    assert.equal(voices.default, "heart");
    const status = await fetch(`${base}/api/status`).then((res) => res.json());
    assert.equal(status.host, "127.0.0.1");
    assert.equal(status.engines.openai.available, false);
  });

  it("records a take and serves the mp3 from the library", async () => {
    const spoken = await fetch(`${base}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello from the booth", voice: "heart" }),
    });
    const body = await spoken.json();
    assert.equal(spoken.status, 200);
    assert.equal(body.slug, "hello-from-the-booth");
    assert.match(body.path, /2026-09-02/);
    const mp3 = await fetch(`${base}${body.url}`);
    assert.equal(mp3.status, 200);
    assert.equal(mp3.headers.get("content-type"), "audio/mpeg");
    const sidecar = await fs.readFile(body.path.replace(/\.mp3$/, ".txt"), "utf8");
    assert.match(sidecar, /Hello from the booth/);
  });

  it("rejects empty text and path traversal", async () => {
    const empty = await fetch(`${base}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "  " }),
    });
    assert.equal(empty.status, 400);
    const traverse = await fetch(`${base}/api/takes/2026-09-02/hello.txt`);
    assert.equal(traverse.status, 400);
    const badDay = await fetch(`${base}/api/takes/not-a-date/hello.mp3`);
    assert.equal(badDay.status, 400);
  });
});
