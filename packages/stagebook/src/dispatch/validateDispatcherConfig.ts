import type {
  DispatcherConfig,
  UniformRandomDispatcherConfig,
  UrnDispatcherConfig,
} from "./types.js";

/** One validation diagnostic. `path` points into the config object using
 *  the same dotted convention zod does (`"counts"`, `"decrements.2.1"`)
 *  so callers can surface it the same way they surface zod issues. */
export interface DispatcherConfigDiagnostic {
  path: string;
  message: string;
}

export interface DispatcherConfigValidationResult {
  ok: boolean;
  diagnostics: DispatcherConfigDiagnostic[];
}

/**
 * Validate the parameter shape of a dispatcher config that the host has
 * already resolved (file-reference `{from: "./counts.json"}` shapes
 * substituted with the concrete arrays). Catches the things the
 * dispatcher itself trusts but the issue body calls out as config-time
 * checks:
 *
 *   - `urn.counts[i]` non-negative integer
 *   - `urn.decrements` (when present) square N×N of non-negative
 *     integers
 *   - `urn.decrements[i][j] <= counts[j]` — can't subtract more balls
 *     than exist initially
 *
 * The function is intentionally tolerant of dispatchers it doesn't
 * recognize (returns `ok: true` with a single warning-style diagnostic)
 * so deliberation-lab can register `local-penalization` against the
 * same validator without stagebook needing to know its parameter shape.
 *
 * @param config Resolved dispatcher config (file refs already substituted).
 * @param treatmentCount Number of treatments in the batch (square-matrix check).
 */
export function validateDispatcherConfig(
  config: unknown,
  treatmentCount: number,
): DispatcherConfigValidationResult {
  const diagnostics: DispatcherConfigDiagnostic[] = [];
  const push = (path: string, message: string) =>
    diagnostics.push({ path, message });

  if (config === null || typeof config !== "object") {
    push("", "dispatcher config must be an object");
    return { ok: false, diagnostics };
  }
  const c = config as { type?: unknown };
  if (typeof c.type !== "string" || c.type.length === 0) {
    push("type", "dispatcher `type` must be a non-empty string");
    return { ok: false, diagnostics };
  }

  switch (c.type) {
    case "uniform-random":
      return validateUniformRandom(config as UniformRandomDispatcherConfig);
    case "urn":
      return validateUrn(config as UrnDispatcherConfig, treatmentCount);
    case "local-penalization":
      // Implementation lives in deliberation-lab; stagebook only checks
      // that the discriminator is recognized. The host validator there
      // will catch payoffs/knockdowns shape issues.
      return { ok: true, diagnostics: [] };
    default:
      push(
        "type",
        `unknown dispatcher type "${c.type}" — expected one of: uniform-random, urn, local-penalization`,
      );
      return { ok: false, diagnostics };
  }
}

function validateUniformRandom(
  config: UniformRandomDispatcherConfig,
): DispatcherConfigValidationResult {
  // The trivial-case dispatcher carries no params beyond `type`. Extra
  // keys would silently mislead the author into thinking a counts/
  // decrements field had an effect, so we reject them here.
  const allowed = new Set(["type"]);
  const diagnostics: DispatcherConfigDiagnostic[] = [];
  for (const k of Object.keys(config)) {
    if (!allowed.has(k)) {
      diagnostics.push({
        path: k,
        message: `\`uniform-random\` dispatcher does not accept a \`${k}\` field. Use \`urn\` for count-based targets.`,
      });
    }
  }
  return { ok: diagnostics.length === 0, diagnostics };
}

function validateUrn(
  config: UrnDispatcherConfig,
  treatmentCount: number,
): DispatcherConfigValidationResult {
  const diagnostics: DispatcherConfigDiagnostic[] = [];
  const push = (path: string, message: string) =>
    diagnostics.push({ path, message });

  if (!("counts" in config)) {
    push("counts", "`urn` dispatcher requires a `counts` array");
    return { ok: false, diagnostics };
  }
  if (isFileReference(config.counts)) {
    push(
      "counts",
      "`counts` is still a file reference — the host must resolve `{from: ...}` before calling the validator",
    );
    return { ok: false, diagnostics };
  }
  if (!Array.isArray(config.counts)) {
    push("counts", "`counts` must be an array of non-negative integers");
    return { ok: false, diagnostics };
  }
  const counts = config.counts as unknown[];
  if (counts.length !== treatmentCount) {
    push(
      "counts",
      `\`counts.length\` (${counts.length}) must equal the number of treatments (${treatmentCount})`,
    );
  }
  counts.forEach((v, i) => {
    if (!isNonNegativeInteger(v)) {
      push(
        `counts.${i}`,
        `counts[${i}] must be a non-negative integer, got ${formatValue(v)}`,
      );
    }
  });

  if (config.decrements !== undefined) {
    if (isFileReference(config.decrements)) {
      push(
        "decrements",
        "`decrements` is still a file reference — the host must resolve `{from: ...}` before calling the validator",
      );
      return { ok: false, diagnostics };
    }
    if (!Array.isArray(config.decrements)) {
      push(
        "decrements",
        "`decrements` must be a square N×N matrix of non-negative integers (or omitted for the identity-matrix default)",
      );
      return { ok: diagnostics.length === 0, diagnostics };
    }
    const matrix = config.decrements as unknown[];
    if (matrix.length !== counts.length) {
      push(
        "decrements",
        `\`decrements\` must be a square ${counts.length}×${counts.length} matrix; got ${matrix.length} rows`,
      );
    }
    matrix.forEach((row, i) => {
      if (!Array.isArray(row)) {
        push(
          `decrements.${i}`,
          `decrements row ${i} must be an array of non-negative integers`,
        );
        return;
      }
      const r = row as unknown[];
      if (r.length !== counts.length) {
        push(
          `decrements.${i}`,
          `decrements row ${i} has length ${r.length}; expected ${counts.length} (matrix must be square)`,
        );
      }
      r.forEach((v, j) => {
        if (!isNonNegativeInteger(v)) {
          push(
            `decrements.${i}.${j}`,
            `decrements[${i}][${j}] must be a non-negative integer, got ${formatValue(v)}`,
          );
          return;
        }
        // Initial-balance check: can't decrement more than the column's
        // starting balls. Mid-dispatch underflow (after multiple picks)
        // is clamped at the dispatcher; this check catches obvious
        // misconfigurations at config-time.
        const colCount = counts[j];
        if (
          isNonNegativeInteger(colCount) &&
          (v as number) > (colCount as number)
        ) {
          push(
            `decrements.${i}.${j}`,
            `decrements[${i}][${j}] = ${v as number} exceeds counts[${j}] = ${colCount as number} — would underflow on the first use of treatment ${i}`,
          );
        }
      });
    });
  }

  return { ok: diagnostics.length === 0, diagnostics };
}

function isNonNegativeInteger(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isFileReference(v: unknown): v is { from: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "from" in v &&
    typeof (v as { from: unknown }).from === "string"
  );
}

function formatValue(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null || v === undefined) return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}

// Re-export the result type from the public DispatcherConfig union so
// hosts have a single import for the discriminator + validator.
export type { DispatcherConfig };
