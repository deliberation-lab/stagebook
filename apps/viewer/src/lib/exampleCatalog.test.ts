import { describe, it, expect } from "vitest";
import {
  buildCatalog,
  createExampleContentFns,
  exampleCatalog,
  prepareExampleTreatment,
} from "./exampleCatalog";
import { parseTreatmentYaml } from "./treatment";

const SAMPLE_YAML = `
introSequences:
  - name: intro
    introSteps:
      - name: step1
        elements:
          - type: submitButton

treatments:
  - name: Sample treatment title
    notes: |
      A **Markdown** note describing the treatment.
    playerCount: 1
    gameStages:
      - name: only
        duration: 10
        elements:
          - type: prompt
            file: prompts/x.prompt.md
`;

describe("buildCatalog", () => {
  it("returns one entry per treatment YAML, sorted by id", () => {
    const catalog = buildCatalog(
      {
        "/root/examples/b-example/foo.treatments.yaml": SAMPLE_YAML,
        "/root/examples/a-example/foo.treatments.yaml": SAMPLE_YAML,
      },
      {},
    );
    expect(catalog.map((e) => e.id)).toEqual(["a-example", "b-example"]);
  });

  it("uses the first treatment's name as the title and notes as description", () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {},
    );
    expect(entry.title).toBe("Sample treatment title");
    expect(entry.notes).toContain("**Markdown**");
  });

  it("collects prompts under the example directory, keyed by relative path", () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {
        "/root/examples/demo/prompts/x.prompt.md":
          "---\ntype: noResponse\n---\nbody\n---\n",
        "/root/examples/other/prompts/y.prompt.md": "ignored",
      },
    );
    expect(Object.keys(entry.prompts)).toEqual(["prompts/x.prompt.md"]);
    expect(entry.prompts["prompts/x.prompt.md"]).toContain("noResponse");
  });

  it("picks up the example's sibling README.md into the `readme` field", () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {
        "/root/examples/demo/README.md": "# Demo study\n\nOverview text.",
        "/root/examples/other/README.md": "ignored",
      },
    );
    expect(entry.readme).toContain("Demo study");
    expect(entry.readme).toContain("Overview text.");
  });

  it("does NOT mix README.md into the `prompts` field", () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {
        "/root/examples/demo/README.md": "# Demo",
        "/root/examples/demo/prompts/x.prompt.md":
          "---\ntype: noResponse\n---\nbody\n---\n",
      },
    );
    expect(Object.keys(entry.prompts)).toEqual(["prompts/x.prompt.md"]);
    expect(entry.prompts["README.md"]).toBeUndefined();
  });

  it("leaves `readme` undefined when no README.md is bundled", () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {},
    );
    expect(entry.readme).toBeUndefined();
  });

  it("falls back to the id when the treatment has no notes", () => {
    const yaml = SAMPLE_YAML.replace(
      "    notes: |\n      A **Markdown** note describing the treatment.\n",
      "",
    );
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": yaml },
      {},
    );
    expect(entry.notes).toBeUndefined();
  });
});

describe("createExampleContentFns", () => {
  it("resolves getTextContent from bundled prompts", async () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {
        "/root/examples/demo/prompts/x.prompt.md": "hello",
      },
    );
    const fns = createExampleContentFns(entry);
    await expect(fns.getTextContent("prompts/x.prompt.md")).resolves.toBe(
      "hello",
    );
  });

  it("rejects getTextContent for paths not in the example", async () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {},
    );
    const fns = createExampleContentFns(entry);
    await expect(fns.getTextContent("prompts/missing.md")).rejects.toThrow(
      /No bundled content/,
    );
  });

  it("serves README.md via getTextContent when bundled", async () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      { "/root/examples/demo/README.md": "# Demo" },
    );
    const fns = createExampleContentFns(entry);
    await expect(fns.getTextContent("README.md")).resolves.toBe("# Demo");
  });

  it("rejects getTextContent for README.md when not bundled", async () => {
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {},
    );
    const fns = createExampleContentFns(entry);
    await expect(fns.getTextContent("README.md")).rejects.toThrow(
      /No bundled content/,
    );
  });
});

describe("exampleCatalog (discovered via import.meta.glob)", () => {
  it("includes the annotated-walkthrough example", () => {
    const walkthrough = exampleCatalog.find(
      (e) => e.id === "annotated-walkthrough",
    );
    expect(walkthrough).toBeDefined();
    expect(walkthrough?.title).toContain("Annotated walkthrough");
    expect(walkthrough?.notes).toBeTruthy();
    // Every referenced prompt is bundled.
    expect(walkthrough?.prompts["prompts/consent.prompt.md"]).toContain(
      "noResponse",
    );
  });
});

describe("prepareExampleTreatment", () => {
  it("expands template broadcasts so the picker sees multiple treatments (issue #229)", () => {
    // Regression for #229: App.handleLoadExample previously only parsed
    // the YAML, leaving template-broadcast rows un-expanded. The
    // OverviewPage's `treatments.length > 1` check then fell through to
    // the single-button "Ready to view" state instead of showing the
    // multi-radio picker the README promises.
    const walkthrough = exampleCatalog.find(
      (e) => e.id === "annotated-walkthrough",
    );
    if (!walkthrough) throw new Error("annotated-walkthrough missing");

    // Pre-condition: the unexpanded YAML has a single `template:` row
    // with a broadcast axis — exactly the shape that triggered the bug.
    const parsed = parseTreatmentYaml(walkthrough.yaml);
    expect(parsed.treatments.length).toBe(1);

    // After: prepareExampleTreatment fans the broadcast out so the
    // picker has multiple radios to render.
    const prepared = prepareExampleTreatment(walkthrough);
    expect(prepared.treatments.length).toBeGreaterThan(1);
  });

  it("works for examples without templates (no-op expansion)", () => {
    // Sanity: examples that don't use templates are still parsed
    // correctly and produce the same single-treatment result.
    const [entry] = buildCatalog(
      { "/root/examples/demo/foo.treatments.yaml": SAMPLE_YAML },
      {},
    );
    const prepared = prepareExampleTreatment(entry);
    expect(prepared.treatments).toHaveLength(1);
    expect(prepared.treatments[0]?.name).toBe("Sample treatment title");
  });
});
