import { describe, expect, test } from "vitest";

import { treatmentFileSchema } from "./treatment.js";
import { resolvedTreatmentSchema } from "./resolved.js";

/**
 * `notes` is researcher-facing metadata. It's valid in authoring schemas so
 * researchers can document rationale, citations, and design decisions inline
 * in their treatment YAML, but it MUST be stripped from the output when
 * parsed through the resolved schemas — that's the security boundary that
 * keeps notes from reaching participants. See #158 / #136.
 */
describe("resolved schemas strip researcher `notes`", () => {
  const authoringYaml = {
    treatments: [
      {
        name: "t_with_notes",
        notes: "Top-level treatment rationale.",
        playerCount: 2,
        gameStages: [
          {
            name: "s_with_notes",
            notes: "Adapted from Smith et al. (2020).",
            duration: 60,
            elements: [
              {
                type: "prompt",
                name: "p_with_notes",
                notes: "Pilot showed N=32 was adequate.",
                file: "prompts/q.prompt.md",
              },
              { type: "submitButton" },
            ],
          },
        ],
        exitSequence: [
          {
            name: "e_with_notes",
            notes: "Debrief copy pending IRB approval.",
            elements: [
              { type: "prompt", file: "prompts/debrief.prompt.md" },
              { type: "submitButton" },
            ],
          },
        ],
      },
    ],
  };

  test("authoring schema accepts `notes` on treatments, stages, elements, and intro/exit steps", () => {
    const result = treatmentFileSchema.safeParse(authoringYaml);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  test("resolvedTreatmentSchema strips every `notes` in the output tree", () => {
    const resolvedInput = authoringYaml.treatments[0];
    const result = resolvedTreatmentSchema.safeParse(resolvedInput);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);

    // Walk the whole parsed object and confirm no `notes` key survived.
    function findNotesKey(value: unknown, path = "$"): string | null {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const found = findNotesKey(value[i], `${path}[${String(i)}]`);
          if (found) return found;
        }
        return null;
      }
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (k === "notes") return `${path}.notes`;
          const found = findNotesKey(v, `${path}.${k}`);
          if (found) return found;
        }
      }
      return null;
    }

    expect(findNotesKey(result.data)).toBe(null);
  });

  test("`desc` is no longer accepted as a key in authoring schemas (#158)", () => {
    const withDesc = {
      treatments: [
        {
          name: "t_old",
          desc: "legacy description field",
          playerCount: 2,
          gameStages: [
            {
              name: "s",
              duration: 60,
              elements: [
                { type: "prompt", file: "p.prompt.md" },
                { type: "submitButton" },
              ],
            },
          ],
        },
      ],
    };
    const result = treatmentFileSchema.safeParse(withDesc);
    expect(result.success).toBe(false);
  });
});
