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
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toMatch(/horizontal rule|\*\*\*|___/i);
    });
  });
});
