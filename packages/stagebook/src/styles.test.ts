import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stylesPath = join(here, "styles.css");
const componentsDir = join(here, "components");

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collectFiles(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

function extractDefined(css: string): Set<string> {
  // Strip block comments first so documented override examples like
  // `--stagebook-foo: ...` inside `/* ... */` aren't mistaken for real
  // declarations.
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Matches `--stagebook-foo:` (only declarations on the left-hand side).
  const defined = new Set<string>();
  const re = /(--stagebook-[\w-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssWithoutComments)) !== null) defined.add(m[1]);
  return defined;
}

function extractReferenced(source: string): Set<string> {
  // Only match names in real reference contexts: var(--name), getComputedStyle
  // property lookups, or CSSProperties / inline-style object keys. This
  // avoids false positives from prose comments like `--stagebook-prompt-*`.
  const referenced = new Set<string>();
  const patterns = [
    /var\(\s*(--stagebook-[a-z0-9][a-z0-9-]*)/gi,
    /getPropertyValue\(\s*["'](--stagebook-[a-z0-9][a-z0-9-]*)["']/gi,
    /["'](--stagebook-[a-z0-9][a-z0-9-]*)["']\s*:/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) referenced.add(m[1]);
  }
  return referenced;
}

describe("styles.css custom property coverage", () => {
  it("defines every --stagebook-* property referenced by component sources", () => {
    const css = readFileSync(stylesPath, "utf8");
    const defined = extractDefined(css);

    const files = collectFiles(componentsDir);
    const offenders: { file: string; name: string }[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const name of extractReferenced(src)) {
        if (!defined.has(name)) {
          offenders.push({ file, name });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
