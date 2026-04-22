import { describe, expect, test } from "vitest";
import { treatmentFileSchema } from "./treatment.js";
import { validateTreatmentFileReferences } from "./validateReferences.js";

// Helpers — build minimal-valid treatment files with targeted modifications.
// We use the full treatmentFileSchema in some tests to confirm that issues
// surface through the schema's superRefine (i.e. they'd cause red squiggles
// in the VS Code extension), and call the walker directly in others to
// avoid noise from other schema rules.

interface StageConfig {
  name: string;
  duration?: number;
  conditions?: Record<string, unknown>[];
  elements: Record<string, unknown>[];
}

function baseFile(opts: {
  introSteps?: StageConfig[];
  gameStages?: StageConfig[];
  exitSequence?: StageConfig[];
  groupComposition?: Record<string, unknown>[];
}): Record<string, unknown> {
  return {
    introSequences: [
      {
        name: "seq",
        introSteps: opts.introSteps ?? [
          { name: "welcome", elements: [{ type: "submitButton" }] },
        ],
      },
    ],
    treatments: [
      {
        name: "t",
        playerCount: 2,
        gameStages: opts.gameStages ?? [
          {
            name: "s1",
            duration: 60,
            elements: [{ type: "submitButton" }],
          },
        ],
        ...(opts.exitSequence ? { exitSequence: opts.exitSequence } : {}),
        ...(opts.groupComposition
          ? { groupComposition: opts.groupComposition }
          : {}),
      },
    ],
  };
}

function pickForwardRefIssue(
  issues: { path: (string | number)[]; message: string }[],
  pathSuffix: string,
) {
  return issues.find(
    (i) => i.path.join(".").endsWith(pathSuffix) && /later/i.test(i.message),
  );
}

function pickAlwaysSkipIssue(
  issues: { path: (string | number)[]; message: string }[],
  pathSuffix: string,
) {
  return issues.find(
    (i) =>
      i.path.join(".").endsWith(pathSuffix) &&
      /always skip the stage at load/i.test(i.message),
  );
}

describe("Rule 1 — no forward references", () => {
  test("stage-level condition referencing a future stage → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          conditions: [
            {
              reference: "prompt.laterAnswer",
              comparator: "equals",
              value: "yes",
              position: "all",
            },
          ],
          elements: [{ type: "submitButton" }],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "laterAnswer",
              file: "p.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickForwardRefIssue(
        issues,
        "treatments.0.gameStages.0.conditions.0.reference",
      ),
    ).toBeDefined();
  });

  test("element-level condition referencing a future stage → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            {
              type: "submitButton",
              conditions: [
                {
                  reference: "prompt.laterAnswer",
                  comparator: "equals",
                  value: "yes",
                },
              ],
            },
          ],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "laterAnswer",
              file: "p.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickForwardRefIssue(
        issues,
        "treatments.0.gameStages.0.elements.0.conditions.0.reference",
      ),
    ).toBeDefined();
  });

  test("display element.reference pointing at a later stage → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            { type: "display", reference: "prompt.laterAnswer" },
            { type: "submitButton" },
          ],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "laterAnswer",
              file: "p.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickForwardRefIssue(
        issues,
        "treatments.0.gameStages.0.elements.0.reference",
      ),
    ).toBeDefined();
  });

  test("trackedLink urlParams[i].reference pointing at a later stage → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            {
              type: "trackedLink",
              name: "signup",
              url: "https://example.org",
              displayText: "Go",
              urlParams: [{ key: "answer", reference: "prompt.laterAnswer" }],
            },
          ],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "laterAnswer",
              file: "p.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickForwardRefIssue(
        issues,
        "treatments.0.gameStages.0.elements.0.urlParams.0.reference",
      ),
    ).toBeDefined();
  });

  test("qualtrics urlParams[i].reference pointing at a later stage → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            {
              type: "qualtrics",
              url: "https://upenn.qualtrics.com/jfe/form/SV_x",
              urlParams: [{ key: "x", reference: "prompt.laterAnswer" }],
            },
          ],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "laterAnswer",
              file: "p.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickForwardRefIssue(
        issues,
        "treatments.0.gameStages.0.elements.0.urlParams.0.reference",
      ),
    ).toBeDefined();
  });

  test("discussion.conditions[i].reference pointing at a later stage → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          discussion: {
            chatType: "text",
            showNickname: true,
            showTitle: false,
            conditions: [
              {
                reference: "prompt.laterAnswer",
                comparator: "equals",
                value: "yes",
                position: "all",
              },
            ],
          },
          elements: [{ type: "submitButton" }],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "laterAnswer",
              file: "p.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    } as never);
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickForwardRefIssue(
        issues,
        "treatments.0.gameStages.0.discussion.conditions.0.reference",
      ),
    ).toBeDefined();
  });

  test("groupComposition condition referencing game-stage data → rejected (stricter)", () => {
    const file = baseFile({
      groupComposition: [
        {
          position: 0,
          title: "Confederate",
          conditions: [
            {
              reference: "prompt.gameStageAnswer",
              comparator: "equals",
              value: "yes",
            },
          ],
        },
        {
          position: 1,
          title: "Participant",
          conditions: [
            {
              reference: "prompt.gameStageAnswer",
              comparator: "doesNotEqual",
              value: "yes",
            },
          ],
        },
      ],
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "gameStageAnswer",
              file: "q.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    const hits = issues.filter((i) => /groupComposition/i.test(i.message));
    expect(hits.length).toBe(2);
  });

  test("groupComposition condition referencing intro data → accepted", () => {
    const file = baseFile({
      introSteps: [
        {
          name: "survey_step",
          elements: [
            {
              type: "prompt",
              name: "partyAffiliation",
              file: "pa.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
      groupComposition: [
        {
          position: 0,
          title: "D",
          conditions: [
            {
              reference: "prompt.partyAffiliation",
              comparator: "equals",
              value: "democrat",
            },
          ],
        },
        {
          position: 1,
          title: "R",
          conditions: [
            {
              reference: "prompt.partyAffiliation",
              comparator: "equals",
              value: "republican",
            },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });

  test("intro-step condition referencing game-stage data → rejected (cross-phase forward)", () => {
    // Intro always runs before game, so a reference FROM intro TO game is
    // always falsy at runtime. Caught via the laterPhaseKeys set.
    const file = baseFile({
      introSteps: [
        {
          name: "welcome",
          conditions: [
            {
              reference: "prompt.gameAnswer",
              comparator: "equals",
              value: "yes",
            },
          ],
          elements: [{ type: "submitButton" }],
        },
      ],
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            { type: "prompt", name: "gameAnswer", file: "g.prompt.md" },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    const hit = issues.find(
      (i) =>
        i.path.join(".") ===
          "introSequences.0.introSteps.0.conditions.0.reference" &&
        /later phase/i.test(i.message),
    );
    expect(hit).toBeDefined();
  });

  test("intro-step display.reference targeting game-stage data → rejected", () => {
    const file = baseFile({
      introSteps: [
        {
          name: "welcome",
          elements: [
            { type: "display", reference: "prompt.gameAnswer" },
            { type: "submitButton" },
          ],
        },
      ],
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            { type: "prompt", name: "gameAnswer", file: "g.prompt.md" },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    const hit = issues.find(
      (i) =>
        i.path.join(".") ===
          "introSequences.0.introSteps.0.elements.0.reference" &&
        /later phase/i.test(i.message),
    );
    expect(hit).toBeDefined();
  });

  test("survey produces a storage key from surveyName when name is absent", () => {
    // Element.tsx derives the storage key as
    // `survey_${element.name ?? element.surveyName}`. The walker has to
    // match, otherwise forward references to `survey.<surveyName>` slip
    // through when authors omit the optional `name`.
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            {
              type: "display",
              reference: "survey.MySurvey.result.answer",
            },
            { type: "submitButton" },
          ],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            // no `name:` — storage key derives from surveyName
            { type: "survey", surveyName: "MySurvey" },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    const hit = issues.find(
      (i) =>
        i.path.join(".") === "treatments.0.gameStages.0.elements.0.reference" &&
        /later/i.test(i.message),
    );
    expect(hit).toBeDefined();
  });

  test("external references (urlParams.x, participantInfo.x) accepted at every site", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          conditions: [
            {
              reference: "urlParams.cohort",
              comparator: "equals",
              value: "a",
              position: "all",
            },
          ],
          elements: [
            {
              type: "display",
              reference: "participantInfo.playerId",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });

  test("earlier-stage reference accepted", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            { type: "prompt", name: "early", file: "e.prompt.md" },
            { type: "submitButton" },
          ],
        },
        {
          name: "s2",
          duration: 60,
          conditions: [
            {
              reference: "prompt.early",
              comparator: "equals",
              value: "yes",
              position: "all",
            },
          ],
          elements: [{ type: "submitButton" }],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });

  test("exit-stage reference to game-stage data accepted", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          elements: [
            { type: "prompt", name: "main", file: "m.prompt.md" },
            { type: "submitButton" },
          ],
        },
      ],
      exitSequence: [
        {
          name: "debrief",
          conditions: [
            {
              reference: "prompt.main",
              comparator: "equals",
              value: "yes",
              position: "all",
            },
          ],
          elements: [{ type: "submitButton" }],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });
});

describe("Rule 2 — stage-level always-skip-at-load (current-stage refs only)", () => {
  test("stage-level condition `doesNotExist` on current-stage ref → accepted", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "speed_round",
          duration: 60,
          conditions: [
            {
              reference: "submitButton.speedSubmit",
              comparator: "doesNotExist",
              position: "all",
            },
          ],
          elements: [{ type: "submitButton", name: "speedSubmit" }],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });

  test("stage-level condition `exists` on current-stage ref → rejected (always skip)", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "gated",
          duration: 60,
          conditions: [
            {
              reference: "submitButton.s",
              comparator: "exists",
              position: "all",
            },
          ],
          elements: [{ type: "submitButton", name: "s" }],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickAlwaysSkipIssue(
        issues,
        "treatments.0.gameStages.0.conditions.0.reference",
      ),
    ).toBeDefined();
  });

  test("stage-level condition `equals` on current-stage ref → rejected", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "gated",
          duration: 60,
          conditions: [
            {
              reference: "prompt.currentAnswer",
              comparator: "equals",
              value: "yes",
              position: "all",
            },
          ],
          elements: [
            {
              type: "prompt",
              name: "currentAnswer",
              file: "c.prompt.md",
            },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(
      pickAlwaysSkipIssue(
        issues,
        "treatments.0.gameStages.0.conditions.0.reference",
      ),
    ).toBeDefined();
  });

  test("element-level condition `equals` on current-stage ref → accepted (gating pattern)", () => {
    // Submit button appears only after the prompt is answered — the
    // exact pattern the always-skip rule must NOT reject at element level.
    const file = baseFile({
      gameStages: [
        {
          name: "s",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "currentAnswer",
              file: "c.prompt.md",
            },
            {
              type: "submitButton",
              conditions: [
                {
                  reference: "prompt.currentAnswer",
                  comparator: "equals",
                  value: "yes",
                },
              ],
            },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });

  test("display.reference to current-stage data → accepted (shows when data arrives)", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "currentAnswer",
              file: "c.prompt.md",
            },
            { type: "display", reference: "prompt.currentAnswer" },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });

  test("urlParams with current-stage reference → accepted", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s",
          duration: 60,
          elements: [
            {
              type: "prompt",
              name: "currentAnswer",
              file: "c.prompt.md",
            },
            {
              type: "trackedLink",
              name: "link",
              url: "https://example.org",
              displayText: "Go",
              urlParams: [{ key: "a", reference: "prompt.currentAnswer" }],
            },
          ],
        },
      ],
    });
    const issues = validateTreatmentFileReferences(file);
    expect(issues.length).toBe(0);
  });
});

describe("treatmentFileSchema surfaces walker issues via superRefine (red-squiggle path)", () => {
  test("forward reference produces a zod issue whose path targets the reference", () => {
    const file = baseFile({
      gameStages: [
        {
          name: "s1",
          duration: 60,
          conditions: [
            {
              reference: "prompt.later",
              comparator: "equals",
              value: "yes",
              position: "all",
            },
          ],
          elements: [{ type: "submitButton" }],
        },
        {
          name: "s2",
          duration: 60,
          elements: [
            { type: "prompt", name: "later", file: "p.prompt.md" },
            { type: "submitButton" },
          ],
        },
      ],
    });
    const result = treatmentFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      const hit = result.error.issues.find(
        (i) =>
          i.path.join(".") ===
            "treatments.0.gameStages.0.conditions.0.reference" &&
          /later/i.test(i.message),
      );
      expect(hit).toBeDefined();
    }
  });
});
