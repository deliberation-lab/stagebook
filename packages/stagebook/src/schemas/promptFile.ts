import { z, ZodIssue } from "zod";
import { load as loadYaml } from "js-yaml";

// ---------------------------------------------------------------------------
// Prompt file format (#243)
// ---------------------------------------------------------------------------
//
// A prompt file is a `*.prompt.md` markdown document with two or three
// sections separated by `---` lines:
//
//   ---
//   <YAML frontmatter — `type:` discriminates the response shape>
//   ---
//   <markdown body — the participant-facing question>
//   ---                       <-- third section omitted for `noResponse`
//   <response items — `-` lines for list types, `>` lines for openResponse>
//
// Per-type frontmatter is `.strict()` — unknown keys (`tytle:`,
// `placholder:`, `interavl:`, …) fail at preflight. Per-type marker
// enforcement in the body section catches `>` lines on a multipleChoice
// or `-` lines on an openResponse.
//
// `***` and `___` are the body's horizontal-rule alternatives (since
// `---` is the section delimiter).

// --- Per-type metadata schemas ---

const baseMetadataFields = {
  // `name` is kept (Principle 9 — name is the universal identifier
  // across all study portions, addressable or not). Optional.
  name: z.string().optional(),
  notes: z.string().optional(),
};

const noResponseMetadataSchema = z
  .object({
    type: z.literal("noResponse"),
    ...baseMetadataFields,
  })
  .strict();

const openResponseMetadataSchema = z
  .object({
    type: z.literal("openResponse"),
    ...baseMetadataFields,
    rows: z.number().int().min(1).optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
  })
  .strict();

const multipleChoiceMetadataSchema = z
  .object({
    type: z.literal("multipleChoice"),
    ...baseMetadataFields,
    select: z.enum(["single", "multiple"]).optional().default("single"),
    layout: z.enum(["vertical", "horizontal"]).optional().default("vertical"),
    shuffle: z.boolean().optional(),
  })
  .strict();

const listSorterMetadataSchema = z
  .object({
    type: z.literal("listSorter"),
    ...baseMetadataFields,
    shuffle: z.boolean().optional(),
  })
  .strict();

const sliderMetadataSchema = z
  .object({
    type: z.literal("slider"),
    ...baseMetadataFields,
    min: z.number(),
    max: z.number(),
    interval: z.number().positive(),
  })
  .strict();

/**
 * One per response type, each `.strict()` per #243. The discriminated
 * union's input `type:` selects exactly one branch — cross-field rules
 * (e.g. "rows can only appear on openResponse") fall out of the per-branch
 * field lists for free.
 *
 * Cross-field numeric rules (min<max, min+interval<=max, minLength<=maxLength)
 * live in the union's outer `.superRefine` rather than per-branch
 * `.refine()`. Reason: Zod 3's `discriminatedUnion` rejects `ZodEffects`
 * members, so any `.refine` applied to a branch breaks the union.
 */
export const promptMetadataSchema = z
  .discriminatedUnion("type", [
    noResponseMetadataSchema,
    openResponseMetadataSchema,
    multipleChoiceMetadataSchema,
    listSorterMetadataSchema,
    sliderMetadataSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.type === "openResponse") {
      if (
        data.minLength !== undefined &&
        data.maxLength !== undefined &&
        data.minLength > data.maxLength
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "minLength cannot be greater than maxLength",
          path: ["minLength"],
        });
      }
    }
    if (data.type === "slider") {
      if (data.min >= data.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "min must be less than max",
          path: ["min"],
        });
      }
      if (data.min + data.interval > data.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "min + interval must be ≤ max",
          path: ["interval"],
        });
      }
    }
  });
export type MetadataType = z.infer<typeof promptMetadataSchema>;

// Back-compat aliases — the old `metadataTypeSchema` / `metadataRefineSchema`
// pair was the workaround for `z.object().superRefine()` skipping its
// refinement when object validation failed (pre-discriminatedUnion). Both
// roles are now served by `promptMetadataSchema` itself.
export const metadataTypeSchema = promptMetadataSchema;
export const metadataRefineSchema = promptMetadataSchema;
export const metadataLogicalSchema = promptMetadataSchema;
export type MetadataRefineType = MetadataType;

/**
 * Slider labels live in the body section as inline lines (#243). One of:
 *   - `- 50` — bare number (label defaults to the number's string form)
 *   - `- 50: Somewhat familiar` — number + label
 *   - `- 50:` — number + empty label (label defaults to the number)
 * The first colon separates point from label, so labels can themselves
 * contain colons.
 */
function parseSliderLine(
  raw: string,
): { ok: true; point: number; label: string } | { ok: false; message: string } {
  // Caller has already stripped the `- ` prefix and `\n`.
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      message:
        "Slider label line is empty (expected `- <number>(: <label>)?`).",
    };
  }
  const colonIdx = trimmed.indexOf(":");
  let pointStr: string;
  let label: string | null;
  if (colonIdx < 0) {
    pointStr = trimmed;
    label = null;
  } else {
    pointStr = trimmed.slice(0, colonIdx).trim();
    const afterColon = trimmed.slice(colonIdx + 1).trim();
    label = afterColon.length > 0 ? afterColon : null;
  }
  if (pointStr.length === 0) {
    return {
      ok: false,
      message: `Slider label "${trimmed}" must start with a number, e.g. "- 0: Not familiar".`,
    };
  }
  const point = Number(pointStr);
  if (!Number.isFinite(point)) {
    return {
      ok: false,
      message: `Slider label "${trimmed}" must start with a number, e.g. "- 0: Not familiar". Got "${pointStr}".`,
    };
  }
  return { ok: true, point, label: label ?? pointStr };
}

/**
 * Back-compat shim. The old runtime had a separate `validateSliderLabels`
 * that cross-checked `metadata.labelPts.length === responseItems.length`.
 * After #243 slider labels and points come from the same body lines, so
 * the cross-check is structurally impossible to fail and the helper is a
 * no-op. Kept exported because external tooling may still import it.
 */
export const validateSliderLabels = (
  _metadata: MetadataType,
  _responseItems: string[],
): ZodIssue[] => [];

// --- File-level parser ---

export interface ParsedPromptFile {
  metadata: MetadataType;
  body: string;
  /**
   * Response section items, one entry per non-empty body-section line.
   * Shape depends on `metadata.type`:
   *   - multipleChoice / listSorter — choice/item strings
   *   - openResponse — placeholder lines
   *   - slider — labels (one per parsed line; aligned with `sliderPoints`)
   *   - noResponse — empty array
   */
  responseItems: string[];
  /**
   * Slider points (numbers) parsed from the body section. Empty for
   * non-slider types. `sliderPoints[i]` corresponds to `responseItems[i]`.
   */
  sliderPoints: number[];
}

export const promptFileSchema: z.ZodType<
  ParsedPromptFile,
  z.ZodTypeDef,
  string
> = z
  .string()
  .min(1, "Prompt file string is empty")
  .transform((str, ctx): ParsedPromptFile | typeof z.NEVER => {
    const trimmed = str.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Prompt file string is empty",
      });
      return z.NEVER;
    }

    const sections = trimmed.split(/^-{3,}$/gm);

    // First section is the empty string before the leading `---`.
    if (sections.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Prompt file must have a `---`-delimited frontmatter and body. Use `***` or `___` for horizontal rules in the body, since `---` delimits sections.",
      });
      return z.NEVER;
    }

    const metadataYaml = sections[1];
    const body = sections[2];
    // For `noResponse` files this stays undefined; everyone else expects
    // exactly one response section. We validate the section count below
    // once we know the type.
    const responseString = sections[3];

    let metadata: unknown;
    try {
      metadata = loadYaml(metadataYaml);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Failed to parse metadata YAML",
        path: ["metadata"],
      });
      return z.NEVER;
    }

    const metaResult = promptMetadataSchema.safeParse(metadata);
    if (!metaResult.success) {
      metaResult.error.issues.forEach((issue) =>
        ctx.addIssue({
          ...issue,
          path: ["metadata", ...issue.path],
        }),
      );
      return z.NEVER;
    }
    const parsedMetadata = metaResult.data;

    if (!body || body.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Prompt body section is empty",
        path: ["body"],
      });
    }

    // Section-count rules per #243:
    //   noResponse — exactly two sections (frontmatter + body).
    //   everyone else — exactly three (frontmatter + body + responses).
    if (parsedMetadata.type === "noResponse") {
      if (sections.length > 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["responses"],
          message:
            "noResponse prompt must have exactly two sections (frontmatter + body). Drop the trailing `---` and any third section.",
        });
      }
      return {
        metadata: parsedMetadata,
        body: body?.trim() ?? "",
        responseItems: [],
        sliderPoints: [],
      };
    }

    if (sections.length < 4 || responseString === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responses"],
        message: `${parsedMetadata.type} prompt must have a third section listing the responses.`,
      });
      return z.NEVER;
    }

    const responseLines = responseString
      .split(/\r?\n/g)
      .filter((line) => line.trim().length > 0);

    // Per-type marker enforcement (#243). Both forms require a trailing
    // space (or the bare marker on its own line) — `>X` / `-X` no-space
    // forms are rejected so the substring(2) extraction always lands on
    // the actual content.
    const expectedMarker = parsedMetadata.type === "openResponse" ? ">" : "-";
    for (const line of responseLines) {
      const isDash = line.startsWith("- ") || line === "-";
      const isAngle = line.startsWith("> ") || line === ">";
      if (expectedMarker === ">" && !isAngle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["responses"],
          message: `openResponse placeholder lines must start with "> ". Got: "${line}"`,
        });
      }
      if (expectedMarker === "-" && !isDash) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["responses"],
          message: `${parsedMetadata.type} response lines must start with "- ". Got: "${line}"`,
        });
      }
    }

    let responseItems: string[] = [];
    let sliderPoints: number[] = [];
    if (parsedMetadata.type === "slider") {
      const points: number[] = [];
      const labels: string[] = [];
      for (const line of responseLines) {
        if (!(line.startsWith("- ") || line === "-")) continue;
        const stripped = line === "-" ? "" : line.substring(2);
        const parsed = parseSliderLine(stripped);
        if (!parsed.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["responses"],
            message: parsed.message,
          });
          continue;
        }
        points.push(parsed.point);
        labels.push(parsed.label);
      }
      sliderPoints = points;
      responseItems = labels;
    } else {
      responseItems = responseLines
        .filter(
          (line) =>
            line.startsWith("- ") ||
            line === "-" ||
            line.startsWith("> ") ||
            line === ">",
        )
        .map((line) =>
          line === "-" || line === ">" ? "" : line.substring(2).trim(),
        );
    }

    return {
      metadata: parsedMetadata,
      body: body?.trim() ?? "",
      responseItems,
      sliderPoints,
    };
  });

export type PromptFileType = z.infer<typeof promptFileSchema>;
