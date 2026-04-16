import { describe, it, expect } from "vitest";
import * as path from "path";
import { isWithinWorkspace, relativizePath } from "./filePaths";

// Construct paths using the platform's native separator so tests work on
// both POSIX and Windows. The leading path.sep makes each a rooted path.
const ROOT = path.join(path.sep, "workspace");

describe("isWithinWorkspace", () => {
  it("returns true when resolved path equals workspace root", () => {
    expect(isWithinWorkspace(ROOT, ROOT)).toBe(true);
  });

  it("returns true for a direct child", () => {
    expect(isWithinWorkspace(path.join(ROOT, "file.txt"), ROOT)).toBe(true);
  });

  it("returns true for a deeply nested path", () => {
    expect(
      isWithinWorkspace(path.join(ROOT, "a", "b", "c", "file.txt"), ROOT),
    ).toBe(true);
  });

  it("returns false when path escapes workspace via traversal", () => {
    const outside = path.join(path.sep, "etc", "passwd");
    expect(isWithinWorkspace(outside, ROOT)).toBe(false);
  });

  it("returns false for a sibling directory with a shared prefix", () => {
    // "/workspace-other/file" should NOT match "/workspace"
    const sibling = path.join(path.sep, "workspace-other", "file.txt");
    expect(isWithinWorkspace(sibling, ROOT)).toBe(false);
  });

  it("returns false for a parent directory", () => {
    expect(isWithinWorkspace(path.sep, ROOT)).toBe(false);
  });

  it("tolerates a trailing separator on the workspace root", () => {
    expect(
      isWithinWorkspace(path.join(ROOT, "file.txt"), ROOT + path.sep),
    ).toBe(true);
  });

  it("handles the filesystem root as workspace root", () => {
    const fsRoot = path.sep;
    expect(isWithinWorkspace(path.join(fsRoot, "anything"), fsRoot)).toBe(true);
    expect(isWithinWorkspace(fsRoot, fsRoot)).toBe(true);
  });

  it("normalizes unclean input paths", () => {
    // path.resolve collapses "." and redundant separators
    const messy = path.join(ROOT, ".", "a", "b", "..", "file.txt");
    expect(isWithinWorkspace(messy, ROOT)).toBe(true);
  });
});

describe("relativizePath", () => {
  it("returns a simple filename when file is in the base dir", () => {
    const base = path.join(ROOT, "study");
    expect(relativizePath(base, path.join(base, "q.prompt.md"))).toBe(
      "q.prompt.md",
    );
  });

  it("returns a forward-slash path for a nested file", () => {
    const base = path.join(ROOT, "study");
    expect(
      relativizePath(base, path.join(base, "prompts", "q.prompt.md")),
    ).toBe("prompts/q.prompt.md");
  });

  it("returns ../ segments when file is in a sibling directory", () => {
    expect(
      relativizePath(
        path.join(ROOT, "study"),
        path.join(ROOT, "shared", "q.prompt.md"),
      ),
    ).toBe("../shared/q.prompt.md");
  });

  it("returns an empty string when base and file are the same directory", () => {
    expect(relativizePath(ROOT, ROOT)).toBe("");
  });

  it("uses forward slashes even on platforms where path.sep is a backslash", () => {
    const base = path.join(ROOT, "a");
    const result = relativizePath(base, path.join(base, "b", "c.md"));
    expect(result).not.toContain("\\");
    expect(result).toBe("b/c.md");
  });
});
