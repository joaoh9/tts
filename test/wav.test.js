import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { concatPcm, decodeWav, encodeWav } from "../src/wav.js";

describe("wav roundtrip", () => {
  it("encodes and decodes 16-bit mono PCM", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeWav(samples, 24000);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    const decoded = decodeWav(wav);
    assert.equal(decoded.sampleRate, 24000);
    assert.equal(decoded.samples.length, samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      assert.ok(Math.abs(decoded.samples[i] - samples[i]) < 0.0001);
    }
  });

  it("concatenates pcm chunks", () => {
    const out = concatPcm([new Float32Array([1, 2]), new Float32Array([3])]);
    assert.deepEqual(Array.from(out), [1, 2, 3]);
  });
});
