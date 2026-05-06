import { describe, it, expect } from "vitest";
import { collectStorageKeyCollisions } from "./storageKeyCollisions.js";

describe("collectStorageKeyCollisions", () => {
  it("returns no collisions for an empty/invalid input", () => {
    expect(collectStorageKeyCollisions(undefined)).toEqual([]);
    expect(collectStorageKeyCollisions(null)).toEqual([]);
    expect(collectStorageKeyCollisions("not an object")).toEqual([]);
    expect(collectStorageKeyCollisions({})).toEqual([]);
  });

  it("returns no collisions when all storage keys are unique", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "q1", file: "a.prompt.md" },
                { type: "prompt", name: "q2", file: "b.prompt.md" },
              ],
            },
          ],
        },
      ],
    };
    expect(collectStorageKeyCollisions(data)).toEqual([]);
  });

  it("flags duplicates within a single stage", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "q1", file: "a.prompt.md" },
                { type: "prompt", name: "q1", file: "b.prompt.md" },
              ],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("prompt_q1");
    expect(collisions[0].paths).toHaveLength(2);
  });

  it("flags duplicates ACROSS game stages within a treatment", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "preTest",
              elements: [{ type: "prompt", name: "q1", file: "a.prompt.md" }],
            },
            {
              name: "postTest",
              elements: [{ type: "prompt", name: "q1", file: "a.prompt.md" }],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("prompt_q1");
    expect(collisions[0].paths).toHaveLength(2);
    // Paths span different stages
    expect(collisions[0].paths[0][3]).toBe(0); // gameStages[0]
    expect(collisions[0].paths[1][3]).toBe(1); // gameStages[1]
  });

  it("flags duplicates between intro and game phases", () => {
    const data = {
      introSequences: [
        {
          name: "intro1",
          introSteps: [
            {
              name: "welcome",
              elements: [
                { type: "prompt", name: "shared", file: "a.prompt.md" },
              ],
            },
          ],
        },
      ],
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "shared", file: "a.prompt.md" },
              ],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("prompt_shared");
  });

  it("flags duplicates between game and exit phases", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "shared", file: "a.prompt.md" },
              ],
            },
          ],
          exitSequence: [
            {
              name: "exit1",
              elements: [
                { type: "prompt", name: "shared", file: "a.prompt.md" },
              ],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("prompt_shared");
  });

  it("flags duplicates across intro sequences", () => {
    const data = {
      introSequences: [
        {
          name: "intro1",
          introSteps: [
            {
              name: "s1",
              elements: [{ type: "prompt", name: "q1", file: "a.prompt.md" }],
            },
          ],
        },
        {
          name: "intro2",
          introSteps: [
            {
              name: "s1",
              elements: [{ type: "prompt", name: "q1", file: "a.prompt.md" }],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("prompt_q1");
  });

  it("does not flag identical names on different element types as duplicates", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "X", file: "a.prompt.md" },
                { type: "audio", name: "X", file: "a.mp3" },
              ],
            },
          ],
        },
      ],
    };
    expect(collectStorageKeyCollisions(data)).toEqual([]);
  });

  it("derives keys for audio (name OR file fallback)", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "audio", file: "intro.mp3" },
                { type: "audio", file: "intro.mp3" },
              ],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("audio_intro.mp3");
  });

  it("derives keys for survey (name OR surveyName fallback)", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "survey", surveyName: "TIPI" },
                { type: "survey", surveyName: "TIPI" },
              ],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].key).toBe("survey_TIPI");
  });

  it("skips elements without a derivable storage key (unnamed prompts/submitButtons)", () => {
    // Unnamed prompts derive their key from progressLabel + metadata at runtime,
    // which isn't statically derivable, so we don't check them.
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", file: "a.prompt.md" },
                { type: "prompt", file: "b.prompt.md" },
                { type: "submitButton" },
                { type: "submitButton" },
              ],
            },
          ],
        },
      ],
    };
    expect(collectStorageKeyCollisions(data)).toEqual([]);
  });

  it("groups three-or-more duplicates into one entry with all paths", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "q1", file: "a.prompt.md" },
                { type: "prompt", name: "q1", file: "b.prompt.md" },
              ],
            },
            {
              name: "stage2",
              elements: [{ type: "prompt", name: "q1", file: "c.prompt.md" }],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].paths).toHaveLength(3);
  });

  it("emits messages that mention the duplicated key", () => {
    const data = {
      treatments: [
        {
          name: "t1",
          gameStages: [
            {
              name: "stage1",
              elements: [
                { type: "prompt", name: "q1", file: "a.prompt.md" },
                { type: "prompt", name: "q1", file: "b.prompt.md" },
              ],
            },
          ],
        },
      ],
    };
    const collisions = collectStorageKeyCollisions(data);
    expect(collisions[0].message).toContain('"prompt_q1"');
  });
});
