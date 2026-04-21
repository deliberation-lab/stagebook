import { describe, it, expect } from "vitest";
import { flattenSteps } from "./steps";

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

  it("carries notes through on intro steps, game stages, and exit steps", () => {
    const introWithNotes = {
      ...introSequence,
      introSteps: [
        { ...introSequence.introSteps[0], notes: "Intro step rationale" },
        introSequence.introSteps[1],
      ],
    };
    const treatmentWithNotes = {
      ...treatment,
      gameStages: [
        { ...treatment.gameStages[0], notes: "Stage rationale" },
        treatment.gameStages[1],
      ],
      exitSequence: [
        { ...treatment.exitSequence[0], notes: "Debrief rationale" },
      ],
    };
    const steps = flattenSteps(introWithNotes, treatmentWithNotes);
    expect(steps.find((s) => s.name === "consent")?.notes).toBe(
      "Intro step rationale",
    );
    expect(steps.find((s) => s.name === "round1")?.notes).toBe(
      "Stage rationale",
    );
    expect(steps.find((s) => s.name === "debrief")?.notes).toBe(
      "Debrief rationale",
    );
    // Unannotated steps have no notes.
    expect(steps.find((s) => s.name === "round2")?.notes).toBeUndefined();
  });

  it("carries discussion through on game stages", () => {
    const discussion = {
      chatType: "video" as const,
      showNickname: true,
      showTitle: true,
      showSelfView: true,
      showReportMissing: true,
      showAudioMute: true,
      showVideoMute: true,
    };
    const withDiscussion = {
      ...treatment,
      gameStages: [
        { ...treatment.gameStages[0], discussion },
        treatment.gameStages[1],
      ],
    };
    const steps = flattenSteps(introSequence, withDiscussion);
    const round1 = steps.find((s) => s.name === "round1")!;
    const round2 = steps.find((s) => s.name === "round2")!;
    expect(round1.discussion).toEqual(discussion);
    expect(round2.discussion).toBeUndefined();
  });
});
