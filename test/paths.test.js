import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { bindHost, bindPort } from "../src/config.js";
import { dateStamp, expandHome, libraryDayDir, libraryRoot } from "../src/paths.js";

describe("paths", () => {
  it("expands ~ and builds dated library folders", () => {
    assert.equal(expandHome("~/TTS"), path.join(os.homedir(), "TTS"));
    assert.equal(dateStamp(new Date("2026-09-02T12:00:00")), "2026-09-02");
    assert.equal(
      libraryDayDir("/tmp/TTS", new Date("2026-09-02T12:00:00")),
      path.join("/tmp/TTS", "2026-09-02"),
    );
    assert.equal(libraryRoot({ TTS_LIBRARY_DIR: "~/TTS" }), path.join(os.homedir(), "TTS"));
  });
});

describe("bind", () => {
  it("is localhost only", () => {
    assert.equal(bindHost(), "127.0.0.1");
    assert.equal(bindPort({ PORT: "4000" }), 4000);
    assert.throws(() => bindPort({ PORT: "nope" }));
  });
});
