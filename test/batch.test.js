import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { listBatchFiles, runBatch } from "../src/batch.js";
import { formatSidecar } from "../src/library.js";

const dirs = [];

async function tmpDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tts-batch-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("listBatchFiles", () => {
  it("reads txt notes and skips workbench sidecars", async () => {
    const dir = await tmpDir();
    await fs.writeFile(path.join(dir, "note.txt"), "A short article.");
    await fs.writeFile(
      path.join(dir, "take.txt"),
      formatSidecar({
        text: "already spoken",
        engine: "kokoro",
        voice: "heart",
        voiceId: "af_heart",
        speed: 1,
        created: "2026-09-02T00:00:00.000Z",
      }),
    );
    await fs.writeFile(path.join(dir, "ignore.md"), "not txt");
    const files = await listBatchFiles(dir);
    assert.equal(files.length, 1);
    assert.equal(files[0].name, "note.txt");
    assert.equal(files[0].text, "A short article.");
  });
});

describe("runBatch", () => {
  it("synthesizes each note into the output folder", async () => {
    const input = await tmpDir();
    const output = await tmpDir();
    await fs.writeFile(path.join(input, "a.txt"), "First note");
    await fs.writeFile(path.join(input, "b.txt"), "Second note");
    await fs.writeFile(path.join(input, "empty.txt"), "   ");
    const calls = [];
    const results = await runBatch({
      inputDir: input,
      outputDir: output,
      voiceName: "heart",
      catalog: { default: "heart", voices: [] },
      synthesize: async ({ text, extraDir }) => {
        calls.push({ text, extraDir });
        return {
          slug: text.toLowerCase().replace(/\s+/g, "-"),
          mp3Path: "/library/fake.mp3",
          copyPath: path.join(extraDir, "fake.mp3"),
        };
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].extraDir, output);
    assert.equal(results.filter((item) => item.skipped).length, 1);
    assert.equal(results.filter((item) => !item.skipped).length, 2);
  });
});
