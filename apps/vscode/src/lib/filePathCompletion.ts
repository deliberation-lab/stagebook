/**
 * Pure-function helpers for file-path completion / quick-fix in treatment
 * YAML. Kept VS Code-free so they can be unit-tested with vitest; the
 * extension host wires them into CompletionItemProvider / CodeActionProvider.
 *
 * The set of YAML field names covered here MUST stay in sync with
 * `FILE_FIELDS_BY_ELEMENT_TYPE` in
 * `packages/stagebook/src/utils/referencedAssets.ts` — that table is what
 * drives "file not found" diagnostics, so the same fields should offer
 * completions.
 */

/**
 * YAML field names that point at local asset paths and should trigger
 * file-path completion or surface quick-fix suggestions.
 *
 * After #249, `mediaPlayer.url` was renamed to `mediaPlayer.file`, so the
 * file-path family is just `file` and `captionsFile`.
 */
export const FILE_PATH_FIELDS = ["file", "captionsFile"] as const;

/**
 * Glob pattern covering every local-asset file type the extension cares
 * about (prompt/treatment docs, images, audio, video, captions). Used for
 * quick-fix suggestion candidates and as the default completion glob when
 * the user hasn't typed a partial path yet.
 */
export const ASSET_GLOB =
  "**/*.{prompt.md,md,yaml,jpg,jpeg,png,gif,webp,mp3,wav,m4a,ogg,mp4,webm,mov,vtt}";

export interface FilePathCompletionContext {
  /** The triggering field name (e.g. "file", "captionsFile"). */
  field: (typeof FILE_PATH_FIELDS)[number];
  /** The partial path the user has typed after `<field>:<whitespace>`. */
  partial: string;
  /**
   * Column index (0-based) in the original line where the value portion
   * begins — i.e. the first character after `<field>:` and its whitespace.
   */
  valueStart: number;
}

// `(?:^|[^\w-])` guards against treating the same field name embedded in a
// larger word or hyphenated identifier (`fileName:`, `my-file:`) as a match.
// Captured group 1 is the field name; group 2 is the whitespace matched by
// `\s+` between `:` and the value (at least one whitespace character).
const FIELD_PATTERN = new RegExp(
  `(?:^|[^\\w-])(${FILE_PATH_FIELDS.join("|")})\\s*:(\\s+)`,
  "g",
);

/**
 * Inspect the line-prefix up to the cursor and decide whether to offer file
 * completions. Returns the matched field name, the partial path typed so
 * far, and the column at which the value begins — or null if the prefix
 * doesn't end inside the value of one of the recognised fields.
 *
 * Takes the LAST occurrence so inline YAML like `{ name: x, file: ./y }`
 * resolves to the rightmost field.
 */
export function parseFilePathCompletionContext(
  lineBeforeCursor: string,
): FilePathCompletionContext | null {
  let last: RegExpExecArray | null = null;
  FIELD_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_PATTERN.exec(lineBeforeCursor)) !== null) {
    last = m;
  }
  if (!last) return null;

  const field = last[1] as (typeof FILE_PATH_FIELDS)[number];
  // `last.index` is the start offset of the overall match. If the regex
  // matched a preceding non-word/non-hyphen character via `(?:^|[^\w-])`,
  // the field starts one character later; if it matched `^`, the field
  // starts exactly at `last.index` (which is 0 at the beginning of the line).
  const fieldStart = last.index + (last[0].startsWith(field) ? 0 : 1);
  const valueStart = fieldStart + field.length + 1 + last[2].length; // +1 for ":"
  const partial = lineBeforeCursor.substring(valueStart);
  return { field, partial, valueStart };
}

/**
 * Build the glob pattern for the completion search given the partial path
 * already typed. When there's no partial, fall back to the full asset glob
 * so the user sees every candidate in the workspace.
 */
export function buildCompletionGlob(partial: string): string {
  const sanitized = partial.replace(/[*?[\]{}]/g, "\\$&");
  return sanitized ? `**/${sanitized}*` : ASSET_GLOB;
}
