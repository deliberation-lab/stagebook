import { describe, it, expect } from "vitest";
import { extractStageReferences } from "./references";

describe("extractStageReferences", () => {
  it("extracts condition references from elements", () => {
    const elements = [
      {
        type: "prompt" as const,
        name: "q2",
        file: "prompts/q2.prompt.md",
        conditions: [
          { reference: "self.prompt.q1", comparator: "equals", value: "yes" },
        ],
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toContain("self.prompt.q1");
  });

  it("extracts display element references", () => {
    const elements = [
      {
        type: "display" as const,
        name: "showVote",
        reference: "0.prompt.vote",
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toContain("0.prompt.vote");
  });

  it("extracts multiple references and deduplicates", () => {
    const elements = [
      {
        type: "prompt" as const,
        name: "q2",
        file: "prompts/q2.prompt.md",
        conditions: [
          { reference: "self.prompt.q1", comparator: "equals", value: "yes" },
          { reference: "self.prompt.q1", comparator: "equals", value: "no" },
          {
            reference: "self.survey.TIPI.result.score",
            comparator: "isAbove",
            value: 3,
          },
        ],
      },
      {
        type: "display" as const,
        name: "d1",
        reference: "self.prompt.q1",
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toEqual(["self.prompt.q1", "self.survey.TIPI.result.score"]);
  });

  it("returns empty array for elements with no references", () => {
    const elements = [
      { type: "submitButton" as const, buttonText: "Next" },
      {
        type: "prompt" as const,
        name: "q1",
        file: "prompts/q1.prompt.md",
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toEqual([]);
  });
});
