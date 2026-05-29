// Types used by stagebook's dispatcher module (#448).
//
// Three concerns live here:
//   - The structural Treatment / Assignment shapes the dispatchers consume
//     and produce. They mirror the deliberation-lab dispatcher shapes so
//     hosts can call into either without translating.
//   - The EligibilityTable interface — a pre-computed lookup for "is
//     player P eligible for treatment T's position p?" Decouples the
//     dispatcher from reference-resolution; see makeEligibilityTable.ts.
//   - The dispatcher-config discriminated unions surfaced in batch
//     configs (`dispatcher: { type: ..., ... }`).
//
// We deliberately keep these types loose at the boundary. A `Treatment`
// only needs `name`, `playerCount`, and an optional `groupComposition`;
// callers may carry extra fields (gameStages, exitSequence, …) and the
// dispatcher passes them through untouched on each returned assignment.

/** A single condition leaf as it appears on a `groupComposition[i].conditions` entry. */
export interface DispatchCondition {
  reference: string;
  comparator: string;
  value?: unknown;
}

/** Mirror of stagebook's tree-of-conditions shape on a groupComposition slot.
 *  We don't re-export the schema-derived `ConditionNode` to keep this module
 *  importable without zod. */
export type DispatchConditionNode =
  | { all: DispatchConditionNode[] }
  | { any: DispatchConditionNode[] }
  | { none: DispatchConditionNode[] }
  | DispatchCondition;

/** A single slot description inside a treatment's `groupComposition`. */
export interface DispatchSlot {
  position: number;
  conditions?: DispatchConditionNode[] | DispatchConditionNode;
}

/** Minimum-viable Treatment shape consumed by the dispatcher.
 *
 *  Callers typically pass the full resolved treatment object straight
 *  from the treatment file — the dispatcher only reads `name`,
 *  `playerCount`, and `groupComposition`. Everything else rides along
 *  on the returned assignment.position. */
export interface Treatment {
  name: string;
  playerCount: number;
  /** Optional. When omitted, every player is eligible for every slot. */
  groupComposition?: DispatchSlot[];
  // Pass-through extras (gameStages, exitSequence, label, variant, …).
  [extra: string]: unknown;
}

/** One slot assignment inside a group. */
export interface PositionAssignment {
  playerId: string;
  position: number;
}

/** One game/group to create. */
export interface Assignment {
  treatment: Treatment;
  positionAssignments: PositionAssignment[];
}

/** Base shape returned by every dispatcher. Algorithm-specific extras
 *  (e.g. urn's `remainingCounts`) ride along on the same object — see
 *  per-dispatcher result types below. */
export interface DispatchResult {
  assignments: Assignment[];
}

/** Pre-computed eligibility lookup for `(playerId, treatmentIndex, position)`.
 *
 *  Built once per dispatch tick by `makeEligibilityTable`, then handed to
 *  the dispatcher so the algorithm itself sees only structural facts
 *  (IDs + booleans) — no PlayerView, no reference resolution. */
export interface EligibilityTable {
  isEligible(
    playerId: string,
    treatmentIndex: number,
    position: number,
  ): boolean;
}

/** Snapshot of each candidate player's data, keyed by storage-key.
 *
 *  Storage-keys follow stagebook's `<source>_<name>` convention for
 *  named sources (`prompt_role`) and the bare source name for external
 *  sources (`entryUrl`). See `getReferenceKeyAndPath`. The host populates
 *  this map for keys returned by `extractConditionKeys`. */
export type PlayerDataSnapshot = Record<string, Record<string, unknown>>;

// ─── Dispatcher configs (discriminated union by `type`) ───────────────

/** Reference to data carried in a sibling file alongside the batch config.
 *  The host resolves the reference and substitutes the literal value at
 *  config-load time; the dispatcher itself only ever sees the resolved
 *  numbers. The type lives here so `validateDispatcherConfig` can accept
 *  either form at the boundary. */
export interface FileReference {
  from: string;
}

export interface UniformRandomDispatcherConfig {
  type: "uniform-random";
}

/** Map from treatment name → non-negative real. Used for `urn` counts,
 *  `weighted-random` weights, and similar 1-D per-treatment parameters.
 *  Labels are validated against the treatment name set at config-time;
 *  missing or extra labels are an error. */
export type LabeledScalars = Record<string, number>;

/** Map from row treatment name → (map from column treatment name → value).
 *  Used for `urn`'s decrement matrix.
 *
 *  Specification is binary: either you omit `decrements` entirely
 *  (gets the identity matrix as a default) OR you specify it, in
 *  which case it's a strict literal — every treatment must have a
 *  row, and missing column entries within a row default to 0. There
 *  is no "partial matrix layered over identity" mode; if you want
 *  identity behavior on a particular row, write it (`T_x: {T_x: 1}`).
 *
 *  This keeps the mental model simple: matrix off → identity; matrix
 *  on → literal. And it eliminates the silent-footgun case where an
 *  author writes a partial row and accidentally zeros out the
 *  self-decrement of a treatment. */
export type LabeledMatrix = Record<string, Record<string, number>>;

export interface WeightedRandomDispatcherConfig {
  type: "weighted-random";
  /** Non-negative reals interpreted up to scale. `{T_a: 1, T_b: 1}`,
   *  `{T_a: 100, T_b: 100}`, and `{T_a: 0.5, T_b: 0.5}` are identical
   *  samplers. Label set must equal the treatment name set. A zero
   *  weight means "never pick this treatment" (useful for deactivating
   *  a condition without renumbering). */
  weights: LabeledScalars | FileReference;
}

export interface UrnDispatcherConfig {
  type: "urn";
  /** Per-treatment target counts, by name. Label set must equal the
   *  treatment name set. */
  counts: LabeledScalars | FileReference;
  /** Optional decrement matrix, by name. When omitted entirely, the
   *  full matrix defaults to identity. When specified, it's a strict
   *  literal: every treatment must have a row, and missing column
   *  entries within a row default to 0. */
  decrements?: LabeledMatrix | FileReference;
}

/** Placeholder for the `local-penalization` dispatcher that stays in
 *  deliberation-lab. Stagebook only carries the *config shape* so the
 *  union in `DispatcherConfig` is closed; the implementation lives at
 *  the call site. */
export interface LocalPenalizationDispatcherConfig {
  type: "local-penalization";
  payoffs: LabeledScalars | "equal" | FileReference;
  knockdowns: number | LabeledScalars | LabeledMatrix | "none" | FileReference;
}

export type DispatcherConfig =
  | UniformRandomDispatcherConfig
  | WeightedRandomDispatcherConfig
  | UrnDispatcherConfig
  | LocalPenalizationDispatcherConfig;
