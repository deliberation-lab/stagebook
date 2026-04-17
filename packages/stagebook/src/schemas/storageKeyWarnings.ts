/**
 * Storage-key collision warnings.
 *
 * Two elements that resolve to the same `{type}_{name}` storage key silently
 * overwrite each other's saved data. `treatmentFileSchema` won't reject this
 * (cross-stage reuse is a legitimate pattern for tracking change over time),
 * so we surface it as a non-fatal warning callers can display however they
 * want — `safeParse` still succeeds.
 *
 * Scope:
 *   - within a single game stage's elements (cross-stage reuse is allowed)
 *   - across all steps of a single intro sequence (one solo phase)
 *   - across all steps of a single treatment's exitSequence (one solo phase)
 */

// Element types that write participant data keyed by `{type}_{name}`.
// Keep in sync with the save() calls in src/components/elements/.
const SAVING_ELEMENT_TYPES = new Set([
  "audio",
  "prompt",
  "survey",
  "submitButton",
  "mediaPlayer",
  "timeline",
  "trackedLink",
]);

export interface StorageKeyWarning {
  /** The duplicated storage key, e.g. "prompt_q1". */
  key: string;
  /** Human-readable description. */
  message: string;
  /** Paths within the treatment file where the duplicate occurs. */
  paths: (string | number)[][];
}

function storageKeyFor(element: unknown): string | null {
  if (!element || typeof element !== "object") return null;
  const el = element as { type?: unknown; name?: unknown };
  if (typeof el.type !== "string") return null;
  if (!SAVING_ELEMENT_TYPES.has(el.type)) return null;
  if (typeof el.name !== "string" || el.name.length === 0) return null;
  return `${el.type}_${el.name}`;
}

type Path = (string | number)[];

function scanElements(
  elements: unknown,
  basePath: Path,
  into: Map<string, Path[]>,
): void {
  if (!Array.isArray(elements)) return;
  elements.forEach((el, idx) => {
    const key = storageKeyFor(el);
    if (!key) return;
    const path: Path = [...basePath, idx];
    const existing = into.get(key);
    if (existing) {
      existing.push(path);
    } else {
      into.set(key, [path]);
    }
  });
}

function emitDuplicates(
  keys: Map<string, Path[]>,
  scopeDescription: string,
): StorageKeyWarning[] {
  const out: StorageKeyWarning[] = [];
  keys.forEach((paths, key) => {
    if (paths.length < 2) return;
    out.push({
      key,
      paths,
      message: `Duplicate storage key "${key}" in ${scopeDescription}: ${paths.length} elements share this key and will overwrite each other's saved data.`,
    });
  });
  return out;
}

function describe(name: unknown, fallbackIndex: number): string {
  return typeof name === "string" && name.length > 0
    ? `"${name}"`
    : `#${fallbackIndex}`;
}

export function collectStorageKeyWarnings(data: unknown): StorageKeyWarning[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const warnings: StorageKeyWarning[] = [];

  const treatments = Array.isArray(root.treatments) ? root.treatments : [];
  treatments.forEach((treatment, treatmentIdx) => {
    if (!treatment || typeof treatment !== "object") return;
    const t = treatment as {
      name?: unknown;
      gameStages?: unknown;
      exitSequence?: unknown;
    };

    // Per-stage check inside gameStages
    const gameStages = Array.isArray(t.gameStages) ? t.gameStages : [];
    gameStages.forEach((stage, stageIdx) => {
      if (!stage || typeof stage !== "object") return;
      const s = stage as { name?: unknown; elements?: unknown };
      const keys = new Map<string, Path[]>();
      scanElements(
        s.elements,
        ["treatments", treatmentIdx, "gameStages", stageIdx, "elements"],
        keys,
      );
      warnings.push(
        ...emitDuplicates(keys, `stage ${describe(s.name, stageIdx)}`),
      );
    });

    // Combined check across exitSequence steps
    const exitSequence = Array.isArray(t.exitSequence) ? t.exitSequence : [];
    if (exitSequence.length > 0) {
      const keys = new Map<string, Path[]>();
      exitSequence.forEach((step, stepIdx) => {
        if (!step || typeof step !== "object") return;
        const st = step as { elements?: unknown };
        scanElements(
          st.elements,
          ["treatments", treatmentIdx, "exitSequence", stepIdx, "elements"],
          keys,
        );
      });
      warnings.push(
        ...emitDuplicates(
          keys,
          `exitSequence of treatment ${describe(t.name, treatmentIdx)}`,
        ),
      );
    }
  });

  // Combined check across each introSequence's introSteps
  const introSequences = Array.isArray(root.introSequences)
    ? root.introSequences
    : [];
  introSequences.forEach((seq, seqIdx) => {
    if (!seq || typeof seq !== "object") return;
    const s = seq as { name?: unknown; introSteps?: unknown };
    const introSteps = Array.isArray(s.introSteps) ? s.introSteps : [];
    if (introSteps.length === 0) return;
    const keys = new Map<string, Path[]>();
    introSteps.forEach((step, stepIdx) => {
      if (!step || typeof step !== "object") return;
      const st = step as { elements?: unknown };
      scanElements(
        st.elements,
        ["introSequences", seqIdx, "introSteps", stepIdx, "elements"],
        keys,
      );
    });
    warnings.push(
      ...emitDuplicates(keys, `introSequence ${describe(s.name, seqIdx)}`),
    );
  });

  return warnings;
}
