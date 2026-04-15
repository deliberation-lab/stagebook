import { fillTemplates } from "stagebook";
import { parse, stringify } from "yaml";

const DEFAULT_MAX_LINES = 5000;
const DEFAULT_MAX_BROADCAST = 10000;

export interface ExpandResult {
  /** The expanded YAML string, or "" on error. */
  yaml: string;
  /** Error message if expansion failed, null on success. */
  error: string | null;
  /** Whether the output was truncated due to line limit. */
  truncated: boolean;
}

export interface ExpandOptions {
  maxLines?: number;
  maxBroadcastProduct?: number;
}

/**
 * Walk the parsed object looking for broadcast dimensions and estimate
 * the total Cartesian product size. Returns an error message if it
 * exceeds the limit, or null if it's within bounds.
 */
function checkBroadcastSize(obj: unknown, limit: number): string | null {
  let totalProduct = 0;

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;

    if (
      typeof record.template === "string" &&
      record.broadcast &&
      typeof record.broadcast === "object"
    ) {
      const dims = record.broadcast as Record<string, unknown>;
      let product = 1;
      for (const dim of Object.values(dims)) {
        if (Array.isArray(dim)) product *= dim.length;
      }
      totalProduct += product;
    }

    for (const value of Object.values(record)) {
      walk(value);
    }
  }

  walk(obj);

  if (totalProduct > limit) {
    return `Broadcast expansion would produce ~${totalProduct} items (limit: ${limit}). Reduce broadcast dimensions or increase the limit.`;
  }
  return null;
}

/**
 * Expand all templates in a treatment YAML source string.
 *
 * Returns the fully expanded YAML with the `templates` key removed.
 * This is a pure function — no VS Code dependency.
 */
export function expandTreatmentSource(
  source: string,
  options?: ExpandOptions,
): ExpandResult {
  const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES;

  // Parse YAML
  let obj: unknown;
  try {
    obj = parse(source);
  } catch (e) {
    return {
      yaml: "",
      error: `YAML parse error: ${e instanceof Error ? e.message : String(e)}`,
      truncated: false,
    };
  }

  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return {
      yaml: "",
      error:
        "Treatment file must be a YAML mapping (object), not a scalar or array.",
      truncated: false,
    };
  }

  const record = obj as Record<string, unknown>;

  if (record.templates !== undefined && !Array.isArray(record.templates)) {
    return {
      yaml: "",
      error: "The 'templates' key must be an array.",
      truncated: false,
    };
  }

  const templates = (record.templates ?? []) as unknown[];

  // Guard against combinatorial explosion from large broadcast dimensions.
  // Estimate the total product size before expanding.
  const broadcastLimit = options?.maxBroadcastProduct ?? DEFAULT_MAX_BROADCAST;
  const sizeError = checkBroadcastSize(record, broadcastLimit);
  if (sizeError) {
    return { yaml: "", error: sizeError, truncated: false };
  }

  // Expand templates
  let expanded: Record<string, unknown>;
  try {
    if (templates.length > 0) {
      const { result } = fillTemplates({
        obj: record,
        templates,
        allowUnresolved: true,
      });
      expanded = result as Record<string, unknown>;
    } else {
      expanded = { ...record };
    }
  } catch (e) {
    return {
      yaml: "",
      error: `Template expansion failed: ${e instanceof Error ? e.message : String(e)}`,
      truncated: false,
    };
  }

  // Remove templates key from output
  delete expanded.templates;

  // Serialize back to YAML
  let yaml: string;
  try {
    yaml = stringify(expanded, { indent: 2, lineWidth: 0 });
  } catch (e) {
    return {
      yaml: "",
      error: `YAML serialization failed: ${e instanceof Error ? e.message : String(e)}`,
      truncated: false,
    };
  }

  // Truncate if over the line limit
  const lines = yaml.split("\n");
  if (lines.length > maxLines) {
    const truncatedYaml = lines.slice(0, maxLines).join("\n");
    return {
      yaml:
        truncatedYaml +
        `\n\n# --- Output truncated at ${maxLines} lines (${lines.length} total) ---`,
      error: null,
      truncated: true,
    };
  }

  return { yaml, error: null, truncated: false };
}
