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
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
        ],
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toContain("prompt.q1");
  });

  it("extracts display element references", () => {
    const elements = [
      {
        type: "display" as const,
        name: "showVote",
        reference: "prompt.vote",
        position: "0",
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toContain("prompt.vote");
  });

  it("extracts multiple references and deduplicates", () => {
    const elements = [
      {
        type: "prompt" as const,
        name: "q2",
        file: "prompts/q2.prompt.md",
        conditions: [
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
          { reference: "prompt.q1", comparator: "equals", value: "no" },
          {
            reference: "survey.TIPI.result.score",
            comparator: "isAbove",
            value: 3,
          },
        ],
      },
      {
        type: "display" as const,
        name: "d1",
        reference: "prompt.q1",
      },
    ];
    const refs = extractStageReferences(elements);
    expect(refs).toEqual(["prompt.q1", "survey.TIPI.result.score"]);
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
