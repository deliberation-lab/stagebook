import { describe, it, expect } from "vitest";
import { parseTreatmentYaml } from "./treatment";
import { computePreviewState } from "./previewResolution";

// `file:` is fully templated so a host-supplied binding can violate
// the post-fill `.prompt.md` contract (#474) — the scenario where the
// FieldForm submit produces resolved-schema issues.
const TEMPLATED_FILE_YAML = `
templates:
  - name: questionStage
    contentType: stage
    content:
      name: question
      duration: 60
      elements:
        - type: prompt
          name: q1
          file: "\${promptFile}"

treatments:
  - name: treatment1
    playerCount: 1
    gameStages:
      - template: questionStage
        fields:
          promptFile: "\${userPromptFile}"
`;

const NO_TEMPLATE_YAML = `
treatments:
  - name: treatment1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            name: q1
            file: prompts/q1.prompt.md
`;

describe("computePreviewState", () => {
  it("requests form input while fields are unresolved", () => {
    const parsed = parseTreatmentYaml(TEMPLATED_FILE_YAML);
    const state = computePreviewState(parsed, undefined);
    expect(state.mode).toBe("form");
    if (state.mode !== "form") return;
    expect(state.formFields).toEqual(["userPromptFile"]);
    expect(state.errors).toEqual([]);
  });

  it("returns ready when bindings resolve cleanly", () => {
    const parsed = parseTreatmentYaml(TEMPLATED_FILE_YAML);
    const state = computePreviewState(parsed, {
      userPromptFile: "prompts/q1.prompt.md",
    });
    expect(state.mode).toBe("ready");
    if (state.mode !== "ready") return;
    expect(
      state.resolved.treatments?.[0].gameStages[0].elements[0],
    ).toMatchObject({ file: "prompts/q1.prompt.md" });
  });

  it("re-shows the form with errors when a binding fails post-fill validation", () => {
    const parsed = parseTreatmentYaml(TEMPLATED_FILE_YAML);
    const state = computePreviewState(parsed, {
      userPromptFile: "prompts/q1.md",
    });
    expect(state.mode).toBe("form");
    if (state.mode !== "form") return;
    expect(state.formFields).toEqual(["userPromptFile"]);
    // Previously-submitted values come back so the user can edit
    // rather than retype.
    expect(state.initialValues).toEqual({ userPromptFile: "prompts/q1.md" });
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0].message).toMatch(/\.prompt\.md/);
    expect(state.errors[0].path).toContain("file");
  });

  it("keeps showing errors on resubmit with unchanged bad values", () => {
    const parsed = parseTreatmentYaml(TEMPLATED_FILE_YAML);
    const first = computePreviewState(parsed, {
      userPromptFile: "prompts/q1.md",
    });
    const second = computePreviewState(parsed, {
      userPromptFile: "prompts/q1.md",
    });
    expect(second).toEqual(first);
    expect(second.mode).toBe("form");
  });

  it("drops non-string bindings from initialValues", () => {
    const parsed = parseTreatmentYaml(TEMPLATED_FILE_YAML);
    const state = computePreviewState(parsed, {
      userPromptFile: "prompts/q1.md",
      hostContext: { not: "a string" },
    });
    expect(state.mode).toBe("form");
    if (state.mode !== "form") return;
    expect(state.initialValues).toEqual({ userPromptFile: "prompts/q1.md" });
  });

  it("returns a standalone error when the file has no fillable fields", () => {
    const parsed = parseTreatmentYaml(NO_TEMPLATE_YAML);
    // Force a post-fill violation with no template fields involved:
    // mutate the parsed tree the way a hand-authored bad file would
    // arrive. (Pre-fill schema is relaxed for this path only when a
    // placeholder is present, so craft the object directly.)
    parsed.treatments![0].gameStages[0].elements[0] = {
      ...parsed.treatments![0].gameStages[0].elements[0],
      file: "prompts/q1.md",
    };
    const state = computePreviewState(parsed, undefined);
    expect(state.mode).toBe("error");
    if (state.mode !== "error") return;
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0].message).toMatch(/\.prompt\.md/);
  });

  it("returns ready for a clean file with no template fields", () => {
    const parsed = parseTreatmentYaml(NO_TEMPLATE_YAML);
    const state = computePreviewState(parsed, undefined);
    expect(state.mode).toBe("ready");
  });
});
