import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findVoice, groupVoices, loadVoices } from "../src/voices.js";

describe("voices.json", () => {
  it("loads named presets with engine, voice id, and speed", () => {
    const catalog = loadVoices();
    assert.equal(catalog.default, "heart");
    const heart = findVoice(catalog, "heart");
    assert.equal(heart.engine, "kokoro");
    assert.equal(heart.voice, "af_heart");
    assert.equal(heart.speed, 1);
    const alloy = findVoice(catalog, "alloy");
    assert.equal(alloy.engine, "openai");
    assert.throws(() => findVoice(catalog, "cloned-celebrity"));
  });

  it("groups presets by engine for the rack", () => {
    const catalog = loadVoices();
    const groups = groupVoices(catalog.voices);
    assert.deepEqual(
      groups.map((group) => group.engine),
      ["kokoro", "piper", "openai"],
    );
    assert.equal(groups.find((group) => group.engine === "openai").privacy, "hosted");
  });
});
