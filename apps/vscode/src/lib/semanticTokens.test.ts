import { describe, it, expect } from "vitest";
import { computeSemanticTokens } from "./semanticTokens";

describe("computeSemanticTokens", () => {
  describe("element types", () => {
    it("highlights element type values after 'type:' key", () => {
      const src = `elements:
  - type: prompt
    file: q1.prompt.md
  - type: submitButton`;
      const tokens = computeSemanticTokens(src);
      const typeTokens = tokens.filter((t) => t.tokenType === "type");
      expect(typeTokens).toHaveLength(2);
      expect(typeTokens[0]).toMatchObject({ line: 1, text: "prompt" });
      expect(typeTokens[1]).toMatchObject({ line: 3, text: "submitButton" });
    });

    it("does not highlight non-element-type values after 'type:' key", () => {
      const src = `metadata:
  type: openResponse`;
      const tokens = computeSemanticTokens(src);
      const typeTokens = tokens.filter((t) => t.tokenType === "type");
      expect(typeTokens).toHaveLength(0);
    });
  });

  describe("comparators", () => {
    it("highlights comparator values after 'comparator:' key", () => {
      const src = `conditions:
  - comparator: equals
    value: "yes"
  - comparator: isAbove
    value: 5`;
      const tokens = computeSemanticTokens(src);
      const compTokens = tokens.filter((t) => t.tokenType === "keyword");
      expect(compTokens).toHaveLength(2);
      expect(compTokens[0]).toMatchObject({ text: "equals" });
      expect(compTokens[1]).toMatchObject({ text: "isAbove" });
    });
  });

  describe("reference strings", () => {
    it("highlights reference values after 'reference:' key", () => {
      const src = `conditions:
  - reference: prompt.q1
    comparator: exists`;
      const tokens = computeSemanticTokens(src);
      const refTokens = tokens.filter((t) => t.tokenType === "variable");
      expect(refTokens).toHaveLength(1);
      expect(refTokens[0]).toMatchObject({ text: "prompt.q1" });
    });
  });

  describe("file paths", () => {
    it("highlights file values after 'file:' key", () => {
      const src = `elements:
  - type: prompt
    file: prompts/q1.prompt.md`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      expect(fileTokens).toHaveLength(1);
      expect(fileTokens[0]).toMatchObject({
        text: "prompts/q1.prompt.md",
      });
    });

    it("highlights file paths containing template variables", () => {
      const src = `file: projects/${"\${topic}"}/q1.prompt.md`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      expect(fileTokens).toHaveLength(1);
    });
  });

  describe("section keys", () => {
    it("highlights structural section keys", () => {
      const src = `templates:
  - templateName: myStage
    templateContent:
      name: stage1
treatments:
  - name: study1
    gameStages:
      - name: s1
        elements:
          - type: submitButton`;
      const tokens = computeSemanticTokens(src);
      const sectionTokens = tokens.filter((t) => t.tokenType === "property");
      const keys = sectionTokens.map((t) => t.text);
      expect(keys).toContain("templates");
      expect(keys).toContain("templateName");
      expect(keys).toContain("templateContent");
      expect(keys).toContain("treatments");
      expect(keys).toContain("gameStages");
      expect(keys).toContain("elements");
    });

    it("does not highlight regular keys like 'name' or 'duration'", () => {
      const src = `name: study1
duration: 300`;
      const tokens = computeSemanticTokens(src);
      const sectionTokens = tokens.filter((t) => t.tokenType === "property");
      expect(sectionTokens).toHaveLength(0);
    });
  });

  describe("conditions key as section key", () => {
    it("highlights 'conditions' as a section key", () => {
      const src = `conditions:
  - comparator: equals
    reference: prompt.q1
    value: "yes"`;
      const tokens = computeSemanticTokens(src);
      const sectionTokens = tokens.filter((t) => t.tokenType === "property");
      const keys = sectionTokens.map((t) => t.text);
      expect(keys).toContain("conditions");
    });

    it("does not highlight comparator or reference as special keys", () => {
      const src = `conditions:
  - comparator: equals
    reference: prompt.q1`;
      const tokens = computeSemanticTokens(src);
      const sectionKeys = tokens
        .filter((t) => t.tokenType === "property")
        .map((t) => t.text);
      expect(sectionKeys).not.toContain("comparator");
      expect(sectionKeys).not.toContain("reference");
    });
  });

  describe("mixed content", () => {
    it("handles a realistic treatment snippet", () => {
      const src = `treatments:
  - name: study1
    playerCount: 3
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: prompt
            file: prompts/q1.prompt.md
            conditions:
              - reference: prompt.consent
                comparator: equals
                value: "yes"
          - type: submitButton`;
      const tokens = computeSemanticTokens(src);
      expect(tokens.length).toBeGreaterThan(0);

      const types = new Set(tokens.map((t) => t.tokenType));
      expect(types).toContain("property");
      expect(types).toContain("type");
      expect(types).toContain("string");
      expect(types).toContain("variable");
      expect(types).toContain("keyword");
    });
  });
});
