import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify, uniqueSlug } from "../src/slug.js";

describe("slugify", () => {
  it("turns a sentence into a filesystem slug", () => {
    assert.equal(slugify("Hello, World! This is a take."), "hello-world-this-is-a-take");
  });

  it("falls back when the text has no useful characters", () => {
    assert.equal(slugify("!!!"), "take");
    assert.equal(slugify(""), "take");
  });

  it("strips accents", () => {
    assert.equal(slugify("Olá João"), "ola-joao");
  });

  it("caps length", () => {
    const slug = slugify("alpha ".repeat(40));
    assert.ok(slug.length <= 48);
    assert.equal(slug.endsWith("-"), false);
  });
});

describe("uniqueSlug", () => {
  it("keeps the base when free", () => {
    assert.equal(uniqueSlug(["other"], "hello"), "hello");
  });

  it("appends -2, -3 on collision", () => {
    assert.equal(uniqueSlug(["hello", "hello-2"], "hello"), "hello-3");
  });
});
