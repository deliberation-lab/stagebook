import { describe, it, expect } from "vitest";
import { expandTreatmentSource } from "./expandTreatment";

describe("expandTreatmentSource", () => {
  describe("no templates", () => {
    it("returns the YAML unchanged when there are no templates", () => {
      const src = `treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: submitButton`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("name: study1");
      expect(result.yaml).toContain("type: submitButton");
      expect(result.truncated).toBe(false);
    });
  });

  describe("simple template expansion", () => {
    it("expands a template context into concrete content", () => {
      const src = `templates:
  - templateName: myStage
    templateContent:
      name: stage1
      duration: 300
      elements:
        - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: myStage`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("name: stage1");
      expect(result.yaml).toContain("duration: 300");
      expect(result.yaml).toContain("type: submitButton");
      // Templates key should be removed from output
      expect(result.yaml).not.toMatch(/^templates:/m);
    });
  });

  describe("field substitution", () => {
    it("substitutes field values into template content", () => {
      const src = `templates:
  - templateName: topicStage
    templateContent:
      name: \${topic}_stage
      duration: 300
      elements:
        - type: prompt
          file: prompts/\${topic}.prompt.md
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: topicStage
        fields:
          topic: climate`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("name: climate_stage");
      expect(result.yaml).toContain("file: prompts/climate.prompt.md");
    });
  });

  describe("broadcast expansion", () => {
    it("expands broadcast dimensions into multiple items", () => {
      const src = `templates:
  - templateName: topicStage
    templateContent:
      name: \${topic}_stage
      duration: 300
      elements:
        - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: topicStage
        broadcast:
          d0:
            - topic: climate
            - topic: guns
            - topic: immigration`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("climate_stage");
      expect(result.yaml).toContain("guns_stage");
      expect(result.yaml).toContain("immigration_stage");
    });
  });

  describe("error handling", () => {
    it("returns an error for invalid YAML", () => {
      const src = `[[[invalid`;
      const result = expandTreatmentSource(src);
      expect(result.error).not.toBeNull();
      expect(result.yaml).toBe("");
    });

    it("returns an error for non-object YAML", () => {
      const src = `just a string`;
      const result = expandTreatmentSource(src);
      expect(result.error).not.toBeNull();
    });

    it("returns an error when templates key is not an array", () => {
      const src = `templates: notAnArray
treatments:
  - name: study1`;
      const result = expandTreatmentSource(src);
      expect(result.error).toContain("must be an array");
      expect(result.yaml).toBe("");
    });
  });

  describe("output size limit", () => {
    it("truncates output that exceeds the line limit", () => {
      // Generate a treatment with a large broadcast
      const topics = Array.from({ length: 200 }, (_, i) => `topic${i}`);
      const broadcastItems = topics
        .map((t) => `            - topic: ${t}`)
        .join("\n");
      const src = `templates:
  - templateName: bigStage
    templateContent:
      name: \${topic}_stage
      duration: 300
      elements:
        - type: prompt
          file: prompts/\${topic}.prompt.md
        - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: bigStage
        broadcast:
          d0:
${broadcastItems}`;
      const result = expandTreatmentSource(src, { maxLines: 100 });
      expect(result.truncated).toBe(true);
      const lines = result.yaml.split("\n");
      // Should be at or under the limit (plus truncation notice)
      expect(lines.length).toBeLessThanOrEqual(105);
      expect(result.yaml).toContain("# --- Output truncated at 100 lines");
    });
  });

  describe("nested templates", () => {
    it("expands templates that reference other templates", () => {
      const src = `templates:
  - templateName: innerElem
    templateContent:
      type: submitButton
  - templateName: outerStage
    templateContent:
      name: stage1
      duration: 300
      elements:
        - template: innerElem
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: outerStage`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("type: submitButton");
      expect(result.yaml).toContain("name: stage1");
    });
  });

  describe("nonexistent template reference", () => {
    it("returns an error when a template reference does not exist", () => {
      const src = `templates:
  - templateName: myStage
    templateContent:
      name: stage1
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: nonexistentStage`;
      const result = expandTreatmentSource(src);
      expect(result.error).toContain("not found");
      expect(result.yaml).toBe("");
    });
  });

  describe("unresolved placeholders", () => {
    it("preserves unresolved placeholders in the output", () => {
      const src = `templates:
  - templateName: myStage
    templateContent:
      name: \${missing}_stage
      duration: 300
      elements:
        - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: myStage`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("${missing}_stage");
    });
  });

  describe("multi-dimension broadcast", () => {
    it("expands broadcast with multiple dimensions into cartesian product", () => {
      const src = `templates:
  - templateName: topicStage
    templateContent:
      name: \${topic}_\${condition}_stage
      duration: 300
      elements:
        - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: topicStage
        broadcast:
          d0:
            - topic: climate
            - topic: guns
          d1:
            - condition: control
            - condition: treatment`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).toContain("climate_control_stage");
      expect(result.yaml).toContain("climate_treatment_stage");
      expect(result.yaml).toContain("guns_control_stage");
      expect(result.yaml).toContain("guns_treatment_stage");
    });
  });

  describe("broadcast size guard", () => {
    it("rejects broadcasts that would produce too many items", () => {
      const topics = Array.from({ length: 200 }, (_, i) => `topic${i}`);
      const broadcastItems = topics
        .map((t) => `            - topic: ${t}`)
        .join("\n");
      const src = `templates:
  - templateName: bigStage
    templateContent:
      name: \${topic}_stage
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: bigStage
        broadcast:
          d0:
${broadcastItems}`;
      const result = expandTreatmentSource(src, { maxBroadcastProduct: 100 });
      expect(result.error).toContain("Broadcast expansion would produce");
      expect(result.yaml).toBe("");
    });
  });

  describe("templates key removal", () => {
    it("removes the templates key from expanded output", () => {
      const src = `templates:
  - templateName: myStage
    templateContent:
      name: stage1
      duration: 300
      elements:
        - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: myStage`;
      const result = expandTreatmentSource(src);
      expect(result.error).toBeNull();
      expect(result.yaml).not.toMatch(/templateName:/);
      expect(result.yaml).not.toMatch(/templateContent:/);
    });
  });
});
