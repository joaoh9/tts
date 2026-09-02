import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { downloadPiperVoices, parsePiperVoiceId, piperVoiceUrl } from "../src/setup.js";

describe("piper voice ids", () => {
  it("maps a voice id onto the Hugging Face layout", () => {
    assert.deepEqual(parsePiperVoiceId("en_US-lessac-medium"), {
      lang: "en",
      region: "US",
      locale: "en_US",
      name: "lessac",
      quality: "medium",
    });
    assert.equal(
      piperVoiceUrl("en_US-lessac-medium", ".onnx"),
      "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    );
  });
});

describe("downloadPiperVoices", () => {
  it("writes onnx + json from the fetch hook", async () => {
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-piper-"));
    const seen = [];
    await downloadPiperVoices({
      voiceIds: ["en_US-amy-medium"],
      destDir,
      fetchImpl: async (url) => {
        seen.push(url);
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from("fake"),
        };
      },
    });
    assert.equal(seen.length, 2);
    assert.equal(fs.existsSync(path.join(destDir, "en_US-amy-medium.onnx")), true);
    assert.equal(fs.existsSync(path.join(destDir, "en_US-amy-medium.onnx.json")), true);
    fs.rmSync(destDir, { recursive: true, force: true });
  });
});
