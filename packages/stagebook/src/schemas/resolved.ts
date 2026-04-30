/**
 * Resolved (post-hydration) schemas for component consumption.
 *
 * These schemas describe what treatment data looks like AFTER template
 * expansion — no template contexts, no ${field} placeholders. They provide
 * proper TypeScript types for Stage, Element, and other component props.
 *
 * The full schemas in treatment.ts (with altTemplateContext wrappers) are
 * used for validating raw treatment files. These resolved schemas are used
 * by rendering components that only see hydrated data.
 */
import { z } from "zod";
import {
  nameSchema,
  durationSchema,
  displayTimeSchema,
  hideTimeSchema,
  positionSchema,
  positionSelectorSchema,
  showToPositionsSchema,
  hideFromPositionsSchema,
  discussionSchema,
  referenceSchema,
} from "./treatment.js";

// ----------------------------------------------------------------
// Resolved condition — no template placeholders in values
// ----------------------------------------------------------------

// Leaf shape of a resolved condition: reference + comparator + optional
// value, no template placeholders. Boolean-tree operators (#235) are
// described separately below.
const resolvedLeafConditionSchema = z
  .object({
    reference: referenceSchema,
    position: z
      .enum(["shared", "player", "all", "any", "percentAgreement"])
      .or(z.number().nonnegative().int())
      .optional(),
    comparator: z.enum([
      "exists",
      "doesNotExist",
      "equals",
      "doesNotEqual",
      "isAbove",
      "isBelow",
      "isAtLeast",
      "isAtMost",
      "hasLengthAtLeast",
      "hasLengthAtMost",
      "includes",
      "doesNotInclude",
      "matches",
      "doesNotMatch",
      "isOneOf",
      "isNotOneOf",
    ]),
    value: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.string().or(z.number())),
      ])
      .optional(),
  })
  .strict();

// Recursive resolved-condition node: an `all`/`any`/`none` operator,
// or a leaf. After template fill, the same boolean tree is what
// runtime/component code sees — no template placeholders, no string
// shorthand quirks, just the structured form.
const resolvedConditionNodeSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({ all: z.array(resolvedConditionNodeSchema).nonempty() }).strict(),
    z.object({ any: z.array(resolvedConditionNodeSchema).nonempty() }).strict(),
    z
      .object({ none: z.array(resolvedConditionNodeSchema).nonempty() })
      .strict(),
    resolvedLeafConditionSchema,
  ]),
);

// Backward-compat alias: `resolvedConditionSchema` previously meant a
// single leaf; it now means any node in the tree (leaf or operator).
const resolvedConditionSchema = resolvedConditionNodeSchema;

// Field-level shape: array (implicit-`all` sugar) or a single node.
// Mirrors `conditionsSchema` in treatment.ts.
const resolvedConditionsSchema = z
  .union([
    z.array(resolvedConditionNodeSchema).nonempty(),
    resolvedConditionNodeSchema,
  ])
  .optional();

// ----------------------------------------------------------------
// Resolved element — concrete type union, no placeholders
// ----------------------------------------------------------------

const resolvedElementBaseSchema = z.object({
  type: z.string(),
  name: nameSchema.optional(),
  file: z.string().optional(),
  displayTime: displayTimeSchema.optional(),
  hideTime: hideTimeSchema.optional(),
  showToPositions: showToPositionsSchema.optional(),
  hideFromPositions: hideFromPositionsSchema.optional(),
  conditions: resolvedConditionsSchema,
  tags: z.array(z.string()).optional(),
  // Allow additional fields for specific element types
  shared: z.boolean().optional(),
  buttonText: z.string().optional(),
  url: z.string().optional(),
  displayText: z.string().optional(),
  helperText: z.string().optional(),
  reference: z.string().optional(),
  position: positionSelectorSchema.optional(),
  surveyName: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  warnTimeRemaining: z.number().optional(),
  style: z.enum(["thin", "regular", "thick", ""]).optional(),
  width: z.number().optional(),
  urlParams: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        reference: z.string().optional(),
        position: positionSelectorSchema.optional(),
      }),
    )
    .optional(),
  // mediaPlayer fields
  syncToStageTime: z.boolean().optional(),
  submitOnComplete: z.boolean().optional(),
  playVideo: z.boolean().optional(),
  playAudio: z.boolean().optional(),
  captionsFile: z.string().optional(),
  startAt: z.number().optional(),
  stopAt: z.number().optional(),
  allowScrubOutsideBounds: z.boolean().optional(),
  stepDuration: z.number().optional(),
  controls: z
    .object({
      playPause: z.boolean().optional(),
      seek: z.boolean().optional(),
      step: z.boolean().optional(),
      speed: z.boolean().optional(),
    })
    .optional(),
});

export const resolvedElementSchema = resolvedElementBaseSchema;
export type ResolvedElementType = z.infer<typeof resolvedElementSchema>;

// ----------------------------------------------------------------
// Resolved stage — concrete duration, resolved elements
// ----------------------------------------------------------------

export const resolvedStageSchema = z.object({
  name: nameSchema,
  discussion: discussionSchema.optional(),
  duration: durationSchema,
  elements: z.array(resolvedElementSchema).nonempty(),
});
export type ResolvedStageType = z.infer<typeof resolvedStageSchema>;

// ----------------------------------------------------------------
// Resolved intro/exit step — no duration, no position visibility
// ----------------------------------------------------------------

export const resolvedIntroExitStepSchema = z.object({
  name: nameSchema,
  elements: z.array(resolvedElementSchema).nonempty(),
});
export type ResolvedIntroExitStepType = z.infer<
  typeof resolvedIntroExitStepSchema
>;

// ----------------------------------------------------------------
// Resolved treatment — concrete playerCount, resolved stages
// ----------------------------------------------------------------

export const resolvedTreatmentSchema = z.object({
  name: nameSchema,
  playerCount: z.number(),
  groupComposition: z
    .array(
      z.object({
        position: positionSchema,
        title: z.string().max(25).optional(),
        conditions: resolvedConditionsSchema,
      }),
    )
    .optional(),
  gameStages: z.array(resolvedStageSchema).nonempty(),
  exitSequence: z.array(resolvedIntroExitStepSchema).optional(),
});
export type ResolvedTreatmentType = z.infer<typeof resolvedTreatmentSchema>;

// ----------------------------------------------------------------
// Re-export resolved condition type
// ----------------------------------------------------------------

export { resolvedConditionSchema, resolvedConditionsSchema };
export type ResolvedConditionType = z.infer<typeof resolvedConditionSchema>;
