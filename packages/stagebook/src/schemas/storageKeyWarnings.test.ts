import { expect, test } from "vitest";

import { collectStorageKeyWarnings } from "./storageKeyWarnings.js";

// --- within a single game stage ---

test("emits a warning when two prompts in the same stage share a name", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "prompt", file: "a.prompt.md", name: "q1" },
              { type: "prompt", file: "b.prompt.md", name: "q1" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("prompt_q1");
  expect(warnings[0].paths).toEqual([
    ["treatments", 0, "gameStages", 0, "elements", 0],
    ["treatments", 0, "gameStages", 0, "elements", 1],
  ]);
  expect(warnings[0].message).toMatch(/duplicate/i);
});

test("no warning when two elements with the same name have different types", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "survey", name: "foo", surveyName: "TIPI" },
              { type: "submitButton", name: "foo" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  expect(collectStorageKeyWarnings(data)).toEqual([]);
});

test("no warning when duplicate names appear across game stages", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [{ type: "prompt", file: "a.prompt.md", name: "q1" }],
          },
          {
            name: "s2",
            duration: 60,
            elements: [{ type: "prompt", file: "b.prompt.md", name: "q1" }],
          },
        ],
      },
    ],
    introSequences: [],
  };
  expect(collectStorageKeyWarnings(data)).toEqual([]);
});

test("emits a warning when three elements in the same stage share a key", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "prompt", file: "a.prompt.md", name: "q1" },
              { type: "prompt", file: "b.prompt.md", name: "q1" },
              { type: "prompt", file: "c.prompt.md", name: "q1" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].paths).toHaveLength(3);
});

// --- across intro steps ---

test("emits a warning when the same prompt name appears across intro steps", () => {
  const data = {
    treatments: [],
    introSequences: [
      {
        name: "onboarding",
        introSteps: [
          {
            name: "step1",
            elements: [
              { type: "prompt", file: "a.prompt.md", name: "age" },
              { type: "submitButton" },
            ],
          },
          {
            name: "step2",
            elements: [
              { type: "prompt", file: "b.prompt.md", name: "age" },
              { type: "submitButton" },
            ],
          },
        ],
      },
    ],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("prompt_age");
  expect(warnings[0].paths).toEqual([
    ["introSequences", 0, "introSteps", 0, "elements", 0],
    ["introSequences", 0, "introSteps", 1, "elements", 0],
  ]);
});

test("no warning across different intro sequences", () => {
  const data = {
    treatments: [],
    introSequences: [
      {
        name: "seqA",
        introSteps: [
          {
            name: "s1",
            elements: [
              { type: "prompt", file: "a.prompt.md", name: "age" },
              { type: "submitButton" },
            ],
          },
        ],
      },
      {
        name: "seqB",
        introSteps: [
          {
            name: "s1",
            elements: [
              { type: "prompt", file: "b.prompt.md", name: "age" },
              { type: "submitButton" },
            ],
          },
        ],
      },
    ],
  };
  expect(collectStorageKeyWarnings(data)).toEqual([]);
});

// --- across exit steps ---

test("emits a warning when the same name appears across exit steps", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [{ type: "submitButton", name: "done" }],
          },
        ],
        exitSequence: [
          {
            name: "debrief1",
            elements: [
              { type: "prompt", file: "a.prompt.md", name: "reflection" },
              { type: "submitButton" },
            ],
          },
          {
            name: "debrief2",
            elements: [
              { type: "prompt", file: "b.prompt.md", name: "reflection" },
              { type: "submitButton" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("prompt_reflection");
  expect(warnings[0].paths).toEqual([
    ["treatments", 0, "exitSequence", 0, "elements", 0],
    ["treatments", 0, "exitSequence", 1, "elements", 0],
  ]);
});

// --- element types without a name or that don't save ---

test("no warning for elements without a name", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "separator" },
              { type: "separator" },
              { type: "submitButton" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  expect(collectStorageKeyWarnings(data)).toEqual([]);
});

test("no warning for display elements (which don't save)", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "display", reference: "prompt.foo", name: "shared" },
              { type: "display", reference: "prompt.bar", name: "shared" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  expect(collectStorageKeyWarnings(data)).toEqual([]);
});

// --- mixed element types that do save ---

test("emits a warning for duplicate survey names in the same stage", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "survey", name: "big5", surveyName: "TIPI" },
              { type: "survey", name: "big5", surveyName: "BFI" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("survey_big5");
});

// --- fallback-name derivation (when element.name is omitted) ---

test("emits a warning for two unnamed surveys with the same surveyName", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "survey", surveyName: "TIPI" },
              { type: "survey", surveyName: "TIPI" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("survey_TIPI");
});

test("emits a warning for two unnamed mediaPlayers with the same url", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "mediaPlayer", url: "https://example.com/clip.mp4" },
              { type: "mediaPlayer", url: "https://example.com/clip.mp4" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("mediaPlayer_https://example.com/clip.mp4");
});

test("emits a warning for two unnamed audio elements with the same file", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "audio", file: "beep.mp3" },
              { type: "audio", file: "beep.mp3" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  const warnings = collectStorageKeyWarnings(data);
  expect(warnings).toHaveLength(1);
  expect(warnings[0].key).toBe("audio_beep.mp3");
});

test("explicit name wins over fallback (no warning when names differ)", () => {
  const data = {
    treatments: [
      {
        name: "t1",
        playerCount: 1,
        gameStages: [
          {
            name: "s1",
            duration: 60,
            elements: [
              { type: "survey", name: "pre", surveyName: "TIPI" },
              { type: "survey", name: "post", surveyName: "TIPI" },
            ],
          },
        ],
      },
    ],
    introSequences: [],
  };
  expect(collectStorageKeyWarnings(data)).toEqual([]);
});

// --- malformed input ---

test("returns no warnings for malformed input", () => {
  expect(collectStorageKeyWarnings(null)).toEqual([]);
  expect(collectStorageKeyWarnings(undefined)).toEqual([]);
  expect(collectStorageKeyWarnings("bad")).toEqual([]);
  expect(collectStorageKeyWarnings({})).toEqual([]);
  expect(collectStorageKeyWarnings({ treatments: "not-an-array" })).toEqual([]);
});
