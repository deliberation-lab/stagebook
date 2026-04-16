import * as path from "path";

/**
 * Check whether a resolved filesystem path stays within a workspace boundary.
 *
 * Returns true if `resolvedFsPath` is exactly equal to `workspaceRootFsPath`
 * or is a descendant of it. Both paths are normalized via `path.resolve` so
 * trailing separators and unnormalized segments don't affect the result.
 *
 * Note: this is a string-level check; it does not resolve symlinks. A symlink
 * inside the workspace pointing outside it will pass this check.
 */
export function isWithinWorkspace(
  resolvedFsPath: string,
  workspaceRootFsPath: string,
): boolean {
  const normalizedResolved = path.resolve(resolvedFsPath);
  const normalizedRoot = path.resolve(workspaceRootFsPath);
  if (normalizedResolved === normalizedRoot) return true;
  const rel = path.relative(normalizedRoot, normalizedResolved);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Compute a forward-slash-separated relative path from a base directory
 * to a file. Used to express file paths relative to a treatment file's
 * directory for quick-fix suggestions and autocomplete completions.
 */
export function relativizePath(
  baseDirFsPath: string,
  fileFsPath: string,
): string {
  return path.relative(baseDirFsPath, fileFsPath).split(path.sep).join("/");
}
