import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, "host-typography.css");

describe("host-typography.css", () => {
  const css = readFileSync(cssPath, "utf8");
  // Strip comments so documented override examples or JSDoc-style prose
  // can't accidentally satisfy the assertions below.
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("declares the typography-scale custom properties", () => {
    for (const name of [
      "--stagebook-h1-size",
      "--stagebook-h2-size",
      "--stagebook-h3-size",
      "--stagebook-h4-size",
      "--stagebook-body-size",
      "--stagebook-body-line-height",
      "--stagebook-heading-weight",
      "--stagebook-link-hover",
    ]) {
      expect(cssWithoutComments).toMatch(new RegExp(`${name}\\s*:`));
    }
  });

  it("applies the box-sizing reset to universal selectors", () => {
    // Pins the exact shape the issue prescribed — don't silently degrade to
    // a class-scoped reset which would break the contract.
    expect(cssWithoutComments).toMatch(
      /\*\s*,\s*::before\s*,\s*::after\s*{[^}]*box-sizing:\s*border-box/,
    );
  });

  it("applies the media max-width rule to bare img/video tags", () => {
    expect(cssWithoutComments).toMatch(
      /\bimg\s*,\s*video\s*{[^}]*max-width:\s*100%/,
    );
  });

  it("sets heading font-sizes from variables", () => {
    expect(cssWithoutComments).toMatch(
      /\bh1\s*{[^}]*font-size:\s*var\(--stagebook-h1-size/,
    );
    expect(cssWithoutComments).toMatch(
      /\bh2\s*{[^}]*font-size:\s*var\(--stagebook-h2-size/,
    );
    expect(cssWithoutComments).toMatch(
      /\bh3\s*{[^}]*font-size:\s*var\(--stagebook-h3-size/,
    );
    expect(cssWithoutComments).toMatch(
      /\bh4\s*{[^}]*font-size:\s*var\(--stagebook-h4-size/,
    );
  });

  it("styles bare <a> with stagebook-link and hover variants", () => {
    expect(cssWithoutComments).toMatch(
      /\ba\s*{[^}]*color:\s*var\(--stagebook-link[^)]*\)/,
    );
    expect(cssWithoutComments).toMatch(
      /\ba:hover\s*{[^}]*color:\s*var\(--stagebook-link-hover/,
    );
  });

  it("has no class selectors (the 'no .stagebook-* rules' contract)", () => {
    // The file must target bare tags only. Class selectors would put
    // styling on stagebook's own components and defeat the "host-only"
    // contract documented in the header.
    const ruleSelectors = [
      ...cssWithoutComments.matchAll(/([^{}]+){/g),
    ].flatMap((m) =>
      m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const classSelectors = ruleSelectors.filter((s) => s.includes("."));
    expect(classSelectors).toEqual([]);
  });
});
