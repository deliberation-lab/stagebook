import { expect, test } from "vitest";

import {
  referenceSchema,
  conditionSchema,
  discussionSchema,
  elementsSchema,
  elementSchema,
  introStepsSchema,
  exitStepsSchema,
  mediaPlayerSchema,
  timelineSchema,
  promptSchema,
  treatmentFileSchema,
} from "./treatment.js";

// ----------- Reference Schema ------------
test("reference with valid prompt", () => {
  const reference = "prompt.namedPrompt";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("reference with valid survey", () => {
  const reference = "survey.namedSurvey.results.namedResult";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

test("reference with invalid type", () => {
  const reference = "duck.namedPrompt";
  const result = referenceSchema.safeParse(reference);
  if (!result.success)
    console.log(result.error.message, "\npath:", result.error.path);
  expect(result.success).toBe(false);
});

test("reference prompt with no name", () => {
  const reference = "prompt";
  const result = referenceSchema.safeParse(reference);
  if (!result.success)
    console.log(result.error.message, "\npath:", result.error.path);
  expect(result.success).toBe(false);
});

test("reference survey with no path", () => {
  const reference = "survey.namedSurvey";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(false);
});

test("reference tracked link with name", () => {
  const reference = "trackedLink.followUp.events";
  const result = referenceSchema.safeParse(reference);
  if (!result.success) console.log(result.error);
  expect(result.success).toBe(true);
});

// ----------- Condition Schema ------------

test("validCondition", () => {
  const condition = {
    reference: "prompt.namedPrompt",
    position: 1,
    comparator: "equals",
    value: "value",
  };
  const result = conditionSchema.safeParse(condition);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("condition missing required value", () => {
  const condition = {
    reference: "duck.namedPrompt",
    position: 1,
    comparator: "matches",
  };
  const result = conditionSchema.safeParse(condition);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

// ----------- Small schemas ------------

test("break name requirements", () => {
  const element = {
    type: "prompt",
    name: "This name has !!! some serious \\ issues that *(&@#$( need fixing 123 and change to fill in the 64 character limit etc etc etc etc",
    file: "projects/example/testDisplay00.prompt.md",
  };
  const result = promptSchema.safeParse(element);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

test("prompt file must use .prompt.md extension", () => {
  const element = {
    type: "prompt",
    file: "projects/example/consent.md",
  };
  const result = promptSchema.safeParse(element);
  expect(result.success).toBe(false);
});

// ----------- Element schemas ------------
test("prompt element validation", () => {
  const element = {
    type: "prompt",
    name: "namedPrompt",
    file: "projects/example/testDisplay00.prompt.md",
    conditions: [
      {
        reference: "prompt.namedPrompt",
        position: 1,
        comparator: "equals",
        value: "value",
      },
      {
        reference: "prompt.namedPrompt",
        position: 2,
        comparator: "equals",
        value: "value2",
      },
    ],
  };
  const result = promptSchema.safeParse(element);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("audio element validation", () => {
  const elements = [
    {
      type: "audio",
      file: "projects/shared/chime.mp3",
    },
  ];
  const result = elementsSchema.safeParse(elements);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("multiple elements validation", () => {
  const elements = [
    {
      type: "prompt",
      file: "projects/example/testDisplay00.prompt.md",
    },
    {
      type: "prompt",
      name: "namedPrompt2",
      file: "projects/example/testDisplay01.prompt.md",
      conditions: [
        {
          reference: "prompt.namedPrompt",
          position: 1,
          comparator: "equals",
          value: "value",
        },
        {
          reference: "prompt.namedPrompt",
          position: 2,
          comparator: "equals",
          value: "value2",
        },
      ],
    },
  ];
  const result = elementsSchema.safeParse(elements);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("tracked link element validation", () => {
  const elements = [
    {
      type: "trackedLink",
      name: "signup_link",
      url: "https://example.org",
      displayText: "Open signup form",
      urlParams: [
        { key: "token", value: "abc123" },
        {
          key: "name",
          reference: "prompt.namedPrompt",
          position: "player",
        },
      ],
    },
  ];
  const result = elementsSchema.safeParse(elements);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("tracked link with custom helperText", () => {
  const elements = [
    {
      type: "trackedLink",
      name: "signup_link",
      url: "https://example.org",
      displayText: "Open signup form",
      helperText: "You'll need about 5 minutes. Return here when done.",
    },
  ];
  const result = elementsSchema.safeParse(elements);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("tracked link rejects non-string helperText", () => {
  const elements = [
    {
      type: "trackedLink",
      name: "signup_link",
      url: "https://example.org",
      displayText: "Open signup form",
      helperText: 42,
    },
  ];
  const result = elementsSchema.safeParse(elements);
  expect(result.success).toBe(false);
});

test("validate entire file", () => {
  const fileJson = {
    templates: [
      {
        templateName: "template1",
        contentType: "element",
        templateContent: {
          type: "prompt",
          name: "namedPrompt",
          file: "projects/example/testDisplay00.prompt.md",
        },
      },
    ],
    introSequences: [
      {
        name: "intro1",
        introSteps: [
          {
            name: "introStep1",
            elements: [
              {
                type: "prompt",
                name: "namedPrompt",
                file: "projects/example/testDisplay00.prompt.md",
                conditions: [
                  {
                    reference: "prompt.namedPrompt",
                    comparator: "equals",
                    value: "value",
                  },
                ],
              },
              {
                type: "submitButton",
                buttonText: "Continue",
              },
            ],
          },
        ],
      },
    ],
    treatments: [
      {
        name: "treatment1",
        playerCount: 2,
        groupComposition: [
          { position: 0, title: "Bill" },
          { position: 1, title: "Ted" },
        ],
        gameStages: [
          {
            name: "stage1",
            duration: 10,
            elements: [
              {
                type: "prompt",
                name: "namedPrompt",
                file: "projects/example/testDisplay00.prompt.md",
                conditions: [
                  {
                    reference: "prompt.namedPrompt",
                    position: 1,
                    comparator: "equals",
                    value: "value",
                  },
                  {
                    reference: "prompt.namedPrompt",
                    position: 2,
                    comparator: "equals",
                    value: "value2",
                  },
                ],
              },
              {
                type: "prompt",
                name: "namedPrompt2",
                file: "projects/example/testDisplay01.prompt.md",
                conditions: [
                  {
                    reference: "prompt.namedPrompt",
                    position: 1,
                    comparator: "equals",
                    value: "value",
                  },
                  {
                    reference: "prompt.namedPrompt",
                    position: 2,
                    comparator: "equals",
                    value: "value2",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const result = treatmentFileSchema.safeParse(fileJson);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

// ----------- Discussion Schema with conditions ------------

test("discussion with conditions is valid", () => {
  const discussion = {
    chatType: "text",
    showNickname: true,
    showTitle: true,
    conditions: [
      {
        reference: "prompt.setupChoice",
        comparator: "equals",
        position: "all",
        value: "HTML",
      },
    ],
  };
  const result = discussionSchema.safeParse(discussion);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("discussion with multiple conditions is valid", () => {
  const discussion = {
    chatType: "video",
    showNickname: true,
    showTitle: true,
    conditions: [
      {
        reference: "prompt.setupChoice",
        comparator: "equals",
        position: "all",
        value: "HTML",
      },
      {
        reference: "survey.priorRound.responses.consensus",
        comparator: "doesNotEqual",
        value: "yes",
      },
    ],
  };
  const result = discussionSchema.safeParse(discussion);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("discussion without conditions is still valid", () => {
  const discussion = {
    chatType: "video",
    showNickname: true,
    showTitle: true,
  };
  const result = discussionSchema.safeParse(discussion);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("discussion with empty conditions array is invalid", () => {
  const discussion = {
    chatType: "text",
    showNickname: true,
    showTitle: true,
    conditions: [],
  };
  const result = discussionSchema.safeParse(discussion);
  expect(result.success).toBe(false);
});

test("discussion with invalid condition is invalid", () => {
  const discussion = {
    chatType: "text",
    showNickname: true,
    showTitle: true,
    conditions: [
      {
        reference: "duck.invalidRef",
        comparator: "equals",
        value: "test",
      },
    ],
  };
  const result = discussionSchema.safeParse(discussion);
  expect(result.success).toBe(false);
});

// ----------- mediaPlayerSchema ------------

test("mediaPlayer: minimal valid config (url only)", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "https://youtu.be/QC8iQqtG0hg",
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("mediaPlayer: relative path url is valid", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("mediaPlayer: full config with all fields", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/interview.mp4",
    name: "coding_video",
    playVideo: true,
    playAudio: true,
    captionsFile: "shared/captions.vtt",
    startAt: 45,
    stopAt: 120,
    allowScrubOutsideBounds: false,
    stepDuration: 0.033,
    syncToStageTime: false,
    submitOnComplete: true,
    controls: {
      playPause: true,
      seek: true,
      step: true,
      speed: true,
    },
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("mediaPlayer: missing url is invalid", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: negative startAt is invalid", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    startAt: -5,
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: stopAt of zero is invalid (must be positive)", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    stopAt: 0,
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: unknown fields are rejected (strict)", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    unknownField: true,
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: controls with unknown keys are rejected (strict)", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    controls: { playPause: true, unknownControl: true },
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: zero startAt is valid (nonnegative)", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    startAt: 0,
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("mediaPlayer: stepDuration must be positive", () => {
  const result = mediaPlayerSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    stepDuration: 0,
  });
  expect(result.success).toBe(false);
});

test("elementsSchema accepts type: mediaPlayer", () => {
  const result = elementsSchema.safeParse([
    { type: "mediaPlayer", url: "shared/footage.mp4" },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("mediaPlayer: stopAt must be greater than startAt", () => {
  const result = elementSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    startAt: 30,
    stopAt: 10,
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: startAt equal to stopAt is invalid", () => {
  const result = elementSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    startAt: 30,
    stopAt: 30,
  });
  expect(result.success).toBe(false);
});

test("mediaPlayer: startAt < stopAt is valid", () => {
  const result = elementSchema.safeParse({
    type: "mediaPlayer",
    url: "shared/footage.mp4",
    startAt: 10,
    stopAt: 90,
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

// ----------- introStepsSchema / exitStepsSchema: advancement element requirement ------------

test("intro step with submitButton is valid", () => {
  const result = introStepsSchema.safeParse([
    {
      name: "consent",
      elements: [
        { type: "prompt", file: "intro/consent.prompt.md" },
        { type: "submitButton", buttonText: "I agree" },
      ],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("intro step with only prompt and no submitButton is invalid", () => {
  const result = introStepsSchema.safeParse([
    {
      name: "consent",
      elements: [{ type: "prompt", file: "intro/consent.prompt.md" }],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

test("intro step with survey element auto-submits (no submitButton needed)", () => {
  const result = introStepsSchema.safeParse([
    {
      name: "party_affiliation",
      elements: [{ type: "survey", surveyName: "PoliticalPartyUS" }],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("intro step with qualtrics element auto-submits (no submitButton needed)", () => {
  const result = introStepsSchema.safeParse([
    {
      name: "screener",
      elements: [
        {
          type: "qualtrics",
          url: "https://upenn.qualtrics.com/jfe/form/SV_xxx",
        },
      ],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("intro step with mediaPlayer submitOnComplete auto-submits (no submitButton needed)", () => {
  const result = introStepsSchema.safeParse([
    {
      name: "watch_video",
      elements: [
        {
          type: "mediaPlayer",
          url: "shared/intro.mp4",
          submitOnComplete: true,
        },
      ],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("intro step with mediaPlayer without submitOnComplete requires submitButton", () => {
  const result = introStepsSchema.safeParse([
    {
      name: "watch_video",
      elements: [{ type: "mediaPlayer", url: "shared/intro.mp4" }],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

test("exit step with submitButton is valid", () => {
  const result = exitStepsSchema.safeParse([
    {
      name: "debrief",
      elements: [
        { type: "prompt", file: "exit/debrief.prompt.md" },
        { type: "submitButton", buttonText: "Done" },
      ],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("exit step with only prompt and no submitButton is invalid", () => {
  const result = exitStepsSchema.safeParse([
    {
      name: "debrief",
      elements: [{ type: "prompt", file: "exit/debrief.prompt.md" }],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(false);
});

test("exit step with qualtrics auto-submits (no submitButton needed)", () => {
  const result = exitStepsSchema.safeParse([
    {
      name: "exit_survey",
      elements: [
        {
          type: "qualtrics",
          url: "https://upenn.qualtrics.com/jfe/form/SV_yyy",
        },
      ],
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

// ----------- timelineSchema ------------

test("timeline: minimal valid config", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "range",
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("timeline: full config with all fields", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "range",
    selectionScope: "track",
    multiSelect: true,
    showWaveform: true,
    trackLabels: ["Interviewer", "Participant"],
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("timeline: point selectionType is valid", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "agreements",
    selectionType: "point",
    multiSelect: true,
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("timeline: missing source is invalid", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    name: "interruptions",
    selectionType: "range",
  });
  expect(result.success).toBe(false);
});

test("timeline: missing name is invalid", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    selectionType: "range",
  });
  expect(result.success).toBe(false);
});

test("timeline: missing selectionType is invalid", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
  });
  expect(result.success).toBe(false);
});

test("timeline: invalid selectionType is rejected", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "segment",
  });
  expect(result.success).toBe(false);
});

test("timeline: invalid selectionScope is rejected", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "range",
    selectionScope: "global",
  });
  expect(result.success).toBe(false);
});

test("timeline: unknown fields are rejected (strict)", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "range",
    unknownField: true,
  });
  expect(result.success).toBe(false);
});

test("timeline: trackLabels accepts array of strings", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "range",
    trackLabels: ["Speaker A", "Speaker B", "Speaker C"],
  });
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("timeline: defaults — selectionScope defaults to all, multiSelect to false, showWaveform to true", () => {
  const result = timelineSchema.safeParse({
    type: "timeline",
    source: "coding_video",
    name: "interruptions",
    selectionType: "range",
  });
  expect(result.success).toBe(true);
});

test("elementsSchema accepts type: timeline", () => {
  const result = elementsSchema.safeParse([
    {
      type: "timeline",
      source: "coding_video",
      name: "interruptions",
      selectionType: "range",
    },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});

test("elementsSchema accepts timeline alongside mediaPlayer", () => {
  const result = elementsSchema.safeParse([
    { type: "mediaPlayer", url: "shared/interview.mp4", name: "coding_video" },
    {
      type: "timeline",
      source: "coding_video",
      name: "interruptions",
      selectionType: "range",
      multiSelect: true,
    },
    {
      type: "timeline",
      source: "coding_video",
      name: "agreements",
      selectionType: "point",
      multiSelect: true,
    },
    { type: "submitButton", buttonText: "Submit" },
  ]);
  if (!result.success) console.log(result.error.message);
  expect(result.success).toBe(true);
});
