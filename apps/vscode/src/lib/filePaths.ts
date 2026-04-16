import * as path from "path";

/**
 * Check whether a resolved filesystem path stays within a workspace boundary.
 *
 * Returns true if `resolvedFsPath` is exactly equal to `workspaceRootFsPath`
 * or is a descendant of it.
 */
export function isWithinWorkspace(
  resolvedFsPath: string,
  workspaceRootFsPath: string,
): boolean {
  if (resolvedFsPath === workspaceRootFsPath) return true;
  return resolvedFsPath.startsWith(workspaceRootFsPath + path.sep);
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
