import { describe, it, expect } from "vitest";
import { validatePromptSource } from "./validatePrompt";

describe("validatePromptSource", () => {
  describe("valid prompt files", () => {
    it("returns no diagnostics for a valid multipleChoice prompt", () => {
      const src = `---
name: test/prompt.prompt.md
type: multipleChoice
---
What is your favorite color?
---
- Red
- Blue
- Green`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toEqual([]);
    });

    it("returns no diagnostics for a valid noResponse prompt", () => {
      const src = `---
name: test/info.prompt.md
type: noResponse
---
Please read the following instructions carefully.
---
`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toEqual([]);
    });

    it("returns no diagnostics for a valid openResponse prompt", () => {
      const src = `---
name: test/open.prompt.md
type: openResponse
---
Please describe your experience.
---
> Your response here`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("structural errors", () => {
    it("reports error for missing --- delimiters", () => {
      const src = `Just some text without delimiters`;
      const result = validatePromptSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe("error");
      expect(result.diagnostics[0].message).toMatch(/section|delimiter/i);
    });

    it("reports error for only two delimiters", () => {
      const src = `---
name: test.prompt.md
type: noResponse
---
Body text but no third delimiter`;
      const result = validatePromptSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toMatch(/section|delimiter/i);
    });

    it("reports error for empty file", () => {
      const result = validatePromptSource("");
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("metadata errors", () => {
    it("reports error for missing type field", () => {
      const src = `---
name: test/prompt.prompt.md
---
Body text
---
`;
      const result = validatePromptSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe("error");
    });

    it("reports error for invalid type value", () => {
      const src = `---
name: test/prompt.prompt.md
type: invalidType
---
Body text
---
`;
      const result = validatePromptSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe("error");
    });

    it("reports error for rows on non-openResponse type", () => {
      const src = `---
name: test/prompt.prompt.md
type: multipleChoice
rows: 3
---
Pick one
---
- A
- B`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("rows"),
        }),
      );
    });
  });

  describe("response errors", () => {
    it("reports error for invalid response line format", () => {
      const src = `---
name: test/prompt.prompt.md
type: multipleChoice
---
Pick one
---
Red
Blue`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          message: expect.stringMatching(/response line|must start with/i),
        }),
      );
    });
  });

  describe("error position mapping", () => {
    it("maps metadata errors to the metadata section", () => {
      const src = `---
name: test/prompt.prompt.md
type: invalidType
---
Body text
---
`;
      const result = validatePromptSource(src);
      const metadataErrors = result.diagnostics.filter(
        (d) =>
          d.range !== null && d.range.startLine >= 1 && d.range.startLine <= 3,
      );
      expect(metadataErrors.length).toBeGreaterThan(0);
    });

    it("maps response errors to the response section", () => {
      const src = `---
name: test/prompt.prompt.md
type: multipleChoice
---
Pick one
---
bad line`;
      const result = validatePromptSource(src);
      const responseErrors = result.diagnostics.filter(
        (d) => d.range !== null && d.range.startLine >= 6,
      );
      expect(responseErrors.length).toBeGreaterThan(0);
    });
  });

  describe("extra delimiter warning", () => {
    it("warns when more than 3 --- delimiters exist", () => {
      const src = `---
name: test/prompt.prompt.md
type: noResponse
---
Some text
---
then a horizontal rule
---
`;
      const result = validatePromptSource(src);
      const warnings = result.diagnostics.filter(
        (d) => d.severity === "warning",
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toMatch(/horizontal rule|\*\*\*|___/i);
      expect(warnings[0].range).toEqual({
        startLine: 7,
        startCol: 0,
        endLine: 7,
        endCol: 3,
      });
    });
  });

  describe("slider type", () => {
    it("returns no diagnostics for a valid slider prompt", () => {
      const src = `---
name: test/slider.prompt.md
type: slider
min: 0
max: 100
interval: 10
---
Rate your agreement.
---
> Low
> High`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toEqual([]);
    });

    it("reports errors when slider is missing required fields", () => {
      const src = `---
name: test/slider.prompt.md
type: slider
---
Rate something.
---
> Low`;
      const result = validatePromptSource(src);
      const messages = result.diagnostics.map((d) => d.message);
      expect(messages).toContain("min is required for slider type");
      expect(messages).toContain("max is required for slider type");
      expect(messages).toContain("interval is required for slider type");
    });
  });

  describe("listSorter type", () => {
    it("returns no diagnostics for a valid listSorter prompt", () => {
      const src = `---
name: test/sort.prompt.md
type: listSorter
---
Rank these items.
---
> Item A
> Item B
> Item C`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("metadata YAML parse failure", () => {
    it("reports error for malformed YAML in metadata", () => {
      const src = `---
name: test/prompt.prompt.md
type: [unclosed bracket
---
Body text
---
`;
      const result = validatePromptSource(src);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("parse metadata YAML"),
          severity: "error",
        }),
      );
    });
  });

  describe("CRLF line endings", () => {
    it("handles CRLF line endings correctly", () => {
      const src =
        "---\r\nname: test/prompt.prompt.md\r\ntype: multipleChoice\r\n---\r\nPick one\r\n---\r\n- A\r\n- B";
      const result = validatePromptSource(src);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("metadata field position mapping", () => {
    it("maps metadata field error to the specific YAML key line", () => {
      const src = `---
name: test/prompt.prompt.md
type: multipleChoice
rows: 3
---
Pick one
---
- A
- B`;
      const result = validatePromptSource(src);
      const rowsError = result.diagnostics.find((d) =>
        d.message.includes("rows"),
      );
      expect(rowsError).toBeDefined();
      // "rows:" is on line 3 (0-indexed)
      expect(rowsError!.range!.startLine).toBe(3);
    });
  });
});
