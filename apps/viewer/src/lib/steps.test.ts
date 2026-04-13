import { describe, it, expect } from "vitest";
import { flattenSteps, type ViewerStep } from "./steps";

describe("flattenSteps", () => {
  const introSequence = {
    name: "intro1",
    introSteps: [
      {
        name: "consent",
        elements: [{ type: "submitButton" as const, buttonText: "I agree" }],
      },
      {
        name: "demographics",
        elements: [
          {
            type: "prompt" as const,
            name: "age",
            file: "prompts/age.prompt.md",
          },
          { type: "submitButton" as const, buttonText: "Continue" },
        ],
      },
    ],
  };

  const treatment = {
    name: "treatment1",
    playerCount: 2,
    gameStages: [
      {
        name: "round1",
        duration: 60,
        elements: [
          {
            type: "prompt" as const,
            name: "vote",
            file: "prompts/vote.prompt.md",
          },
        ],
      },
      {
        name: "round2",
        duration: 120,
        elements: [
          {
            type: "prompt" as const,
            name: "vote2",
            file: "prompts/vote2.prompt.md",
          },
        ],
      },
    ],
    exitSequence: [
      {
        name: "debrief",
        elements: [
          {
            type: "prompt" as const,
            name: "feedback",
            file: "prompts/feedback.prompt.md",
          },
          { type: "submitButton" as const, buttonText: "Finish" },
        ],
      },
    ],
  };

  it("produces a flat list of steps in order: intro, game, exit", () => {
    const steps = flattenSteps(introSequence, treatment);
    expect(steps.map((s) => s.name)).toEqual([
      "consent",
      "demographics",
      "round1",
      "round2",
      "debrief",
    ]);
  });

  it("tags each step with its phase", () => {
    const steps = flattenSteps(introSequence, treatment);
    expect(steps.map((s) => s.phase)).toEqual([
      "intro",
      "intro",
      "game",
      "game",
      "exit",
    ]);
  });

  it("preserves stage properties like duration", () => {
    const steps = flattenSteps(introSequence, treatment);
    const round1 = steps.find((s) => s.name === "round1")!;
    expect(round1.duration).toBe(60);
  });

  it("works without an exit sequence", () => {
    const noExit = { ...treatment, exitSequence: undefined };
    const steps = flattenSteps(introSequence, noExit);
    expect(steps.map((s) => s.name)).toEqual([
      "consent",
      "demographics",
      "round1",
      "round2",
    ]);
  });

  it("assigns sequential indices", () => {
    const steps = flattenSteps(introSequence, treatment);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
  });
});
