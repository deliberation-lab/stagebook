#!/usr/bin/env node
/**
 * Codemod for #298 — position-prefixed reference grammar.
 *
 * Migrates a treatment YAML file from the pre-#298 reference grammar
 * (sibling `position:` fields, refs like `prompt.X.value`) to the new
 * grammar (refs like `0.prompt.X.value`, `self.prompt.X.value`).
 *
 * Heuristic transformation operating on parsed YAML:
 *
 * 1. For each condition leaf with `{ reference, position?, comparator, ... }`:
 *    - Prepend the position prefix to `reference:` (`self` if absent,
 *      `player` ↔ `self`, `any` ↔ `all`, integer index, `shared`, `all`).
 *    - Delete the sibling `position:` field.
 *
 * 2. For each `display` element with `{ reference, position?, ... }`:
 *    - Same as above; position folds into the reference string.
 *
 * 3. For each urlParam (`trackedLink.urlParams[]`, `qualtrics.urlParams[]`)
 *    with `{ reference?, position?, ... }`:
 *    - Same.
 *
 * 4. For bare reference strings already in dotted form, prepend `self.`
 *    if the first segment is a known source (and not already a position
 *    selector).
 *
 * Limitations:
 * - Operates on parsed YAML, so YAML comments and formatting are not
 *   preserved. Authors using significant comments should diff carefully.
 * - Doesn't recurse into template `content:` if the content shape isn't
 *   a recognizable element/condition tree — those edges may need a
 *   manual touch-up.
 *
 * Usage:
 *   node scripts/codemod-298.mjs path/to/study.treatments.yaml [...more files]
 *   node scripts/codemod-298.mjs --check path/to/study.treatments.yaml   # exit 1 if changes needed, no write
 *
 * For test fixtures embedded in TypeScript, the same transformation
 * applies but you'll need to run it on YAML, then port back. Or do the
 * fixtures by hand — they're typically small.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";

const KNOWN_NAMED_SOURCES = new Set([
  "prompt",
  "survey",
  "submitButton",
  "qualtrics",
  "timeline",
  "trackedLink",
  "discussion",
  "aggregate", // for forward-compat with #299
]);
const KNOWN_EXTERNAL_SOURCES = new Set([
  "entryUrl",
  "connectionInfo",
  "browserInfo",
  "participantInfo",
]);
const POSITION_NAMES = new Set(["self", "shared", "all"]);

function isPositionToken(token) {
  if (POSITION_NAMES.has(token)) return true;
  return /^[0-9]+$/.test(token);
}

/** Map a pre-#298 position value to the post-#298 position selector. */
function normalizePositionValue(p) {
  if (p === undefined || p === null) return "self";
  if (typeof p === "number") return String(p);
  if (typeof p === "string") {
    if (p === "player" || p === "self") return "self";
    if (p === "any") return "all";
    if (p === "shared" || p === "all") return p;
    if (/^[0-9]+$/.test(p)) return p;
  }
  return "self";
}

/** Add a position prefix to a string reference, or leave it alone if it
 *  already has one. */
function prefixReferenceString(refStr, position) {
  if (typeof refStr !== "string") return refStr;
  const segments = refStr.split(".");
  if (segments.length === 0) return refStr;
  // Already prefixed?
  if (isPositionToken(segments[0])) return refStr;
  // Leading segment is a recognized source — prepend the position.
  if (
    KNOWN_NAMED_SOURCES.has(segments[0]) ||
    KNOWN_EXTERNAL_SOURCES.has(segments[0])
  ) {
    return `${position}.${refStr}`;
  }
  // Unrecognized leading segment — leave as-is and let validation
  // produce a clearer error than this codemod could.
  return refStr;
}

/** Apply the migration to a structured reference object form. */
function migrateStructuredRef(ref, position) {
  if (!ref || typeof ref !== "object") return ref;
  if ("position" in ref) return ref; // already migrated
  return { position, ...ref };
}

let touched = false;

/** Walk an arbitrary object/array tree, applying #298 transformations
 *  at every recognizable site. Mutates in place. */
function walk(node) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== "object") return;

  // Leaf condition / display element / urlParam: any object with both
  // `reference` and `position`, OR a `reference` whose string lacks a
  // position prefix.
  if ("reference" in node) {
    const position = normalizePositionValue(node.position);
    if (typeof node.reference === "string") {
      const before = node.reference;
      node.reference = prefixReferenceString(node.reference, position);
      if (node.reference !== before) touched = true;
    } else if (node.reference && typeof node.reference === "object") {
      const before = JSON.stringify(node.reference);
      node.reference = migrateStructuredRef(node.reference, position);
      if (JSON.stringify(node.reference) !== before) touched = true;
    }
    if ("position" in node) {
      delete node.position;
      touched = true;
    }
  }

  // Recurse into all child values (we don't know which keys carry
  // nested refs without coupling to the schema; walking everything is
  // the easiest correct option).
  for (const key of Object.keys(node)) {
    walk(node[key]);
  }
}

function processFile(filePath, checkOnly) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const doc = yaml.load(raw);
  touched = false;
  walk(doc);
  if (!touched) {
    return { filePath, changed: false };
  }
  if (checkOnly) {
    return { filePath, changed: true };
  }
  const out = yaml.dump(doc, { lineWidth: 1000 });
  fs.writeFileSync(filePath, out, "utf-8");
  return { filePath, changed: true };
}

function main() {
  const argv = process.argv.slice(2);
  const checkOnly = argv.includes("--check");
  const files = argv.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error(
      "Usage: codemod-298.mjs [--check] file.yaml [file2.yaml ...]",
    );
    process.exit(2);
  }

  let anyChanged = false;
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`Skipping missing file: ${f}`);
      continue;
    }
    const result = processFile(path.resolve(f), checkOnly);
    if (result.changed) {
      anyChanged = true;
      console.log(
        `${checkOnly ? "[needs migration]" : "[migrated]"} ${result.filePath}`,
      );
    } else {
      console.log(`[unchanged] ${result.filePath}`);
    }
  }

  if (checkOnly && anyChanged) process.exit(1);
}

main();
