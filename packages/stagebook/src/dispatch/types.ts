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

export interface WeightedRandomDispatcherConfig {
  type: "weighted-random";
  /** Non-negative reals interpreted up to scale. `[1, 1, 1]`, `[100, 100, 100]`,
   *  and `[0.33, 0.33, 0.33]` produce identical samplers. Length must match
   *  the treatment count. A zero weight means "never pick this treatment"
   *  (useful for de-activating a condition without renumbering). */
  weights: number[] | FileReference;
}

export interface UrnDispatcherConfig {
  type: "urn";
  counts: number[] | FileReference;
  /** Square matrix; defaults to identity (decrement self by 1) when omitted. */
  decrements?: number[][] | FileReference;
}

/** Placeholder for the `local-penalization` dispatcher that stays in
 *  deliberation-lab. Stagebook only carries the *config shape* so the
 *  union in `DispatcherConfig` is closed; the implementation lives at
 *  the call site. */
export interface LocalPenalizationDispatcherConfig {
  type: "local-penalization";
  payoffs: number[] | "equal" | FileReference;
  knockdowns: number | number[] | number[][] | "none" | FileReference;
}

export type DispatcherConfig =
  | UniformRandomDispatcherConfig
  | WeightedRandomDispatcherConfig
  | UrnDispatcherConfig
  | LocalPenalizationDispatcherConfig;
