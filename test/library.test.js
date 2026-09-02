import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  formatSidecar,
  listTakes,
  resolveTakeFile,
  saveTake,
} from "../src/library.js";

const dirs = [];

async function tmpDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tts-lib-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("sidecar", () => {
  it("holds the input text plus engine and voice", () => {
    const sidecar = formatSidecar({
      text: "Hello booth.",
      engine: "kokoro",
      voice: "heart",
      voiceId: "af_heart",
      speed: 1,
      created: "2026-09-02T12:00:00.000Z",
    });
    assert.match(sidecar, /^# tts-workbench take/);
    assert.match(sidecar, /engine: kokoro/);
    assert.match(sidecar, /voice: heart/);
    assert.match(sidecar, /voice_id: af_heart/);
    assert.match(sidecar, /Hello booth\./);
  });
});

describe("saveTake", () => {
  it("writes dated mp3 plus sidecar and unique slugs", async () => {
    const root = await tmpDir();
    const now = new Date("2026-09-02T15:04:05Z");
    const voice = { name: "heart", engine: "kokoro", voice: "af_heart", speed: 1 };
    const first = await saveTake({
      text: "The quick brown fox",
      audio: Buffer.from("ID3fake"),
      voice,
      root,
      now,
    });
    const second = await saveTake({
      text: "The quick brown fox",
      audio: Buffer.from("ID3fake2"),
      voice,
      root,
      now,
    });
    assert.equal(first.day, "2026-09-02");
    assert.equal(first.slug, "the-quick-brown-fox");
    assert.equal(second.slug, "the-quick-brown-fox-2");
    const sidecar = await fs.readFile(first.txtPath, "utf8");
    assert.match(sidecar, /engine: kokoro/);
    assert.match(sidecar, /The quick brown fox/);
    const extra = await tmpDir();
    const copied = await saveTake({
      text: "Copied take",
      audio: Buffer.from("ID3"),
      voice,
      root,
      now,
      extraDir: extra,
    });
    assert.equal(path.dirname(copied.copyPath), extra);
    assert.equal((await fs.readFile(copied.copyPath)).toString(), "ID3");
  });
});

describe("resolveTakeFile", () => {
  it("rejects traversal and odd names", () => {
    const root = "/tmp/tts-lib";
    assert.equal(
      resolveTakeFile(root, "2026-09-02", "hello.mp3"),
      path.resolve(root, "2026-09-02", "hello.mp3"),
    );
    assert.throws(() => resolveTakeFile(root, "nope", "hello.mp3"));
    assert.throws(() => resolveTakeFile(root, "2026-09-02", "../secret.mp3"));
    assert.throws(() => resolveTakeFile(root, "2026-09-02", "hello.txt"));
  });
});

describe("listTakes", () => {
  it("returns newest dated takes", async () => {
    const root = await tmpDir();
    const voice = { name: "heart", engine: "kokoro", voice: "af_heart", speed: 1 };
    await saveTake({
      text: "Older",
      audio: Buffer.from("a"),
      voice,
      root,
      now: new Date("2026-09-01T10:00:00Z"),
    });
    await saveTake({
      text: "Newer note",
      audio: Buffer.from("b"),
      voice,
      root,
      now: new Date("2026-09-02T10:00:00Z"),
    });
    const takes = await listTakes({ root, limit: 10 });
    assert.equal(takes[0].slug, "newer-note");
    assert.equal(takes[0].day, "2026-09-02");
    assert.equal(takes[0].engine, "kokoro");
  });
});
