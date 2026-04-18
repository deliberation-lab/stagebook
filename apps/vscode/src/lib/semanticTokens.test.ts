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

    it("splits file paths around template variables", () => {
      const src = `file: projects/${"\${topic}"}/q1.prompt.md`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      const varTokens = tokens.filter((t) => t.tokenType === "variable");
      // "projects/" and "/q1.prompt.md" as string, "${topic}" as variable
      expect(fileTokens).toHaveLength(2);
      expect(fileTokens[0]).toMatchObject({ text: "projects/" });
      expect(fileTokens[1]).toMatchObject({ text: "/q1.prompt.md" });
      expect(varTokens).toHaveLength(1);
      expect(varTokens[0]).toMatchObject({ text: "${topic}" });
    });

    it("highlights simple file paths as a single string token", () => {
      const src = `file: prompts/q1.prompt.md`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      expect(fileTokens).toHaveLength(1);
      expect(fileTokens[0]).toMatchObject({ text: "prompts/q1.prompt.md" });
    });
  });

  describe("template variables in values", () => {
    it("highlights ${...} placeholders in non-file values", () => {
      const src = `name: \${topicName}_presurvey`;
      const tokens = computeSemanticTokens(src);
      const varTokens = tokens.filter((t) => t.tokenType === "variable");
      expect(varTokens).toHaveLength(1);
      expect(varTokens[0]).toMatchObject({ text: "${topicName}" });
    });

    it("highlights multiple placeholders in one value", () => {
      const src = `name: \${topic}_\${condition}_stage`;
      const tokens = computeSemanticTokens(src);
      const varTokens = tokens.filter((t) => t.tokenType === "variable");
      expect(varTokens).toHaveLength(2);
      expect(varTokens[0]).toMatchObject({ text: "${topic}" });
      expect(varTokens[1]).toMatchObject({ text: "${condition}" });
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

  describe("contentType values", () => {
    it("highlights valid contentType values", () => {
      const src = `contentType: elements`;
      const tokens = computeSemanticTokens(src);
      expect(tokens).toContainEqual(
        expect.objectContaining({ text: "elements", tokenType: "type" }),
      );
    });

    it("does not highlight invalid contentType values", () => {
      const src = `contentType: banana`;
      const tokens = computeSemanticTokens(src);
      const typeTokens = tokens.filter((t) => t.tokenType === "type");
      expect(typeTokens).toHaveLength(0);
    });
  });

  describe("separator styles", () => {
    it("highlights separator style values", () => {
      const src = `style: thin`;
      const tokens = computeSemanticTokens(src);
      expect(tokens).toContainEqual(
        expect.objectContaining({ text: "thin", tokenType: "keyword" }),
      );
    });
  });

  describe("enum values", () => {
    it("highlights position enum values", () => {
      const src = `position: shared`;
      const tokens = computeSemanticTokens(src);
      expect(tokens).toContainEqual(
        expect.objectContaining({ text: "shared", tokenType: "keyword" }),
      );
    });

    it("highlights chatType enum values", () => {
      const src = `chatType: video`;
      const tokens = computeSemanticTokens(src);
      expect(tokens).toContainEqual(
        expect.objectContaining({ text: "video", tokenType: "keyword" }),
      );
    });
  });

  describe("negative cases", () => {
    it("does not highlight invalid comparator values", () => {
      const src = `comparator: banana`;
      const tokens = computeSemanticTokens(src);
      expect(tokens.filter((t) => t.tokenType === "keyword")).toHaveLength(0);
    });

    it("does not highlight references with invalid type prefix", () => {
      const src = `reference: invalidType.field`;
      const tokens = computeSemanticTokens(src);
      expect(tokens.filter((t) => t.tokenType === "variable")).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("returns empty tokens for empty input", () => {
      expect(computeSemanticTokens("")).toEqual([]);
    });

    it("returns empty tokens for comment-only YAML", () => {
      expect(computeSemanticTokens("# just a comment")).toEqual([]);
    });
  });

  describe("quoted YAML scalars", () => {
    it("aligns token for double-quoted element type", () => {
      const src = `type: "prompt"`;
      const tokens = computeSemanticTokens(src);
      const typeTokens = tokens.filter((t) => t.tokenType === "type");
      expect(typeTokens).toHaveLength(1);
      expect(typeTokens[0]).toMatchObject({
        line: 0,
        startCol: 7,
        length: 6,
        text: "prompt",
      });
    });

    it("aligns token for single-quoted element type", () => {
      const src = `type: 'prompt'`;
      const tokens = computeSemanticTokens(src);
      const typeTokens = tokens.filter((t) => t.tokenType === "type");
      expect(typeTokens).toHaveLength(1);
      expect(typeTokens[0]).toMatchObject({
        line: 0,
        startCol: 7,
        length: 6,
        text: "prompt",
      });
    });

    it("aligns token for double-quoted file path", () => {
      const src = `file: "prompts/q1.prompt.md"`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      expect(fileTokens).toHaveLength(1);
      expect(fileTokens[0]).toMatchObject({
        line: 0,
        startCol: 7,
        length: 20,
        text: "prompts/q1.prompt.md",
      });
    });

    it("aligns token for single-quoted file path", () => {
      const src = `file: 'prompts/q1.prompt.md'`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      expect(fileTokens).toHaveLength(1);
      expect(fileTokens[0]).toMatchObject({
        line: 0,
        startCol: 7,
        length: 20,
        text: "prompts/q1.prompt.md",
      });
    });

    it("aligns token for double-quoted reference", () => {
      const src = `reference: "prompt.q1"`;
      const tokens = computeSemanticTokens(src);
      const refTokens = tokens.filter((t) => t.tokenType === "variable");
      expect(refTokens).toHaveLength(1);
      expect(refTokens[0]).toMatchObject({
        line: 0,
        startCol: 12,
        length: 9,
        text: "prompt.q1",
      });
    });

    it("aligns token for double-quoted comparator", () => {
      const src = `comparator: "equals"`;
      const tokens = computeSemanticTokens(src);
      const compTokens = tokens.filter((t) => t.tokenType === "keyword");
      expect(compTokens).toHaveLength(1);
      expect(compTokens[0]).toMatchObject({
        line: 0,
        startCol: 13,
        length: 6,
        text: "equals",
      });
    });

    it("aligns template-var tokens inside a double-quoted file path", () => {
      const src = `file: "projects/\${topic}/q1.prompt.md"`;
      const tokens = computeSemanticTokens(src);
      const fileTokens = tokens.filter((t) => t.tokenType === "string");
      const varTokens = tokens.filter((t) => t.tokenType === "variable");
      expect(fileTokens).toHaveLength(2);
      expect(fileTokens[0]).toMatchObject({
        startCol: 7,
        text: "projects/",
      });
      expect(varTokens).toHaveLength(1);
      expect(varTokens[0]).toMatchObject({
        startCol: 16,
        length: 8,
        text: "${topic}",
      });
      expect(fileTokens[1]).toMatchObject({ text: "/q1.prompt.md" });
    });

    it("aligns template-var tokens inside a double-quoted non-file value", () => {
      const src = `name: "\${topic}_suffix"`;
      const tokens = computeSemanticTokens(src);
      const varTokens = tokens.filter((t) => t.tokenType === "variable");
      expect(varTokens).toHaveLength(1);
      expect(varTokens[0]).toMatchObject({
        line: 0,
        startCol: 7,
        length: 8,
        text: "${topic}",
      });
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
