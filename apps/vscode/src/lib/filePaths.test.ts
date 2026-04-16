import { describe, it, expect } from "vitest";
import * as path from "path";
import { isWithinWorkspace, relativizePath } from "./filePaths";

describe("isWithinWorkspace", () => {
  it("returns true when resolved path equals workspace root", () => {
    expect(isWithinWorkspace("/workspace", "/workspace")).toBe(true);
  });

  it("returns true for a direct child", () => {
    expect(
      isWithinWorkspace(path.join("/workspace", "file.txt"), "/workspace"),
    ).toBe(true);
  });

  it("returns true for a deeply nested path", () => {
    expect(
      isWithinWorkspace(
        path.join("/workspace", "a", "b", "c", "file.txt"),
        "/workspace",
      ),
    ).toBe(true);
  });

  it("returns false when path escapes workspace via traversal", () => {
    expect(isWithinWorkspace("/etc/passwd", "/workspace")).toBe(false);
  });

  it("returns false for a sibling directory with a shared prefix", () => {
    // "/workspace-other/file" should NOT match "/workspace"
    expect(
      isWithinWorkspace(
        path.join("/workspace-other", "file.txt"),
        "/workspace",
      ),
    ).toBe(false);
  });

  it("returns false for a parent directory", () => {
    expect(isWithinWorkspace("/", "/workspace")).toBe(false);
  });
});

describe("relativizePath", () => {
  it("returns a simple filename when file is in the base dir", () => {
    expect(
      relativizePath(
        "/workspace/study",
        path.join("/workspace/study", "q.prompt.md"),
      ),
    ).toBe("q.prompt.md");
  });

  it("returns a forward-slash path for a nested file", () => {
    expect(
      relativizePath(
        "/workspace/study",
        path.join("/workspace/study", "prompts", "q.prompt.md"),
      ),
    ).toBe("prompts/q.prompt.md");
  });

  it("returns ../ segments when file is in a sibling directory", () => {
    expect(
      relativizePath(
        path.join("/workspace", "study"),
        path.join("/workspace", "shared", "q.prompt.md"),
      ),
    ).toBe("../shared/q.prompt.md");
  });

  it("returns the same result when base and file are the same directory", () => {
    expect(relativizePath("/workspace", "/workspace")).toBe("");
  });

  it("uses forward slashes even on the current platform", () => {
    const result = relativizePath(
      path.join("/workspace", "a"),
      path.join("/workspace", "a", "b", "c.md"),
    );
    expect(result).not.toContain("\\");
    expect(result).toBe("b/c.md");
  });
});
