import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgv } from "../src/cli.js";

describe("parseArgv", () => {
  it("parses speak with voice and file flags", () => {
    assert.deepEqual(parseArgv(["speak", "Hello there", "--voice", "heart"]), {
      command: "speak",
      flags: { voice: "heart" },
      positionals: ["Hello there"],
    });
    assert.deepEqual(parseArgv(["--file", "notes.txt"]), {
      command: "speak",
      flags: { file: "notes.txt" },
      positionals: [],
    });
  });

  it("parses batch, serve, and setup", () => {
    assert.equal(parseArgv(["batch", "./notes", "--out", "./mp3"]).command, "batch");
    assert.equal(parseArgv(["serve", "--port", "4000"]).flags.port, "4000");
    assert.deepEqual(parseArgv(["setup", "piper", "en_US-lessac-medium"]).positionals, [
      "piper",
      "en_US-lessac-medium",
    ]);
  });

  it("treats a bare sentence as speak", () => {
    assert.equal(parseArgv(["Just say this"]).command, "speak");
    assert.deepEqual(parseArgv(["Just say this"]).positionals, ["Just say this"]);
  });
});
