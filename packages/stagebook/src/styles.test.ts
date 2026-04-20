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

// Issue #116: form resets, focus rings, and table styles previously
// hardcoded values instead of referencing the --stagebook-* tokens declared
// at :root. These tests pin the migration so hardcoded values can't sneak
// back in and drift from the themeable surface.
describe("styles.css uses theme variables for hardcoded values (#116)", () => {
  const css = readFileSync(stylesPath, "utf8");

  // Strip the :root declaration block so we only look at rule bodies —
  // otherwise the token declarations themselves would always match. Guard
  // every index: if :root is renamed or deleted, indexOf returns -1 and
  // the resulting slice would be silently wrong, causing bare-literal
  // assertions to pass when they shouldn't.
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rootSelectorIdx = cssWithoutComments.indexOf(":root");
  expect(rootSelectorIdx).toBeGreaterThanOrEqual(0);
  const rootOpenIdx = cssWithoutComments.indexOf("{", rootSelectorIdx);
  expect(rootOpenIdx).toBeGreaterThanOrEqual(0);
  const rootCloseIdx = cssWithoutComments.indexOf("}", rootOpenIdx);
  expect(rootCloseIdx).toBeGreaterThanOrEqual(0);
  const outsideRoot =
    cssWithoutComments.slice(0, rootOpenIdx) +
    cssWithoutComments.slice(rootCloseIdx + 1);

  it("declares a --stagebook-surface token for form control backgrounds", () => {
    expect(css).toMatch(/--stagebook-surface\s*:/);
  });

  it.each([
    ["var(--stagebook-border, #d1d5db)", "form/table border"],
    ["var(--stagebook-text, #1f2937)", "form text color"],
    ["var(--stagebook-surface, #fff)", "form control background"],
    ["var(--stagebook-prompt-max-width, 36rem)", "table max-width"],
    ["var(--stagebook-bg-muted, #f9fafb)", "table header background"],
  ])("references %s (%s)", (needle) => {
    expect(css).toContain(needle);
  });

  it("derives focus ring border-color from --stagebook-primary", () => {
    // focus blocks appear after :root — they must reference the primary token
    // rather than the literal #3b82f6.
    expect(outsideRoot).toMatch(
      /border-color:\s*var\(--stagebook-primary[^)]*\)/,
    );
  });

  it("derives focus ring box-shadow from --stagebook-primary", () => {
    // Either direct reference to --stagebook-primary, or to the derived
    // --stagebook-focus-ring token. The focus-ring token must itself be
    // derivable from --stagebook-primary, either unconditionally OR inside
    // an @supports(color-mix) override — the unconditional default may be
    // a static rgba so browsers without color-mix keep a visible ring.
    const focusRingDerivesFromPrimary =
      /--stagebook-focus-ring\s*:\s*color-mix\([^)]*var\(--stagebook-primary/;
    expect(css).toMatch(focusRingDerivesFromPrimary);
    expect(outsideRoot).toMatch(
      /box-shadow:[^;]*var\(--stagebook-(?:primary|focus-ring)/,
    );
  });

  it("uses --stagebook-primary for checkbox/radio checked fill", () => {
    // Find the :checked rule and assert it references the primary token for
    // both background-color and border-color.
    const checkedBlock =
      /input\[type="checkbox"\]:checked,\s*input\[type="radio"\]:checked\s*\{([\s\S]+?)\}/.exec(
        outsideRoot,
      );
    expect(checkedBlock?.[1]).toBeDefined();
    expect(checkedBlock?.[1]).toMatch(
      /background-color:\s*var\(--stagebook-primary/,
    );
    expect(checkedBlock?.[1]).toMatch(
      /border-color:\s*var\(--stagebook-primary/,
    );
  });

  // The literal-value checks strip `var(--token, fallback)` calls first: the
  // fallback is the *documented* fallback and only resolves when the variable
  // is missing, so hosts that override --stagebook-primary get their value.
  // What we want to catch is bare literal uses that bypass the variable
  // entirely.
  //
  // A naive /var\([^)]*\)/ regex would mis-handle nested parens in
  // fallbacks like `var(--x, rgba(0,0,0,0.5))`, so scan with a balanced
  // paren counter instead.
  const stripVarCalls = (s: string): string => {
    let out = "";
    for (let i = 0; i < s.length; i += 1) {
      if (s.startsWith("var(", i)) {
        let depth = 0;
        let j = i;
        for (; j < s.length; j += 1) {
          const ch = s[j];
          if (ch === "(") depth += 1;
          else if (ch === ")") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        if (j < s.length && depth === 0) {
          i = j;
          continue;
        }
      }
      out += s[i];
    }
    return out;
  };

  it("has no bare literal #3b82f6 references outside :root and var() fallbacks", () => {
    expect(stripVarCalls(outsideRoot)).not.toMatch(/#3b82f6\b/i);
  });

  it("has no bare literal rgba(59, 130, 246, ...) references outside :root and var() fallbacks", () => {
    expect(stripVarCalls(outsideRoot)).not.toMatch(
      /rgba\(\s*59\s*,\s*130\s*,\s*246/,
    );
  });
});
