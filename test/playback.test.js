import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Deck,
  SKIP_SECONDS,
  clampTime,
  formatRate,
  formatTimestamp,
  nextSpeed,
} from "../public/playback.js";

function fakeAudio({ duration = 90 } = {}) {
  const listeners = new Map();
  const audio = {
    currentTime: 0,
    duration,
    paused: true,
    ended: false,
    playbackRate: 1,
    src: "",
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    emit(type) {
      for (const fn of listeners.get(type) || []) fn();
    },
    play() {
      this.paused = false;
      this.ended = false;
      this.emit("play");
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
      this.emit("pause");
    },
  };
  return audio;
}

describe("formatTimestamp", () => {
  it("renders podcast-style times", () => {
    assert.equal(formatTimestamp(0), "0:00");
    assert.equal(formatTimestamp(9.8), "0:09");
    assert.equal(formatTimestamp(75), "1:15");
    assert.equal(formatTimestamp(3661), "1:01:01");
    assert.equal(formatTimestamp(Number.NaN), "0:00");
  });
});

describe("clampTime", () => {
  it("skips 15 seconds without leaving the take", () => {
    assert.equal(SKIP_SECONDS, 15);
    assert.equal(clampTime({ current: 10, delta: 15, duration: 40 }), 25);
    assert.equal(clampTime({ current: 10, delta: -15, duration: 40 }), 0);
    assert.equal(clampTime({ current: 32, delta: 15, duration: 40 }), 40);
  });
});

describe("nextSpeed", () => {
  it("cycles through podcast rates", () => {
    assert.equal(nextSpeed(1), 1.2);
    assert.equal(nextSpeed(2), 0.8);
    assert.equal(formatRate(1.5), "1.5×");
  });
});

describe("Deck", () => {
  it("loads a take, skips, seeks, and toggles", async () => {
    const audio = fakeAudio({ duration: 80 });
    const deck = new Deck(audio);
    const snaps = [];
    deck.on((snap) => snaps.push(snap));
    await deck.load({ slug: "booth-check", url: "/api/takes/2026-09-02/booth-check.mp3" });
    assert.equal(audio.src.endsWith("booth-check.mp3"), true);
    assert.equal(audio.paused, false);
    deck.skip(15);
    assert.equal(audio.currentTime, 15);
    deck.skip(-15);
    assert.equal(audio.currentTime, 0);
    deck.seek(50);
    assert.equal(audio.currentTime, 50);
    deck.skip(15);
    assert.equal(audio.currentTime, 65);
    await deck.toggle();
    assert.equal(audio.paused, true);
    assert.equal(deck.cycleRate(), 1.2);
    assert.equal(deck.snapshot().take.slug, "booth-check");
    assert.ok(snaps.length > 0);
  });
});
