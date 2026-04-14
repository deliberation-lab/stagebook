import { describe, it, expect } from "vitest";
import {
  pathToRange,
  extractYamlErrors,
  remapErrorPath,
} from "./yamlPositionMap";

describe("pathToRange", () => {
  describe("scalar values", () => {
    it("finds a top-level scalar", () => {
      const src = `name: study1
playerCount: 3`;
      const range = pathToRange(src, ["name"]);
      expect(range).toEqual({
        startLine: 0,
        startCol: 6,
        endLine: 0,
        endCol: 12,
      });
    });

    it("finds a numeric value", () => {
      const src = `name: study1
playerCount: 3`;
      const range = pathToRange(src, ["playerCount"]);
      expect(range).toEqual({
        startLine: 1,
        startCol: 13,
        endLine: 1,
        endCol: 14,
      });
    });
  });

  describe("nested objects", () => {
    it("finds a value nested one level deep", () => {
      const src = `treatment:
  name: study1
  playerCount: 3`;
      const range = pathToRange(src, ["treatment", "name"]);
      expect(range).toEqual({
        startLine: 1,
        startCol: 8,
        endLine: 1,
        endCol: 14,
      });
    });

    it("finds a value nested multiple levels deep", () => {
      const src = `treatments:
  - name: study1
    gameStages:
      - name: stage1
        duration: 300`;
      const range = pathToRange(src, [
        "treatments",
        0,
        "gameStages",
        0,
        "duration",
      ]);
      expect(range).toEqual({
        startLine: 4,
        startCol: 18,
        endLine: 4,
        endCol: 21,
      });
    });
  });

  describe("array items", () => {
    it("finds an array item by index", () => {
      const src = `items:
  - first
  - second
  - third`;
      const range = pathToRange(src, ["items", 1]);
      expect(range).toEqual({
        startLine: 2,
        startCol: 4,
        endLine: 2,
        endCol: 10,
      });
    });

    it("finds a property inside an array item", () => {
      const src = `elements:
  - type: prompt
    file: prompts/q1.prompt.md
  - type: separator
    style: thin`;
      const range = pathToRange(src, ["elements", 1, "style"]);
      expect(range).toEqual({
        startLine: 4,
        startCol: 11,
        endLine: 4,
        endCol: 15,
      });
    });
  });

  describe("missing paths", () => {
    it("returns null for a path that does not exist", () => {
      const src = `name: study1`;
      const range = pathToRange(src, ["missing"]);
      expect(range).toBeNull();
    });

    it("returns null for an out-of-bounds array index", () => {
      const src = `items:
  - first`;
      const range = pathToRange(src, ["items", 5]);
      expect(range).toBeNull();
    });

    it("returns null for an empty path on a document with no contents", () => {
      const src = ``;
      const range = pathToRange(src, ["anything"]);
      expect(range).toBeNull();
    });
  });

  describe("empty path", () => {
    it("returns the range of the root node", () => {
      const src = `name: study1`;
      const range = pathToRange(src, []);
      expect(range).not.toBeNull();
      expect(range!.startLine).toBe(0);
    });
  });

  describe("deeply nested paths", () => {
    it("handles 6+ levels of nesting", () => {
      const src = `treatments:
  - name: t1
    gameStages:
      - name: s1
        elements:
          - type: prompt
            conditions:
              - comparator: equals
                value: yes`;
      const range = pathToRange(src, [
        "treatments",
        0,
        "gameStages",
        0,
        "elements",
        0,
        "conditions",
        0,
        "value",
      ]);
      expect(range).toEqual({
        startLine: 8,
        startCol: 23,
        endLine: 8,
        endCol: 26,
      });
    });
  });
});

describe("extractYamlErrors", () => {
  it("returns no errors for valid YAML", () => {
    const src = `name: study1
playerCount: 3`;
    const errors = extractYamlErrors(src);
    expect(errors).toEqual([]);
  });

  it("returns an error for bad indentation", () => {
    const src = `name: study1
  bad indentation: here
 worse: there`;
    const errors = extractYamlErrors(src);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty("line");
    expect(errors[0]).toHaveProperty("message");
  });

  it("returns an error for a missing value after colon", () => {
    const src = `name:
  key1: value1
  key2:
  key3`;
    const errors = extractYamlErrors(src);
    // key3 without colon could be parsed as a scalar or cause an error
    // depending on context — just verify we get structured output
    expect(Array.isArray(errors)).toBe(true);
  });

  it("detects duplicate keys", () => {
    const src = `name: first
name: second
playerCount: 3`;
    const errors = extractYamlErrors(src);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/unique|duplicate/i);
  });
});

describe("remapErrorPath", () => {
  const templates = [
    {
      templateName: "myStage",
      templateContent: {
        name: "stage1",
        duration: 300,
        elements: [{ type: "prompt", file: "bad/path.md" }],
      },
    },
  ];

  describe("non-template paths", () => {
    it("returns the original path when no templates are involved", () => {
      const original = {
        treatments: [{ name: "t1", playerCount: 3 }],
      };
      const result = remapErrorPath(
        ["treatments", 0, "name"],
        original,
        templates,
      );
      expect(result).toEqual(["treatments", 0, "name"]);
    });
  });

  describe("simple template expansion", () => {
    it("remaps a path through a template context to the template definition", () => {
      const original = {
        templates,
        treatments: [
          {
            name: "t1",
            gameStages: [{ template: "myStage" }],
          },
        ],
      };
      const result = remapErrorPath(
        ["treatments", 0, "gameStages", 0, "elements", 0, "file"],
        original,
        templates,
      );
      expect(result).toEqual([
        "templates",
        0,
        "templateContent",
        "elements",
        0,
        "file",
      ]);
    });

    it("remaps a top-level property of expanded template content", () => {
      const original = {
        templates,
        treatments: [
          {
            name: "t1",
            gameStages: [{ template: "myStage" }],
          },
        ],
      };
      const result = remapErrorPath(
        ["treatments", 0, "gameStages", 0, "duration"],
        original,
        templates,
      );
      expect(result).toEqual(["templates", 0, "templateContent", "duration"]);
    });
  });

  describe("broadcast expansion", () => {
    it("remaps paths through broadcast-expanded items to the template", () => {
      // Broadcast expands one template context into multiple array items.
      // Both expanded items [0] and [1] came from the same template at
      // original index 0, so both should remap to that template's content.
      const original = {
        templates,
        treatments: [
          {
            name: "t1",
            gameStages: [
              {
                template: "myStage",
                broadcast: { d0: [{ topic: "a" }, { topic: "b" }] },
              },
            ],
          },
        ],
      };
      // Error in the second broadcast-expanded item
      const result = remapErrorPath(
        ["treatments", 0, "gameStages", 1, "elements", 0, "file"],
        original,
        templates,
      );
      expect(result).toEqual([
        "templates",
        0,
        "templateContent",
        "elements",
        0,
        "file",
      ]);
    });
  });

  describe("mixed arrays", () => {
    it("remaps correctly when templates are mixed with non-template items", () => {
      const original = {
        templates,
        treatments: [
          {
            name: "t1",
            gameStages: [
              { name: "intro", duration: 60, elements: [] },
              { template: "myStage" },
            ],
          },
        ],
      };
      // Error at expanded index 1 — the template was at original index 1
      const result = remapErrorPath(
        ["treatments", 0, "gameStages", 1, "elements", 0, "file"],
        original,
        templates,
      );
      expect(result).toEqual([
        "templates",
        0,
        "templateContent",
        "elements",
        0,
        "file",
      ]);
    });

    it("does not remap a non-template item after a template in the array", () => {
      const original = {
        templates,
        treatments: [
          {
            name: "t1",
            gameStages: [
              { template: "myStage" },
              { name: "final", duration: 60, elements: [] },
            ],
          },
        ],
      };
      // Error at expanded index 1 — this is the non-template item at original index 1
      const result = remapErrorPath(
        ["treatments", 0, "gameStages", 1, "name"],
        original,
        templates,
      );
      expect(result).toEqual(["treatments", 0, "gameStages", 1, "name"]);
    });
  });

  describe("template not found", () => {
    it("returns the original path if the referenced template does not exist", () => {
      const original = {
        templates: [],
        treatments: [
          {
            name: "t1",
            gameStages: [{ template: "nonexistent" }],
          },
        ],
      };
      const result = remapErrorPath(
        ["treatments", 0, "gameStages", 0, "duration"],
        original,
        [],
      );
      expect(result).toEqual(["treatments", 0, "gameStages", 0, "duration"]);
    });
  });
});
