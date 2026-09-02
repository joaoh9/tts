import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { pcmToMp3 } from "../src/encode.js";
import { synthesizeTake } from "../src/synthesize.js";

const dirs = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("synthesizeTake", () => {
  it("refuses empty text and unknown voices", async () => {
    const catalog = {
      default: "heart",
      voices: [{ name: "heart", engine: "kokoro", voice: "af_heart", speed: 1 }],
    };
    await assert.rejects(() => synthesizeTake({ text: " ", catalog }), /Paste or pass/);
    await assert.rejects(
      () => synthesizeTake({ text: "hi", voiceName: "ghost", catalog }),
      /Unknown voice/,
    );
  });

  it("writes an mp3 take from a pcm engine", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tts-syn-"));
    dirs.push(root);
    const pcm = new Float32Array(4800);
    for (let i = 0; i < pcm.length; i += 1) pcm[i] = Math.sin(i / 20) * 0.2;
    const take = await synthesizeTake({
      text: "Sine take",
      catalog: {
        default: "heart",
        voices: [{ name: "heart", engine: "kokoro", voice: "af_heart", speed: 1 }],
      },
      root,
      now: new Date("2026-09-02T08:00:00Z"),
      engineFor: () => ({
        synthesize: async () => ({ pcm, sampleRate: 24000 }),
      }),
    });
    assert.equal(take.slug, "sine-take");
    assert.equal(take.engine, "kokoro");
    const mp3 = await fs.readFile(take.mp3Path);
    assert.ok(mp3.length > 100);
    const sidecar = await fs.readFile(take.txtPath, "utf8");
    assert.match(sidecar, /engine: kokoro/);
    assert.match(sidecar, /Sine take/);
  });
});

describe("pcmToMp3", () => {
  it("encodes a short tone", async () => {
    const pcm = new Float32Array(2400);
    for (let i = 0; i < pcm.length; i += 1) pcm[i] = Math.sin(i / 12) * 0.3;
    const mp3 = await pcmToMp3(pcm, 24000);
    assert.ok(mp3.length > 50);
    assert.ok(mp3[0] === 0xff || mp3.toString("ascii", 0, 3) === "ID3");
  });
});
