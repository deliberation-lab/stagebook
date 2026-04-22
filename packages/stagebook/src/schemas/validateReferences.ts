/**
 * Cross-stage reference validation for treatment files (#197).
 *
 * Two rules:
 * 1. **No forward references** — applies to every reference site. A reference
 *    whose target storage key is produced by a *later* stage in the flow is
 *    rejected. External references (urlParams, participantInfo, …) are
 *    always valid.
 * 2. **No always-skip-at-load** — stage-level conditions only. A stage-level
 *    condition whose reference points at the *current* stage's data and
 *    whose `compare(undefined, comparator, value)` is not strictly `true`
 *    will always skip the stage at mount. Rejected with a suggestion to
 *    rethink the comparator (usually a forgotten `doesNotExist`).
 *
 * Only stage-level conditions get Rule 2 because element-level, display,
 * urlParam, discussion, and groupComposition references all have a
 * well-defined "wait for data" semantics: element not rendered, display
 * empty, urlParam omitted, discussion hidden, no player match. None of
 * those are fatal the way a stage-level always-skip is.
 */

import { getReferenceKeyAndPath } from "../utils/reference.js";
import { compare, type Comparator } from "../utils/compare.js";

/** Structured issue emitted by the walker. Translated to zod issues by the
 *  caller. `path` is relative to the top-level treatment file. */
export interface ReferenceValidationIssue {
  path: (string | number)[];
  message: string;
}

/** Discriminator for which rules apply at a given reference site. */
type ReferenceKind =
  | "stageCondition"
  | "elementCondition"
  | "displayReference"
  | "urlParam"
  | "discussionCondition"
  | "groupComposition";

/** Ranks for the linear "who runs first" order within a single treatment.
 *  groupComposition < intro < gameStage[0] < … < gameStage[n] < exit[0] …
 *  Intro is collapsed to a single rank because intro sequences are
 *  interchangeable (a treatment can pair with any of them at runtime).
 *  Within-intro-sequence ordering is validated separately per sequence. */
const RANK_GROUP_COMPOSITION = -1;
const RANK_INTRO = 0;
const RANK_GAME_BASE = 1;

/** The types of reference whose target keys are **produced by a stage**. A
 *  reference of any other type (urlParams, participantInfo, …) is external
 *  and always valid regardless of position. */
const STAGE_PRODUCED_REF_TYPES = new Set([
  "prompt",
  "survey",
  "submitButton",
  "qualtrics",
  "timeline",
  "trackedLink",
  "discussion",
]);

/**
 * Main entrypoint — given a parsed treatment-file tree, walks every reference
 * site and returns validation issues. Accepts `unknown` because the walker
 * runs pre-validation (zod `superRefine`'s input is partially-valid).
 */
export function validateTreatmentFileReferences(
  treatmentFile: unknown,
): ReferenceValidationIssue[] {
  const issues: ReferenceValidationIssue[] = [];
  if (!isRecord(treatmentFile)) return issues;

  // Intro sequences: validate each sequence in isolation for within-sequence
  // forward references and stage-level always-skip.
  const introSequences = toArray(treatmentFile.introSequences);
  introSequences.forEach((seq, seqIdx) => {
    if (!isRecord(seq)) return;
    const steps = toArray(seq.introSteps);
    validateStepSequence({
      steps,
      sequencePath: ["introSequences", seqIdx, "introSteps"],
      phase: "intro",
      issues,
    });
  });

  // Intro-phase produced keys — merged across every intro sequence. Game
  // stages and exit steps are allowed to reference any intro-phase key.
  const introProducedKeys = new Set<string>();
  for (const seq of introSequences) {
    if (!isRecord(seq)) continue;
    for (const step of toArray(seq.introSteps)) {
      collectProducedKeys(step, introProducedKeys);
    }
  }

  // Each treatment has its own game/exit rank space.
  const treatments = toArray(treatmentFile.treatments);
  treatments.forEach((treatment, treatmentIdx) => {
    if (!isRecord(treatment)) return;
    validateTreatment({
      treatment,
      treatmentPath: ["treatments", treatmentIdx],
      introProducedKeys,
      issues,
    });
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Per-sequence (intro or exit) and per-treatment walkers
// ---------------------------------------------------------------------------

/** Validate a linear sequence of steps (intro sequence). Each step has its
 *  own rank within the sequence; later steps can reference earlier steps. */
function validateStepSequence({
  steps,
  sequencePath,
  phase,
  issues,
  priorPhaseKeys,
}: {
  steps: unknown[];
  sequencePath: (string | number)[];
  phase: "intro" | "exit";
  issues: ReferenceValidationIssue[];
  /** Keys produced by earlier phases (for exit sequences: intro + game). */
  priorPhaseKeys?: Set<string>;
}): void {
  // Build producedAt: key → earliest step index that produces it.
  const producedAt = new Map<string, number>();
  steps.forEach((step, stepIdx) => {
    for (const key of collectStepKeys(step)) {
      if (!producedAt.has(key)) producedAt.set(key, stepIdx);
    }
  });

  steps.forEach((step, stepIdx) => {
    if (!isRecord(step)) return;
    const sites = enumerateStepSites(step, [...sequencePath, stepIdx]);
    for (const site of sites) {
      applyRules({
        site,
        enclosingRank: stepIdx,
        producedAt,
        issues,
        priorPhaseKeys,
        phaseLabel: phase === "intro" ? "intro step" : "exit step",
      });
    }
  });
}

function validateTreatment({
  treatment,
  treatmentPath,
  introProducedKeys,
  issues,
}: {
  treatment: Record<string, unknown>;
  treatmentPath: (string | number)[];
  introProducedKeys: Set<string>;
  issues: ReferenceValidationIssue[];
}): void {
  const gameStages = toArray(treatment.gameStages);
  const exitSequence = toArray(treatment.exitSequence);

  // Per-treatment ranks: game stages 1..K, exit entries K+1…. Intro sits
  // at a single virtual rank (RANK_INTRO) before game stages; its produced
  // keys are in `introProducedKeys` and treated as "always earlier."
  const producedAt = new Map<string, number>();
  // Pre-seed intro keys at RANK_INTRO so forward comparisons always place
  // them before any game/exit rank.
  for (const key of introProducedKeys) {
    if (!producedAt.has(key)) producedAt.set(key, RANK_INTRO);
  }
  gameStages.forEach((stage, idx) => {
    for (const key of collectStepKeys(stage)) {
      if (!producedAt.has(key)) producedAt.set(key, RANK_GAME_BASE + idx);
    }
  });
  exitSequence.forEach((step, idx) => {
    for (const key of collectStepKeys(step)) {
      if (!producedAt.has(key))
        producedAt.set(key, RANK_GAME_BASE + gameStages.length + idx);
    }
  });

  // groupComposition runs before any stage — can only reference intro +
  // external.
  const groupComposition = toArray(treatment.groupComposition);
  groupComposition.forEach((player, playerIdx) => {
    if (!isRecord(player)) return;
    const conditions = toArray(player.conditions);
    conditions.forEach((cond, condIdx) => {
      if (!isRecord(cond)) return;
      const ref = cond.reference;
      if (typeof ref !== "string") return;
      const site = {
        reference: ref,
        kind: "groupComposition" as const,
        path: [
          ...treatmentPath,
          "groupComposition",
          playerIdx,
          "conditions",
          condIdx,
          "reference",
        ],
      };
      applyRules({
        site,
        enclosingRank: RANK_GROUP_COMPOSITION,
        producedAt,
        issues,
        // groupComposition's rule: target must be intro-phase or external.
        // Pass intro keys as the only valid phase.
        allowedProducerRanks: new Set([RANK_INTRO]),
      });
    });
  });

  // Game stages
  gameStages.forEach((stage, stageIdx) => {
    if (!isRecord(stage)) return;
    const rank = RANK_GAME_BASE + stageIdx;
    const stagePath = [...treatmentPath, "gameStages", stageIdx];
    for (const site of enumerateStepSites(stage, stagePath)) {
      applyRules({
        site,
        enclosingRank: rank,
        producedAt,
        issues,
        phaseLabel: "game stage",
      });
    }
    // Discussion conditions nested under the stage
    const discussion = stage.discussion;
    if (isRecord(discussion)) {
      const discConds = toArray(discussion.conditions);
      discConds.forEach((cond, condIdx) => {
        if (!isRecord(cond)) return;
        const ref = cond.reference;
        if (typeof ref !== "string") return;
        applyRules({
          site: {
            reference: ref,
            kind: "discussionCondition",
            path: [
              ...stagePath,
              "discussion",
              "conditions",
              condIdx,
              "reference",
            ],
          },
          enclosingRank: rank,
          producedAt,
          issues,
          phaseLabel: "game stage",
        });
      });
    }
  });

  // Exit sequence
  exitSequence.forEach((step, stepIdx) => {
    if (!isRecord(step)) return;
    const rank = RANK_GAME_BASE + gameStages.length + stepIdx;
    const stepPath = [...treatmentPath, "exitSequence", stepIdx];
    for (const site of enumerateStepSites(step, stepPath)) {
      applyRules({
        site,
        enclosingRank: rank,
        producedAt,
        issues,
        phaseLabel: "exit step",
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Reference-site enumeration
// ---------------------------------------------------------------------------

interface RefSite {
  reference: string;
  kind: ReferenceKind;
  path: (string | number)[];
  /** Stage-level conditions only: needed for Rule 2 simulation. */
  comparator?: string;
  value?: unknown;
}

/** Enumerate every reference site inside a single step/stage:
 *  stage-level conditions + every element's conditions + display refs +
 *  urlParam refs. Discussion conditions are handled separately at the
 *  stage walker (they live on `stage.discussion.conditions`, not on an
 *  element).
 */
function enumerateStepSites(
  step: unknown,
  stepPath: (string | number)[],
): RefSite[] {
  const sites: RefSite[] = [];
  if (!isRecord(step)) return sites;

  // Stage-level conditions
  const stepConditions = toArray(step.conditions);
  stepConditions.forEach((cond, condIdx) => {
    if (!isRecord(cond)) return;
    const ref = cond.reference;
    if (typeof ref !== "string") return;
    sites.push({
      reference: ref,
      kind: "stageCondition",
      path: [...stepPath, "conditions", condIdx, "reference"],
      comparator:
        typeof cond.comparator === "string" ? cond.comparator : undefined,
      value: cond.value,
    });
  });

  // Element-level sites
  const elements = toArray(step.elements);
  elements.forEach((element, elemIdx) => {
    if (!isRecord(element)) return;
    const elemPath = [...stepPath, "elements", elemIdx];
    const elemType = element.type;

    // conditions on any element
    const elemConditions = toArray(element.conditions);
    elemConditions.forEach((cond, condIdx) => {
      if (!isRecord(cond)) return;
      const ref = cond.reference;
      if (typeof ref !== "string") return;
      sites.push({
        reference: ref,
        kind: "elementCondition",
        path: [...elemPath, "conditions", condIdx, "reference"],
      });
    });

    // display element: its own top-level `reference` field
    if (elemType === "display" && typeof element.reference === "string") {
      sites.push({
        reference: element.reference,
        kind: "displayReference",
        path: [...elemPath, "reference"],
      });
    }

    // trackedLink / qualtrics: each urlParams entry can carry a reference
    if (elemType === "trackedLink" || elemType === "qualtrics") {
      const urlParams = toArray(element.urlParams);
      urlParams.forEach((param, paramIdx) => {
        if (!isRecord(param)) return;
        const ref = param.reference;
        if (typeof ref !== "string") return;
        sites.push({
          reference: ref,
          kind: "urlParam",
          path: [...elemPath, "urlParams", paramIdx, "reference"],
        });
      });
    }
  });

  return sites;
}

// ---------------------------------------------------------------------------
// Rule application
// ---------------------------------------------------------------------------

function applyRules({
  site,
  enclosingRank,
  producedAt,
  issues,
  priorPhaseKeys,
  allowedProducerRanks,
  phaseLabel,
}: {
  site: RefSite;
  enclosingRank: number;
  producedAt: Map<string, number>;
  issues: ReferenceValidationIssue[];
  /** For exit-phase walkers: keys produced by earlier phases that aren't
   *  in the exit-local producedAt map. */
  priorPhaseKeys?: Set<string>;
  /** For groupComposition: a whitelist of producer ranks that the target
   *  key must live in. Anything else (or a non-whitelisted stage-produced
   *  target) is rejected. */
  allowedProducerRanks?: Set<number>;
  /** Context word used in error messages — "game stage", "intro step", … */
  phaseLabel?: string;
}): void {
  // Try to parse the reference.
  let referenceKey: string;
  try {
    ({ referenceKey } = getReferenceKeyAndPath(site.reference));
  } catch {
    // Malformed references are a different class of error — not our job.
    return;
  }

  // Determine the reference's "type" (first segment). External types
  // always validate; stage-produced types go through the producer check.
  const refType = site.reference.split(".")[0];
  if (!STAGE_PRODUCED_REF_TYPES.has(refType)) return;

  // Look up the producer rank. If the key isn't produced anywhere in the
  // treatment (and not in the prior-phase keys), skip — it's either a
  // typo (other tooling) or produced by external state we can't model.
  const producerRank =
    producedAt.get(referenceKey) ??
    (priorPhaseKeys?.has(referenceKey) ? RANK_INTRO : undefined);
  if (producerRank === undefined) return;

  // groupComposition: target must be in the allowed-rank whitelist.
  if (allowedProducerRanks && !allowedProducerRanks.has(producerRank)) {
    issues.push({
      path: site.path,
      message: `groupComposition condition references "${site.reference}", which is produced by a game or exit stage. groupComposition is evaluated before any stage runs — it can only reference intro-phase data or external values (urlParams, participantInfo, …).`,
    });
    return;
  }

  // Rule 1 — forward reference. Reject if the producer is in a later stage.
  if (producerRank > enclosingRank) {
    const phase = phaseLabel ?? "stage";
    issues.push({
      path: site.path,
      message: `Reference "${site.reference}" points at data produced by a later ${phase} (rank ${String(producerRank)}) than the one this condition/reference belongs to (rank ${String(enclosingRank)}). Forward references are always falsy at runtime — reorder the stages or move the reference.`,
    });
    return;
  }

  // Rule 2 — stage-level "always-skip at load". Only applies to
  // stageCondition sites whose reference points at the *current* stage.
  if (
    site.kind === "stageCondition" &&
    producerRank === enclosingRank &&
    site.comparator !== undefined
  ) {
    const result = compare(
      undefined,
      site.comparator as Comparator,
      site.value,
    );
    if (result !== true) {
      issues.push({
        path: site.path,
        message: `Stage-level condition on "${site.reference}" will always skip the stage at load. This references the current stage's data, which is undefined at mount, and compare(undefined, "${site.comparator}", …) is not true. Did you mean \`comparator: doesNotExist\` (the usual pattern for ending a stage once a value arrives)?`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Produced-key collection
// ---------------------------------------------------------------------------

/** Collect every storage key produced by the elements inside a single step
 *  (stage or intro/exit step). */
function collectStepKeys(step: unknown): Set<string> {
  const keys = new Set<string>();
  if (!isRecord(step)) return keys;
  for (const el of toArray(step.elements)) {
    collectProducedKeys(el, keys);
  }
  return keys;
}

/** Map an element (or a bare prompt-shorthand path string) to its storage
 *  key (or keys) and add them to `acc`. The key conventions mirror
 *  `getReferenceKeyAndPath` so lookups line up.
 */
function collectProducedKeys(element: unknown, acc: Set<string>): void {
  // Prompt-shorthand: a bare "*.prompt.md" string inside `elements` stands
  // in for `{ type: "prompt", file: <str>, name: <str> }`. Without a name
  // it still produces `prompt_<str>` since the shorthand auto-names from
  // the path.
  if (typeof element === "string" && element.endsWith(".prompt.md")) {
    acc.add(`prompt_${element}`);
    return;
  }
  if (!isRecord(element)) return;
  const type = element.type;
  const name = element.name;
  if (typeof type !== "string" || typeof name !== "string") return;
  if (
    type === "prompt" ||
    type === "survey" ||
    type === "submitButton" ||
    type === "qualtrics" ||
    type === "timeline" ||
    type === "trackedLink"
  ) {
    acc.add(`${type}_${name}`);
  }
  // "discussion" references use the discussion's own name as the storage
  // key (per getReferenceKeyAndPath's `discussion` branch). We don't
  // currently track discussion names as produced keys at this level —
  // discussions are a stage-level construct and their metrics come from
  // runtime, not from a tracked element. Skipping is safe because
  // references to discussion keys fall through to the "target not in
  // producedAt" branch (no false positives) and runtime handles them.
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
