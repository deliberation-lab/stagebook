/**
 * Reference schemas (#240, #246).
 *
 * A reference identifies a value somewhere in the study state. There are two
 * kinds: **named** sources (`prompt`, `survey`, …) whose data is keyed by
 * a researcher-chosen `name`, and **external** sources (`entryUrl`,
 * `participantInfo`, …) supplied by the host as a singleton.
 *
 * References can be written two ways:
 *   - **String shorthand** (the original syntax) — `prompt.familiarity`,
 *     `entryUrl.params.condition`, `survey.TIPI.responses.q1`.
 *   - **Structured object** — `{ source: "prompt", name: "familiarity" }`,
 *     `{ source: "entryUrl", path: ["params", "condition"] }`. Same
 *     expressivity plus the ability to override defaults that the dotted
 *     form bakes in.
 *
 * The string shorthand is parsed into the structured form, so downstream
 * code only ever sees `{source, name?, path?}` shapes.
 *
 * Lives in its own module (not `treatment.ts`) so the cross-stage walker
 * `validateReferences.ts` can import the parser without creating a circular
 * import (`treatment.ts` imports the walker for its outer superRefine).
 */

import { z } from "zod";
import { nameSchema } from "./primitives.js";

export const namedSourceEnum = z.enum([
  "prompt",
  "survey",
  "submitButton",
  "qualtrics",
  "timeline",
  "trackedLink",
  "discussion",
]);
export type NamedSource = z.infer<typeof namedSourceEnum>;

export const externalSourceEnum = z.enum([
  // `entryUrl.params.<key>` reads the participant's incoming query
  // parameters. The `params` subpath is required (the namespace is
  // reserved for `entryUrl.path`, `entryUrl.host`, etc. as future
  // additions, see #246). Renamed from the legacy `urlParams` source
  // so it doesn't collide with the unrelated `urlParams:` element field
  // (outgoing params on trackedLink / qualtrics).
  "entryUrl",
  "connectionInfo",
  "browserInfo",
  "participantInfo",
]);
export type ExternalSource = z.infer<typeof externalSourceEnum>;

const referencePathSchema = z.array(z.string().min(1));

export const namedReferenceSchema = z
  .object({
    source: namedSourceEnum,
    name: nameSchema,
    path: referencePathSchema.optional(),
  })
  .strict();
export type NamedReferenceType = z.infer<typeof namedReferenceSchema>;

export const externalReferenceSchema = z
  .object({
    source: externalSourceEnum,
    path: referencePathSchema.nonempty({
      message: "External-source references require a non-empty `path`.",
    }),
  })
  .strict()
  // `entryUrl` references must currently be addressed via the `params`
  // subpath (#246). The namespace is reserved so future additions like
  // `entryUrl.path`, `entryUrl.host`, `entryUrl.href` can land
  // non-breakingly. Other external sources are unconstrained beyond the
  // non-empty path requirement above.
  .superRefine((data, ctx) => {
    if (data.source === "entryUrl") {
      if (data.path.length < 2 || data.path[0] !== "params") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["path"],
          message:
            "entryUrl references must use the `params` subpath: `entryUrl.params.<key>`. (Other entryUrl subpaths like `path`, `host`, `href` are reserved for future use.)",
        });
      }
    }
  });
export type ExternalReferenceType = z.infer<typeof externalReferenceSchema>;

/** Result of normalising a reference: always one of the two structured shapes. */
export type ReferenceType = NamedReferenceType | ExternalReferenceType;

const NAMED_SOURCES: ReadonlySet<string> = new Set(namedSourceEnum.options);
const EXTERNAL_SOURCES: ReadonlySet<string> = new Set(
  externalSourceEnum.options,
);
const ALL_SOURCES = [
  ...namedSourceEnum.options,
  ...externalSourceEnum.options,
] as const;

/**
 * Parse a dotted-string reference into its structured form. Returns either
 * `{ ok: true, value }` or `{ ok: false, message }`. Used by the schema
 * (string-shorthand sugar) AND by `getReferenceKeyAndPath` when a runtime
 * caller passes a string instead of the structured form.
 *
 * The result is then re-validated against the structured schemas
 * (`namedReferenceSchema` / `externalReferenceSchema`) so the string-shorthand
 * branch enforces the same constraints as the structured branch
 * (`nameSchema` regex, non-empty path segments) — the two forms remain
 * exactly equivalent.
 */
export function parseDottedReference(
  str: string,
): { ok: true; value: ReferenceType } | { ok: false; message: string } {
  const segments = str.split(".");
  const [source, ...rest] = segments;
  if (!source) {
    return { ok: false, message: "Reference must include a source." };
  }
  // Legacy `urlParams.<key>` was renamed to `entryUrl.params.<key>` in
  // #246 to disambiguate from the unrelated `urlParams:` element field
  // (outgoing params on trackedLink / qualtrics). Surface a clear hint
  // instead of a generic "invalid source" so existing files migrate
  // cleanly.
  if (source === "urlParams") {
    const key = rest.length > 0 ? rest.join(".") : "<key>";
    return {
      ok: false,
      message: `\`urlParams\` reference source was renamed to \`entryUrl.params\` (#246). Use \`entryUrl.params.${key}\` instead of \`urlParams.${key}\`.`,
    };
  }
  if (NAMED_SOURCES.has(source)) {
    const [name, ...path] = rest;
    if (name === undefined || name.length < 1) {
      return {
        ok: false,
        message: `A name must be provided, e.g. '${source}.elementName'.`,
      };
    }
    const candidate =
      path.length > 0
        ? { source: source as NamedSource, name, path }
        : { source: source as NamedSource, name };
    const parsed = namedReferenceSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        message: `Invalid reference '${str}': ${parsed.error.issues[0]?.message ?? "validation failed"}`,
      };
    }
    return { ok: true, value: parsed.data };
  }
  if (EXTERNAL_SOURCES.has(source)) {
    if (rest.length < 1) {
      return {
        ok: false,
        message: `A path must be provided, e.g. '${source}.fieldName'.`,
      };
    }
    const candidate = {
      source: source as ExternalSource,
      path: rest as [string, ...string[]],
    };
    const parsed = externalReferenceSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        message: `Invalid reference '${str}': ${parsed.error.issues[0]?.message ?? "validation failed"}`,
      };
    }
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    message: `Invalid reference source "${source}". Valid sources are: ${ALL_SOURCES.join(", ")}.`,
  };
}

/**
 * Render a structured reference back to its dotted-string form. The inverse
 * of `parseDottedReference` for a normalised input. Used as the canonical
 * string representation in error messages, the Display element's
 * `data-reference` attribute, and anywhere downstream tooling expects the
 * familiar dotted form.
 */
export function formatReference(ref: ReferenceType): string {
  if ("name" in ref) {
    return ref.path && ref.path.length > 0
      ? `${ref.source}.${ref.name}.${ref.path.join(".")}`
      : `${ref.source}.${ref.name}`;
  }
  return `${ref.source}.${ref.path.join(".")}`;
}

const stringReferenceSchema = z.string().transform((str, ctx) => {
  const parsed = parseDottedReference(str);
  if (!parsed.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: parsed.message,
    });
    return z.NEVER;
  }
  return parsed.value;
});

/**
 * Reference field schema — accepts either:
 *   - the dotted-string sugar (`prompt.foo`, `entryUrl.params.condition`)
 *   - the structured `{ source, name?, path? }` object form
 *
 * Output is always the structured form (the string-sugar branch transforms
 * to the same shape). Validation: named sources require `name` and forbid
 * empty `path` segments; external sources forbid `name` and require a
 * non-empty `path`.
 */
export const referenceSchema = z.union([
  namedReferenceSchema,
  externalReferenceSchema,
  stringReferenceSchema,
]);
