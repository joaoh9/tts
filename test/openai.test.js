import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnose, isAvailable, synthesize } from "../src/engines/openai.js";

describe("openai engine", () => {
  it("stays unavailable without a key", () => {
    assert.equal(isAvailable({}), false);
    assert.equal(diagnose({}).available, false);
  });

  it("requests mp3 audio and never asks for a cloned voice", async () => {
    const calls = [];
    const result = await synthesize({
      text: "Hello hosted world",
      voiceId: "alloy",
      speed: 1,
      env: { OPENAI_API_KEY: "sk-test", OPENAI_TTS_MODEL: "tts-1-hd" },
      clientFactory: () => ({
        audio: {
          speech: {
            create: async (payload) => {
              calls.push(payload);
              return { arrayBuffer: async () => Buffer.from("ID3") };
            },
          },
        },
      }),
    });
    assert.equal(result.mp3.toString(), "ID3");
    assert.equal(calls[0].voice, "alloy");
    assert.equal(calls[0].model, "tts-1-hd");
    assert.equal(calls[0].response_format, "mp3");
    assert.equal("instructions" in calls[0], false);
  });
});
