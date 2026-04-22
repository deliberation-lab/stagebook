import { describe, test, expect } from "vitest";
import {
  getReferencedAssets,
  type ReferencedAsset,
} from "./referencedAssets.js";

// Helper: wrap a set of elements into a minimal treatmentFile-shaped object so
// tests exercise the real tree-walk (top level → treatments → gameStages →
// elements) rather than passing elements in isolation.
function treatmentWithElements(elements: unknown[]): unknown {
  return {
    introSequences: [],
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "stage1",
            duration: 60,
            elements,
          },
        ],
      },
    ],
  };
}

describe("getReferencedAssets — defensive input handling", () => {
  test("returns [] for null", () => {
    expect(getReferencedAssets(null)).toEqual([]);
  });

  test("returns [] for undefined", () => {
    expect(getReferencedAssets(undefined)).toEqual([]);
  });

  test("returns [] for primitive", () => {
    expect(getReferencedAssets("foo")).toEqual([]);
    expect(getReferencedAssets(42)).toEqual([]);
    expect(getReferencedAssets(true)).toEqual([]);
  });

  test("returns [] for empty object", () => {
    expect(getReferencedAssets({})).toEqual([]);
  });
});

describe("getReferencedAssets — element type allowlist", () => {
  test("prompt.file is collected", () => {
    const tree = treatmentWithElements([
      { type: "prompt", file: "intro.prompt.md" },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      path: "intro.prompt.md",
      field: "file",
      elementType: "prompt",
    });
  });

  test("image.file is collected", () => {
    const tree = treatmentWithElements([
      { type: "image", file: "assets/diagram.png", name: "diagram" },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets).toEqual<ReferencedAsset[]>([
      {
        path: "assets/diagram.png",
        field: "file",
        elementType: "image",
        elementName: "diagram",
        pathInTree: ["treatments", 0, "gameStages", 0, "elements", 0, "file"],
      },
    ]);
  });

  test("audio.file is collected", () => {
    const tree = treatmentWithElements([
      { type: "audio", file: "sounds/bell.mp3" },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      path: "sounds/bell.mp3",
      field: "file",
      elementType: "audio",
    });
  });

  test("mediaPlayer.url and mediaPlayer.captionsFile are both collected", () => {
    const tree = treatmentWithElements([
      {
        type: "mediaPlayer",
        url: "videos/intro.mp4",
        captionsFile: "videos/intro.vtt",
      },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets.map((a) => ({ path: a.path, field: a.field }))).toEqual([
      { path: "videos/intro.mp4", field: "url" },
      { path: "videos/intro.vtt", field: "captionsFile" },
    ]);
    expect(assets.every((a) => a.elementType === "mediaPlayer")).toBe(true);
  });

  test("timeline has no file-like fields — source is a name ref, not collected", () => {
    const tree = treatmentWithElements([
      {
        type: "timeline",
        name: "annots",
        source: "someElementName",
        selectionType: "point",
      },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("element types not in the allowlist contribute nothing", () => {
    const tree = treatmentWithElements([
      {
        type: "trackedLink",
        name: "followUp",
        url: "https://example.com/f",
        displayText: "Go",
      },
      { type: "qualtrics", url: "https://example.com/q" },
      { type: "survey", surveyName: "bigFive" },
      { type: "submitButton" },
      { type: "separator" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });
});

describe("getReferencedAssets — exclusions", () => {
  test("excludes entries with ${…} placeholder in the path", () => {
    const tree = treatmentWithElements([
      { type: "image", file: "${region}/logo.png" },
      { type: "prompt", file: "prompts/${variant}.prompt.md" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("excludes mediaPlayer.url when the value is a full https URL", () => {
    const tree = treatmentWithElements([
      { type: "mediaPlayer", url: "https://example.com/foo.mp4" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("excludes full http and protocol-relative URLs", () => {
    const tree = treatmentWithElements([
      { type: "mediaPlayer", url: "http://example.com/a.mp4" },
      { type: "mediaPlayer", url: "//cdn.example.com/b.mp4" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("excludes asset:// platform-provided references (#188)", () => {
    const tree = treatmentWithElements([
      {
        type: "mediaPlayer",
        url: "asset://group_recordings/training_video.mp4",
      },
      { type: "image", file: "asset://diagrams/flow.png" },
      { type: "audio", file: "asset://stings/intro.mp3" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("is case-insensitive on the asset:// scheme", () => {
    const tree = treatmentWithElements([
      { type: "mediaPlayer", url: "ASSET://clip.mp4" },
      { type: "mediaPlayer", url: "Asset://clip.mp4" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("excludes empty string paths", () => {
    const tree = treatmentWithElements([
      { type: "image", file: "" },
      { type: "mediaPlayer", url: "", captionsFile: "" },
    ]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("keeps local paths that merely contain a placeholder-like substring without braces", () => {
    // Only ${...} with braces counts as a template placeholder; a literal "$"
    // in a filename is fine.
    const tree = treatmentWithElements([
      { type: "image", file: "assets/price_$_99.png" },
    ]);
    expect(getReferencedAssets(tree)).toHaveLength(1);
  });
});

describe("getReferencedAssets — structural walk", () => {
  test("collects from intro sequences, game stages, and exit sequence in file order", () => {
    const tree = {
      introSequences: [
        {
          name: "seq1",
          introSteps: [
            {
              name: "welcome",
              elements: [{ type: "image", file: "intro/banner.png" }],
            },
          ],
        },
      ],
      treatments: [
        {
          name: "t1",
          playerCount: 1,
          gameStages: [
            {
              name: "stage1",
              duration: 60,
              elements: [
                { type: "audio", file: "stage/ping.mp3" },
                { type: "image", file: "stage/diagram.png" },
              ],
            },
          ],
          exitSequence: [
            {
              name: "goodbye",
              elements: [{ type: "prompt", file: "exit/thanks.prompt.md" }],
            },
          ],
        },
      ],
    };

    const assets = getReferencedAssets(tree);
    expect(assets.map((a) => a.path)).toEqual([
      "intro/banner.png",
      "stage/ping.mp3",
      "stage/diagram.png",
      "exit/thanks.prompt.md",
    ]);
  });

  test("returns correct pathInTree for an asset deep inside a gameStages array", () => {
    const tree = {
      introSequences: [],
      treatments: [
        {
          name: "t1",
          playerCount: 1,
          gameStages: [
            { name: "s0", duration: 60, elements: [{ type: "separator" }] },
            {
              name: "s1",
              duration: 60,
              elements: [
                { type: "separator" },
                { type: "image", file: "deep/nested.png", name: "target" },
              ],
            },
          ],
        },
      ],
    };

    const assets = getReferencedAssets(tree);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      path: "deep/nested.png",
      field: "file",
      elementType: "image",
      elementName: "target",
      pathInTree: ["treatments", 0, "gameStages", 1, "elements", 1, "file"],
    });
  });

  test("walks into templates so templated element trees contribute assets", () => {
    const tree = {
      templates: [
        {
          templateName: "introTpl",
          contentType: "elements",
          templateContent: [{ type: "image", file: "templated/img.png" }],
        },
      ],
      introSequences: [],
      treatments: [],
    };
    const assets = getReferencedAssets(tree);
    expect(assets.map((a) => a.path)).toEqual(["templated/img.png"]);
  });

  test("mediaPlayer captionsFile is collected even when url is a full URL", () => {
    // Under-validation regression guard: the reason this utility exists is
    // that the VS Code extension only checked `file`, missing captionsFile.
    const tree = treatmentWithElements([
      {
        type: "mediaPlayer",
        url: "https://example.com/foo.mp4",
        captionsFile: "captions/foo.vtt",
      },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      path: "captions/foo.vtt",
      field: "captionsFile",
    });
  });

  test("order within a single element follows field-declaration order (url before captionsFile)", () => {
    const tree = treatmentWithElements([
      {
        // Author wrote captionsFile first, url second — utility order is
        // governed by the allowlist table, not YAML key order.
        captionsFile: "cap.vtt",
        url: "video.mp4",
        type: "mediaPlayer",
      },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets.map((a) => a.field)).toEqual(["url", "captionsFile"]);
  });

  test("omits elementName when the element has no name", () => {
    const tree = treatmentWithElements([
      { type: "image", file: "assets/unnamed.png" },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets).toHaveLength(1);
    expect(assets[0].elementName).toBeUndefined();
  });

  test("pathInTree for mediaPlayer points at the specific field, not the element", () => {
    // Regression guard: pathInTree must include the field name so that
    // consumers can do source mapping directly without appending `field`.
    const tree = treatmentWithElements([
      {
        type: "mediaPlayer",
        url: "videos/x.mp4",
        captionsFile: "videos/x.vtt",
      },
    ]);
    const assets = getReferencedAssets(tree);
    expect(assets[0].pathInTree).toEqual([
      "treatments",
      0,
      "gameStages",
      0,
      "elements",
      0,
      "url",
    ]);
    expect(assets[1].pathInTree).toEqual([
      "treatments",
      0,
      "gameStages",
      0,
      "elements",
      0,
      "captionsFile",
    ]);
  });
});

describe("getReferencedAssets — prompt shorthand", () => {
  test("bare .prompt.md string inside elements is collected as prompt.file", () => {
    const tree = treatmentWithElements(["intro.prompt.md"]);
    const assets = getReferencedAssets(tree);
    expect(assets).toEqual<ReferencedAsset[]>([
      {
        path: "intro.prompt.md",
        field: "file",
        elementType: "prompt",
        elementName: "intro.prompt.md",
        pathInTree: ["treatments", 0, "gameStages", 0, "elements", 0],
      },
    ]);
  });

  test("shorthand works in intro and exit steps too", () => {
    const tree = {
      introSequences: [
        {
          name: "seq",
          introSteps: [{ name: "s", elements: ["intro.prompt.md"] }],
        },
      ],
      treatments: [
        {
          name: "t",
          playerCount: 1,
          gameStages: [
            { name: "g", duration: 1, elements: [{ type: "submitButton" }] },
          ],
          exitSequence: [{ name: "e", elements: ["exit.prompt.md"] }],
        },
      ],
    };
    const paths = getReferencedAssets(tree).map((a) => a.path);
    expect(paths).toEqual(["intro.prompt.md", "exit.prompt.md"]);
  });

  test("non-.prompt.md strings inside elements are not collected", () => {
    const tree = treatmentWithElements(["not-a-prompt.txt", 42, null]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("shorthand with template placeholder is excluded", () => {
    const tree = treatmentWithElements(["${variant}.prompt.md"]);
    expect(getReferencedAssets(tree)).toEqual([]);
  });

  test("bare .prompt.md strings outside an elements array are ignored", () => {
    // Safety: only recognise shorthand where the schema actually allows it.
    const tree = {
      introSequences: [],
      treatments: [
        {
          name: "t",
          playerCount: 1,
          notes: "see intro.prompt.md",
          gameStages: [
            {
              name: "g",
              duration: 1,
              elements: [{ type: "submitButton" }],
              // Some unrelated field that happens to hold a .prompt.md string
              foo: "bar.prompt.md",
            },
          ],
        },
      ],
    };
    expect(getReferencedAssets(tree)).toEqual([]);
  });
});

describe("getReferencedAssets — malformed input safety", () => {
  test("element with a prototype-chain `type` value doesn't crash the walker", () => {
    // `type in FILE_FIELDS_BY_ELEMENT_TYPE` would match built-in
    // Object.prototype keys like `toString`; using Object.hasOwn keeps the
    // walker safe from untrusted YAML that sets `type: "toString"`.
    const tree = treatmentWithElements([
      { type: "toString", file: "whatever" },
      { type: "constructor", file: "whatever" },
      { type: "__proto__", file: "whatever" },
    ]);
    expect(() => getReferencedAssets(tree)).not.toThrow();
    expect(getReferencedAssets(tree)).toEqual([]);
  });
});
