import { describe, it, expect } from "vitest";
import { validateTreatmentSource } from "./validateTreatment";

describe("validateTreatmentSource", () => {
  describe("valid treatment files", () => {
    it("returns no diagnostics for a minimal valid treatment", () => {
      const src = `introSequences:
  - name: intro1
    introSteps:
      - name: welcome
        elements:
          - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: submitButton`;
      const result = validateTreatmentSource(src);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("YAML syntax errors", () => {
    it("reports YAML parse errors with positions", () => {
      const src = `treatments:
  - name: study1
    playerCount: 3
  bad indentation`;
      const result = validateTreatmentSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe("error");
    });

    it("reports duplicate YAML keys", () => {
      const src = `introSequences:
  - name: intro1
    introSteps:
      - name: welcome
        elements:
          - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    playerCount: 2
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: submitButton`;
      const result = validateTreatmentSource(src);
      const dupeWarnings = result.diagnostics.filter((d) =>
        d.message.match(/unique|duplicate/i),
      );
      expect(dupeWarnings.length).toBeGreaterThan(0);
    });
  });

  describe("schema validation errors", () => {
    it("reports missing required fields", () => {
      const src = `treatments:
  - name: study1
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: submitButton`;
      // Missing playerCount and introSequences
      const result = validateTreatmentSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe("error");
    });

    it("maps schema errors to source positions", () => {
      const src = `introSequences:
  - name: intro1
    introSteps:
      - name: welcome
        elements:
          - type: submitButton
treatments:
  - name: study1
    playerCount: not_a_number
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: submitButton`;
      // playerCount must be a number — error should have a source range
      const result = validateTreatmentSource(src);
      const rangedErrors = result.diagnostics.filter(
        (d) => d.severity === "error" && d.range !== null,
      );
      expect(rangedErrors.length).toBeGreaterThan(0);
    });

    it("reports invalid element types", () => {
      const src = `introSequences:
  - name: intro1
    introSteps:
      - name: welcome
        elements:
          - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: notARealType`;
      const result = validateTreatmentSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("template content validation", () => {
    it("validates template content based on contentType", () => {
      const src = `templates:
  - templateName: myStage
    contentType: stage
    templateContent:
      name: stage1
      duration: -1
      elements:
        - type: submitButton
introSequences:
  - name: intro1
    introSteps:
      - name: welcome
        elements:
          - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - template: myStage`;
      const result = validateTreatmentSource(src);
      // duration: -1 is invalid in the template content
      const templateErrors = result.diagnostics.filter(
        (d) => d.severity === "error",
      );
      expect(templateErrors.length).toBeGreaterThan(0);
    });
  });

  describe("returned JSON object", () => {
    it("returns the parsed JS object for downstream use", () => {
      const src = `introSequences:
  - name: intro1
    introSteps:
      - name: welcome
        elements:
          - type: submitButton
treatments:
  - name: study1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 300
        elements:
          - type: submitButton`;
      const result = validateTreatmentSource(src);
      expect(result.parsedObj).toBeDefined();
      expect(
        (result.parsedObj as Record<string, unknown>).treatments,
      ).toBeDefined();
    });

    it("returns diagnostics for completely invalid YAML", () => {
      const src = `[[[`;
      const result = validateTreatmentSource(src);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });
});
