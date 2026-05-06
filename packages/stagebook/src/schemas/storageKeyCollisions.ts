/**
 * Storage-key collision detection (treatment-wide).
 *
 * Two elements that resolve to the same `{type}_{name}` storage key silently
 * overwrite each other's saved data. Storage keys must be unique across every
 * phase of a treatment (intro, game stages, exit). This is enforced at schema
 * validation time as an error — no per-stage carve-outs.
 *
 * Authors who need the same prompt file in multiple places use the per-element
 * `name:` override to disambiguate (e.g. `name: pretest_q1` vs `name: posttest_q1`).
 *
 * Key derivation mirrors the save() calls in src/components/elements/:
 *   audio        → `audio_${name ?? file}`
 *   prompt       → `prompt_${name}` (runtime fallback uses progressLabel +
 *                   metadata, which isn't derivable from the YAML alone, so
 *                   we only check explicitly-named prompts)
 *   survey       → `survey_${name ?? surveyName}`
 *   submitButton → `submitButton_${name}` (runtime fallback is progressLabel;
 *                   only checked when `name` is set)
 *   mediaPlayer  → `mediaPlayer_${name ?? url}`
 *   timeline     → `timeline_${name}` (name is required by the schema)
 *   trackedLink  → `trackedLink_${name}` (name is required by the schema)
 */

export interface StorageKeyCollision {
  /** The duplicated storage key, e.g. "prompt_q1". */
  key: string;
  /** Human-readable description. */
  message: string;
  /** Paths within the treatment file where the duplicate occurs. */
  paths: (string | number)[][];
}

type Path = (string | number)[];

function strField(obj: Record<string, unknown>, field: string): string | null {
  const val = obj[field];
  return typeof val === "string" && val.length > 0 ? val : null;
}

function storageKeyFor(element: unknown): string | null {
  if (!element || typeof element !== "object") return null;
  const el = element as Record<string, unknown>;
  if (typeof el.type !== "string") return null;
  const name = strField(el, "name");
  let suffix: string | null;
  switch (el.type) {
    case "audio":
      suffix = name ?? strField(el, "file");
      break;
    case "survey":
      suffix = name ?? strField(el, "surveyName");
      break;
    case "mediaPlayer":
      suffix = name ?? strField(el, "url");
      break;
    case "prompt":
    case "submitButton":
    case "timeline":
    case "trackedLink":
      suffix = name;
      break;
    default:
      return null;
  }
  return suffix ? `${el.type}_${suffix}` : null;
}

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

export function collectStorageKeyCollisions(
  data: unknown,
): StorageKeyCollision[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  // One global map across every phase.
  const keys = new Map<string, Path[]>();

  // Intro sequences
  const introSequences = Array.isArray(root.introSequences)
    ? root.introSequences
    : [];
  introSequences.forEach((seq, seqIdx) => {
    if (!seq || typeof seq !== "object") return;
    const s = seq as { introSteps?: unknown };
    const steps = Array.isArray(s.introSteps) ? s.introSteps : [];
    steps.forEach((step, stepIdx) => {
      if (!step || typeof step !== "object") return;
      const st = step as { elements?: unknown };
      scanElements(
        st.elements,
        ["introSequences", seqIdx, "introSteps", stepIdx, "elements"],
        keys,
      );
    });
  });

  // Treatments — gameStages and exitSequence
  const treatments = Array.isArray(root.treatments) ? root.treatments : [];
  treatments.forEach((treatment, treatmentIdx) => {
    if (!treatment || typeof treatment !== "object") return;
    const t = treatment as { gameStages?: unknown; exitSequence?: unknown };

    const gameStages = Array.isArray(t.gameStages) ? t.gameStages : [];
    gameStages.forEach((stage, stageIdx) => {
      if (!stage || typeof stage !== "object") return;
      const s = stage as { elements?: unknown };
      scanElements(
        s.elements,
        ["treatments", treatmentIdx, "gameStages", stageIdx, "elements"],
        keys,
      );
    });

    const exitSequence = Array.isArray(t.exitSequence) ? t.exitSequence : [];
    exitSequence.forEach((step, stepIdx) => {
      if (!step || typeof step !== "object") return;
      const st = step as { elements?: unknown };
      scanElements(
        st.elements,
        ["treatments", treatmentIdx, "exitSequence", stepIdx, "elements"],
        keys,
      );
    });
  });

  const out: StorageKeyCollision[] = [];
  keys.forEach((paths, key) => {
    if (paths.length < 2) return;
    out.push({
      key,
      paths,
      message: `Duplicate storage key "${key}": ${paths.length} elements share this key. Storage keys must be unique across every phase of a treatment file. Use the per-element \`name:\` override to disambiguate.`,
    });
  });
  return out;
}
