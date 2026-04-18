import { expandTreatmentSource, type ExpandOptions } from "./expandTreatment";
import { validateTreatmentSource } from "./validateTreatment";
import type { Diagnostic } from "./types";

export interface ExpandAndValidateResult {
  /** The expanded YAML as displayed (possibly truncated). "" if expansion failed. */
  yaml: string;
  /** Whether the displayed YAML was truncated for size. */
  truncated: boolean;
  /** Expansion error message (e.g. YAML parse, missing template). null on success. */
  expandError: string | null;
  /**
   * Schema validation diagnostics, with line/column positions referring to
   * the full (untruncated) expanded YAML. Empty when expansion failed.
   */
  diagnostics: Diagnostic[];
}

/**
 * Expand templates in a treatment YAML source and validate the expanded
 * result against the treatment file schema.
 *
 * Validation runs on the full (untruncated) expansion so that errors past
 * the display truncation point are still surfaced. Diagnostic positions
 * reference the full expanded YAML string.
 *
 * This is a pure function — no VS Code dependency. The caller is responsible
 * for converting `diagnostics` into `vscode.Diagnostic` objects and attaching
 * them to the expanded preview document's URI.
 */
export function expandAndValidate(
  source: string,
  options?: ExpandOptions,
): ExpandAndValidateResult {
  const expanded = expandTreatmentSource(source, options);

  if (expanded.error) {
    return {
      yaml: expanded.yaml,
      truncated: expanded.truncated,
      expandError: expanded.error,
      diagnostics: [],
    };
  }

  const { diagnostics } = validateTreatmentSource(expanded.fullYaml);

  return {
    yaml: expanded.yaml,
    truncated: expanded.truncated,
    expandError: null,
    diagnostics,
  };
}
