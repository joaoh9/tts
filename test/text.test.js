import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateSeconds,
  isWorkbenchSidecar,
  splitForTts,
  wordCount,
} from "../src/text.js";

describe("splitForTts", () => {
  it("keeps short text as one chunk", () => {
    assert.deepEqual(splitForTts("Hello there.", 80), ["Hello there."]);
  });

  it("packs sentences under the limit", () => {
    const chunks = splitForTts("One. Two. Three is longer than the rest.", 12);
    assert.deepEqual(chunks[0], "One. Two.");
    assert.ok(chunks.every((chunk) => chunk.length <= 12 || chunk.split(" ").length === 1));
  });

  it("hard-wraps a long token", () => {
    const chunks = splitForTts("abcdefghij", 4);
    assert.deepEqual(chunks, ["abcd", "efgh", "ij"]);
  });
});

describe("sidecar detection", () => {
  it("recognizes workbench sidecars", () => {
    assert.equal(isWorkbenchSidecar("# tts-workbench take\nengine: kokoro"), true);
    assert.equal(isWorkbenchSidecar("just a note"), false);
  });
});

describe("counts", () => {
  it("counts words and estimates duration", () => {
    assert.equal(wordCount("one two three"), 3);
    assert.equal(estimateSeconds("word ".repeat(150)), 60);
  });
});
