import { z, ZodIssue } from "zod";
import { load as loadYaml } from "js-yaml";

// This schema is used to ensure that the metadata conforms to the expected structure and types.
// Cannot be combined with the refine schema, if conditions within z.object fail, superRefine conditions will not be checked.
// We want all of the condtions to be checked simultaneously, so we use a separate refine schema.
export const metadataTypeSchema = z.object({
  name: z.string().optional(),
  type: z.enum([
    "openResponse",
    "multipleChoice",
    "noResponse",
    "listSorter",
    "slider",
  ]),
  notes: z.string().optional(),
  rows: z.number().int().min(1).optional(),
  shuffleOptions: z.boolean().optional(),
  select: z.enum(["single", "multiple", "undefined"]).optional(),
  layout: z.enum(["vertical", "horizontal"]).optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  interval: z.number().optional(),
  labelPts: z.array(z.number()).optional(),
});

// Refined schema that adds additional validation rules based on the type of prompt
// This schema checks that certain fields are only present for specific types of prompts.
// Conditions in z.object will always pass as long as the extension detects the file,
// so we are guarenteed to always check against superRefine conditions.
export const metadataRefineSchema = z
  .object({
    name: z.any(),
    type: z.any(),
    notes: z.any().optional(),
    rows: z.any().optional(),
    shuffleOptions: z.any().optional(),
    select: z.any().optional(),
    layout: z.any().optional(),
    minLength: z.any().optional(),
    maxLength: z.any().optional(),
    min: z.any().optional(),
    max: z.any().optional(),
    interval: z.any().optional(),
    labelPts: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "openResponse" && data.rows !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `rows can only be specified for openResponse type`,
        path: ["rows"],
      });
    }
    if (data.type !== "multipleChoice" && data.select !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `select can only be specified for multipleChoice type`,
        path: ["select"],
      });
    }
    if (data.type !== "multipleChoice" && data.layout !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `layout can only be specified for multipleChoice type`,
        path: ["layout"],
      });
    }
    if (data.type === "noResponse" && data.shuffleOptions !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `shuffleOptions cannot be specified for noResponse type`,
        path: ["shuffleOptions"],
      });
    }
    if (data.type !== "openResponse" && data.minLength !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `minLength can only be specified for openResponse type`,
        path: ["minLength"],
      });
    }
    if (data.type !== "openResponse" && data.maxLength !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `maxLength can only be specified for openResponse type`,
        path: ["maxLength"],
      });
    }
    if (
      data.minLength !== undefined &&
      data.maxLength !== undefined &&
      data.minLength > data.maxLength
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `minLength cannot be greater than maxLength`,
        path: ["minLength"],
      });
    }
    // Slider-specific validation
    if (data.type === "slider") {
      if (data.min === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `min is required for slider type`,
          path: ["min"],
        });
      }
      if (data.max === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `max is required for slider type`,
          path: ["max"],
        });
      }
      if (data.interval === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `interval is required for slider type`,
          path: ["interval"],
        });
      }
      if (
        data.min !== undefined &&
        data.max !== undefined &&
        data.min >= data.max
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `min must be less than max`,
          path: ["min"],
        });
      }
      if (
        data.min !== undefined &&
        data.max !== undefined &&
        data.interval !== undefined &&
        data.min + data.interval > data.max
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `min + interval must be less than or equal to max`,
          path: ["interval"],
        });
      }
    }
    if (data.type !== "slider" && data.min !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `min can only be specified for slider type`,
        path: ["min"],
      });
    }
    if (data.type !== "slider" && data.max !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `max can only be specified for slider type`,
        path: ["max"],
      });
    }
    if (data.type !== "slider" && data.interval !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `interval can only be specified for slider type`,
        path: ["interval"],
      });
    }
    if (data.type !== "slider" && data.labelPts !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `labelPts can only be specified for slider type`,
        path: ["labelPts"],
      });
    }
  });

export const metadataLogicalSchema = metadataRefineSchema;

export type MetadataType = z.infer<typeof metadataTypeSchema>;
export type MetadataRefineType = z.infer<typeof metadataRefineSchema>;

// Function to validate that labelPts length matches the number of response items for slider type
export const validateSliderLabels = (
  metadata: MetadataType,
  responseItems: string[],
): ZodIssue[] => {
  const issues: ZodIssue[] = [];

  if (metadata.type === "slider" && metadata.labelPts !== undefined) {
    if (metadata.labelPts.length !== responseItems.length) {
      issues.push({
        code: z.ZodIssueCode.custom,
        message: `labelPts length (${metadata.labelPts.length}) must match the number of labels (${responseItems.length})`,
        path: ["labelPts"],
      });
    }
  }

  return issues;
};

// Unified schema that validates and parses a complete prompt markdown file.
// Input: raw markdown string with three sections delimited by ---
// Output: { metadata, body, responseItems }
export const promptFileSchema = z
  .string()
  .min(1, "Prompt file string is empty")
  .transform((str, ctx) => {
    const trimmed = str.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Prompt file string is empty",
      });
      return z.NEVER;
    }

    const sections = trimmed.split(/^-{3,}$/gm);

    // Expect: ["", metadataYaml, body, responseString]
    // The first element is empty because the file starts with ---
    if (sections.length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Prompt file must have three sections separated by --- delimiters: metadata, body, and responses",
      });
      return z.NEVER;
    }

    const metadataYaml = sections[1];
    const body = sections[2];
    const responseString = sections[3];

    // Parse YAML metadata
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

    // Validate metadata against type schema
    const typeResult = metadataTypeSchema.safeParse(metadata);
    if (!typeResult.success) {
      typeResult.error.issues.forEach((issue) =>
        ctx.addIssue({
          ...issue,
          path: ["metadata", ...issue.path],
        }),
      );
      return z.NEVER;
    }

    // Validate metadata against refine schema (cross-field rules)
    const refineResult = metadataRefineSchema.safeParse(metadata);
    if (!refineResult.success) {
      refineResult.error.issues.forEach((issue) =>
        ctx.addIssue({
          ...issue,
          path: ["metadata", ...issue.path],
        }),
      );
    }

    // Validate body exists
    if (!body || body.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Prompt body section is empty",
        path: ["body"],
      });
    }

    // Parse and validate response items
    const parsedMetadata = typeResult.data;
    let responseItems: string[] = [];

    if (parsedMetadata.type !== "noResponse" && responseString) {
      const responseLines = responseString
        .split(/\r?\n|\r|\n/g)
        .filter((line) => line.trim().length > 0);

      for (const line of responseLines) {
        if (!(line.startsWith("- ") || line.startsWith(">"))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Response line must start with "- " (for multiple choice) or "> " (for open response). Got: "${line}"`,
            path: ["responses"],
          });
        }
      }

      responseItems = responseLines
        .filter((line) => line.startsWith("- ") || line.startsWith(">"))
        .map((line) => line.substring(2).trim());
    }

    // Validate slider labelPts against response items
    const sliderIssues = validateSliderLabels(parsedMetadata, responseItems);
    sliderIssues.forEach((issue) =>
      ctx.addIssue({
        ...issue,
        path: ["metadata", ...issue.path],
      }),
    );

    return {
      metadata: parsedMetadata,
      body: body?.trim() ?? "",
      responseItems,
    };
  });

export type PromptFileType = z.infer<typeof promptFileSchema>;
