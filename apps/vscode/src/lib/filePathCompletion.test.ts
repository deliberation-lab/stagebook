import { describe, it, expect } from "vitest";
import {
  ASSET_GLOB,
  buildCompletionGlob,
  parseFilePathCompletionContext,
} from "./filePathCompletion";

describe("parseFilePathCompletionContext", () => {
  it("triggers on bare `file:` with whitespace", () => {
    const ctx = parseFilePathCompletionContext("  - file: ");
    expect(ctx).not.toBeNull();
    expect(ctx!.field).toBe("file");
    expect(ctx!.partial).toBe("");
    expect(ctx!.valueStart).toBe("  - file: ".length);
  });

  it("triggers on `url:` for mediaPlayer — the whole point of this change", () => {
    const ctx = parseFilePathCompletionContext("      url: videos/intro");
    expect(ctx).not.toBeNull();
    expect(ctx!.field).toBe("url");
    expect(ctx!.partial).toBe("videos/intro");
  });

  it("triggers on `captionsFile:` for mediaPlayer captions", () => {
    const ctx = parseFilePathCompletionContext(
      "      captionsFile: subs/intro.vtt",
    );
    expect(ctx).not.toBeNull();
    expect(ctx!.field).toBe("captionsFile");
    expect(ctx!.partial).toBe("subs/intro.vtt");
  });

  it("returns the partial path the user has typed so far", () => {
    const ctx = parseFilePathCompletionContext("  file: ./assets/in");
    expect(ctx!.partial).toBe("./assets/in");
  });

  it("returns null when the line does not contain a recognized field", () => {
    expect(parseFilePathCompletionContext("  name: foo")).toBeNull();
    expect(parseFilePathCompletionContext("# comment only")).toBeNull();
    expect(parseFilePathCompletionContext("")).toBeNull();
  });

  it("does not match substrings of other identifiers (fileName, captionsFileName)", () => {
    expect(parseFilePathCompletionContext("  fileName: foo")).toBeNull();
    expect(
      parseFilePathCompletionContext("  captionsFileName: foo"),
    ).toBeNull();
  });

  it("does not match `sourceFile` or other words that happen to end in file", () => {
    // `sourceFile` ends in "file" but isn't the field name `file`. The field
    // regex requires a word boundary immediately before the field name; an
    // identifier character (like the `e` in `source`) breaks that.
    expect(parseFilePathCompletionContext("  sourceFile: foo")).toBeNull();
  });

  it("picks the rightmost field when multiple appear on the same line", () => {
    // Inline/flow YAML — rare but valid.
    const ctx = parseFilePathCompletionContext("{ name: x, url: videos/y ");
    expect(ctx!.field).toBe("url");
    expect(ctx!.partial).toBe("videos/y ");
  });

  it("requires at least one whitespace char between colon and value", () => {
    // YAML value must be separated by whitespace from the colon.
    expect(parseFilePathCompletionContext("  file:foo")).toBeNull();
  });

  it("reports valueStart as the column right after whitespace", () => {
    const line = "    url:   vids/";
    const ctx = parseFilePathCompletionContext(line);
    expect(ctx!.valueStart).toBe(line.indexOf("vids/"));
    expect(ctx!.partial).toBe("vids/");
  });
});

describe("buildCompletionGlob", () => {
  it("returns the asset glob when no partial is typed", () => {
    expect(buildCompletionGlob("")).toBe(ASSET_GLOB);
  });

  it("prefixes the partial with **/ and suffixes with * for narrowing", () => {
    expect(buildCompletionGlob("videos/intro")).toBe("**/videos/intro*");
  });

  it("escapes glob metacharacters in user input", () => {
    expect(buildCompletionGlob("foo[bar]")).toBe("**/foo\\[bar\\]*");
    expect(buildCompletionGlob("a*b?c")).toBe("**/a\\*b\\?c*");
    expect(buildCompletionGlob("a{b,c}")).toBe("**/a\\{b,c\\}*");
  });
});

describe("ASSET_GLOB", () => {
  it("includes the common local video container formats", () => {
    // The whole reason this glob exists is so local video file references
    // (mediaPlayer.url) surface in completions + quick-fixes.
    expect(ASSET_GLOB).toContain("mp4");
    expect(ASSET_GLOB).toContain("webm");
    expect(ASSET_GLOB).toContain("mov");
  });

  it("includes common audio and caption formats", () => {
    expect(ASSET_GLOB).toContain("mp3");
    expect(ASSET_GLOB).toContain("wav");
    expect(ASSET_GLOB).toContain("vtt");
  });

  it("keeps the prompt/markdown/yaml file types the autocomplete relied on", () => {
    expect(ASSET_GLOB).toContain("prompt.md");
    expect(ASSET_GLOB).toContain("md");
    expect(ASSET_GLOB).toContain("yaml");
  });
});
