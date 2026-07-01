/**
 * Build a single `findFiles` exclude glob that honors the user's configured
 * excludes.
 *
 * `vscode.workspace.findFiles(include, exclude)` applies the default
 * `files.exclude` only when `exclude` is `undefined`, and never applies
 * `search.exclude`. Passing any concrete glob (as the workspace-validation
 * command must, to skip `node_modules`) therefore silently discards BOTH
 * user settings. To keep honoring them we merge `files.exclude` +
 * `search.exclude` (plus any `extra` patterns) into one brace glob and pass
 * that explicitly.
 *
 * A setting entry counts as enabled unless its value is exactly `false`
 * (VS Code allows `true` or a `{ when: ... }` object; we treat any non-`false`
 * value as on, ignoring the `when` predicate — a conservative over-exclude is
 * safer here than surfacing diagnostics for a file the user hid).
 */
export function buildFindExcludeGlob(
  filesExclude: Record<string, unknown>,
  searchExclude: Record<string, unknown>,
  extra: string[],
): string | undefined {
  const patterns: string[] = [];
  const add = (glob: string, enabled: boolean): void => {
    if (enabled && !patterns.includes(glob)) patterns.push(glob);
  };

  for (const [glob, value] of Object.entries(filesExclude)) {
    add(glob, value !== false);
  }
  for (const [glob, value] of Object.entries(searchExclude)) {
    add(glob, value !== false);
  }
  for (const glob of extra) {
    add(glob, true);
  }

  if (patterns.length === 0) return undefined;
  // A single-element brace list (`{a}`) is not expanded by VS Code's glob
  // engine, so emit the bare pattern in that case.
  if (patterns.length === 1) return patterns[0];
  return `{${patterns.join(",")}}`;
}
