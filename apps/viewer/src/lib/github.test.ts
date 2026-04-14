import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./github";

describe("parseGitHubUrl", () => {
  it("parses a standard GitHub blob URL", () => {
    const result = parseGitHubUrl(
      "https://github.com/deliberation-lab/example/blob/main/treatments/study1.yaml",
    );
    expect(result).toEqual({
      owner: "deliberation-lab",
      repo: "example",
      branch: "main",
      filePath: "treatments/study1.yaml",
      rawFileUrl:
        "https://raw.githubusercontent.com/deliberation-lab/example/main/treatments/study1.yaml",
      rawBaseUrl:
        "https://raw.githubusercontent.com/deliberation-lab/example/main/treatments/",
    });
  });

  it("handles nested paths", () => {
    const result = parseGitHubUrl(
      "https://github.com/org/repo/blob/feature-branch/deep/nested/path/treatment.yaml",
    );
    expect(result).toEqual({
      owner: "org",
      repo: "repo",
      branch: "feature-branch",
      filePath: "deep/nested/path/treatment.yaml",
      rawFileUrl:
        "https://raw.githubusercontent.com/org/repo/feature-branch/deep/nested/path/treatment.yaml",
      rawBaseUrl:
        "https://raw.githubusercontent.com/org/repo/feature-branch/deep/nested/path/",
    });
  });

  it("handles a file at the repo root", () => {
    const result = parseGitHubUrl(
      "https://github.com/org/repo/blob/main/treatment.yaml",
    );
    expect(result).toEqual({
      owner: "org",
      repo: "repo",
      branch: "main",
      filePath: "treatment.yaml",
      rawFileUrl:
        "https://raw.githubusercontent.com/org/repo/main/treatment.yaml",
      rawBaseUrl: "https://raw.githubusercontent.com/org/repo/main/",
    });
  });

  it("parses a raw.githubusercontent.com URL", () => {
    const result = parseGitHubUrl(
      "https://raw.githubusercontent.com/org/repo/main/treatments/study.yaml",
    );
    expect(result).toEqual({
      owner: "org",
      repo: "repo",
      branch: "main",
      filePath: "treatments/study.yaml",
      rawFileUrl:
        "https://raw.githubusercontent.com/org/repo/main/treatments/study.yaml",
      rawBaseUrl: "https://raw.githubusercontent.com/org/repo/main/treatments/",
    });
  });

  it("parses a raw.githubusercontent.com URL at repo root", () => {
    const result = parseGitHubUrl(
      "https://raw.githubusercontent.com/org/repo/main/file.yaml",
    );
    expect(result).toEqual({
      owner: "org",
      repo: "repo",
      branch: "main",
      filePath: "file.yaml",
      rawFileUrl: "https://raw.githubusercontent.com/org/repo/main/file.yaml",
      rawBaseUrl: "https://raw.githubusercontent.com/org/repo/main/",
    });
  });

  it("throws on a non-GitHub URL", () => {
    expect(() =>
      parseGitHubUrl("https://gitlab.com/org/repo/blob/main/file.yaml"),
    ).toThrow();
  });

  it("throws on a GitHub URL without blob path", () => {
    expect(() => parseGitHubUrl("https://github.com/org/repo")).toThrow();
  });

  it("throws on an invalid URL", () => {
    expect(() => parseGitHubUrl("not-a-url")).toThrow();
  });
});
