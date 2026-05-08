#!/usr/bin/env node
/**
 * Sister script to `codemod-298.mjs` for TypeScript fixtures.
 *
 * Operates on .ts/.tsx files via regex. Handles the two patterns that
 * cover ~95% of in-tree fixtures:
 *
 *   1. Object literal with `reference: "X.Y..."` and a sibling
 *      `position: <value>` (any order, on adjacent or nearby lines):
 *        → prepend the position to the reference; delete the position line.
 *
 *   2. Object literal with `reference: "X.Y..."` and no sibling position:
 *        → prepend `self.` to the reference.
 *
 * The first transformation runs object-literal-aware (matched by the
 * smallest enclosing `{...}`); the second is a global regex over
 * unmatched references.
 *
 * Skips:
 *   - References whose first segment is already a position selector.
 *   - References whose first segment isn't a recognized source enum
 *     (treats those as opaque strings — likely template fragments or
 *     test data, not actual references).
 *
 * Usage:
 *   node scripts/codemod-298-ts.mjs path/to/file.ts [...more]
 *   node scripts/codemod-298-ts.mjs --check path/to/file.ts
 */
import * as fs from "node:fs";

const SOURCES = [
  "prompt",
  "survey",
  "submitButton",
  "qualtrics",
  "timeline",
  "trackedLink",
  "discussion",
  "aggregate",
  "entryUrl",
  "connectionInfo",
  "browserInfo",
  "participantInfo",
];
const SOURCE_PATTERN = SOURCES.join("|");
const POSITION_PATTERN = String.raw`(?:\d+|"(?:self|shared|all|player|any)"|self|shared|all|player|any)`;

function normalizePos(raw) {
  // Strip surrounding quotes if any
  const v = raw.replace(/^"(.*)"$/, "$1");
  if (v === "player" || v === "self") return "self";
  if (v === "any") return "all";
  if (/^\d+$/.test(v)) return v;
  if (v === "shared" || v === "all") return v;
  return "self";
}

/** Find the matching close brace for the open brace at `start`. Returns
 *  index of the close brace, or -1 if unmatched. Naive — doesn't handle
 *  string escapes, but TS fixtures rarely have braces inside strings.
 */
function findMatchingClose(src, start) {
  let depth = 1;
  let i = start + 1;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  while (i < src.length) {
    const c = src[i];
    const prev = src[i - 1];
    if (!inDouble && !inBacktick && c === "'" && prev !== "\\") inSingle = !inSingle;
    else if (!inSingle && !inBacktick && c === '"' && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble && c === "`" && prev !== "\\") inBacktick = !inBacktick;
    else if (!inSingle && !inDouble && !inBacktick) {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    i++;
  }
  return -1;
}

/** Find each `reference: "..."` occurrence and find its enclosing `{...}`
 *  to look for a sibling `position:`. Returns array of edit operations.
 */
function planEdits(src) {
  const edits = [];
  // Match `reference: "X.Y..."` — must look like a reference (first
  // segment is a known source). Captures the full match and the
  // reference string content.
  const refRegex = new RegExp(
    `reference:\\s*"((${SOURCE_PATTERN})(?:\\.[^"\\s]+)+)"`,
    "g",
  );
  let m;
  while ((m = refRegex.exec(src)) !== null) {
    const refStartInMatch = m[0].indexOf('"');
    const refStart = m.index + refStartInMatch + 1;
    const refEnd = refStart + m[1].length;
    const refStr = m[1];

    // Look for the smallest enclosing `{` to scan its body for a
    // sibling `position:`. Walk backward to find an unmatched `{`.
    let braceIdx = -1;
    let depth = 0;
    for (let i = m.index - 1; i >= 0; i--) {
      const c = src[i];
      if (c === "}") depth++;
      else if (c === "{") {
        if (depth === 0) {
          braceIdx = i;
          break;
        }
        depth--;
      }
    }
    if (braceIdx === -1) {
      // Couldn't find enclosing object — fall back to "prepend self."
      edits.push({
        kind: "prefix",
        refStart,
        refEnd,
        original: refStr,
        replacement: `self.${refStr}`,
      });
      continue;
    }
    const closeIdx = findMatchingClose(src, braceIdx);
    if (closeIdx === -1) {
      edits.push({
        kind: "prefix",
        refStart,
        refEnd,
        original: refStr,
        replacement: `self.${refStr}`,
      });
      continue;
    }
    const body = src.slice(braceIdx + 1, closeIdx);
    // Look for a sibling `position:` inside this object body. Only
    // direct children — skip nested objects.
    const siblingPosition = findSiblingPosition(body);
    if (siblingPosition) {
      const position = normalizePos(siblingPosition.value);
      edits.push({
        kind: "prefix",
        refStart,
        refEnd,
        original: refStr,
        replacement: `${position}.${refStr}`,
      });
      // Compute absolute position of the position-line for deletion
      const posLineStart = braceIdx + 1 + siblingPosition.lineStart;
      const posLineEnd = braceIdx + 1 + siblingPosition.lineEnd;
      edits.push({
        kind: "deleteLine",
        start: posLineStart,
        end: posLineEnd,
      });
    } else {
      edits.push({
        kind: "prefix",
        refStart,
        refEnd,
        original: refStr,
        replacement: `self.${refStr}`,
      });
    }
  }
  return edits;
}

/** Within an object body (between `{` and `}`), find a top-level
 *  (depth-0) `position:` field. Returns `{ value, lineStart, lineEnd }`
 *  with offsets relative to the body, or null. */
function findSiblingPosition(body) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    const prev = body[i - 1];
    if (!inDouble && !inBacktick && c === "'" && prev !== "\\") inSingle = !inSingle;
    else if (!inSingle && !inBacktick && c === '"' && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble && c === "`" && prev !== "\\") inBacktick = !inBacktick;
    else if (!inSingle && !inDouble && !inBacktick) {
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
      else if (depth === 0 && body.slice(i, i + 9).match(/^position\s*:/)) {
        // Found a top-level position. Capture the value (literal or
        // string) up to the next `,` or end of body.
        const valueStart = body.indexOf(":", i) + 1;
        let valueEnd = valueStart;
        let vDepth = 0;
        while (valueEnd < body.length) {
          const vc = body[valueEnd];
          if (vc === "{" || vc === "[") vDepth++;
          else if (vc === "}" || vc === "]") vDepth--;
          else if (vc === "," && vDepth === 0) break;
          valueEnd++;
        }
        const value = body.slice(valueStart, valueEnd).trim();

        // Find the line bounds — start at the previous `\n` (or 0),
        // end at the next `\n` after the value (or body end).
        let lineStart = i;
        while (lineStart > 0 && body[lineStart - 1] !== "\n") lineStart--;
        let lineEnd = valueEnd;
        if (body[lineEnd] === ",") lineEnd++;
        while (lineEnd < body.length && body[lineEnd] !== "\n") lineEnd++;
        if (body[lineEnd] === "\n") lineEnd++;

        return { value, lineStart, lineEnd };
      }
    }
    i++;
  }
  return null;
}

function applyEdits(src, edits) {
  // Sort by start position descending so earlier edits don't shift
  // later edits' offsets.
  const all = edits
    .map((e) =>
      e.kind === "prefix"
        ? { start: e.refStart, end: e.refEnd, replacement: e.replacement }
        : { start: e.start, end: e.end, replacement: "" },
    )
    .sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of all) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }
  return out;
}

function processFile(filePath, checkOnly) {
  const original = fs.readFileSync(filePath, "utf-8");
  const edits = planEdits(original);
  if (edits.length === 0) {
    return { filePath, changed: false };
  }
  const updated = applyEdits(original, edits);
  if (updated === original) {
    return { filePath, changed: false };
  }
  if (!checkOnly) {
    fs.writeFileSync(filePath, updated, "utf-8");
  }
  return { filePath, changed: true };
}

function main() {
  const argv = process.argv.slice(2);
  const checkOnly = argv.includes("--check");
  const files = argv.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error("Usage: codemod-298-ts.mjs [--check] file.ts [file2.ts ...]");
    process.exit(2);
  }
  let anyChanged = false;
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`Skipping missing file: ${f}`);
      continue;
    }
    const r = processFile(f, checkOnly);
    if (r.changed) {
      anyChanged = true;
      console.log(`${checkOnly ? "[needs migration]" : "[migrated]"} ${f}`);
    } else {
      console.log(`[unchanged] ${f}`);
    }
  }
  if (checkOnly && anyChanged) process.exit(1);
}

main();
