import { parseDocument, isMap, isSeq, isScalar } from "yaml";

export interface SourceRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface YamlError {
  line: number;
  col: number;
  message: string;
}

/**
 * Convert a character offset to a 0-based line and column.
 */
function offsetToLineCol(
  source: string,
  offset: number,
): { line: number; col: number } {
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      lastNewline = i;
    }
  }
  return { line, col: offset - lastNewline - 1 };
}

/**
 * Resolve a path to a source range within a pre-parsed YAML document.
 * This is the core AST-walking logic shared by pathToRange and
 * createPositionMapper.
 */
function resolvePathInDoc(
  doc: ReturnType<typeof parseDocument>,
  source: string,
  path: (string | number)[],
): SourceRange | null {
  if (!doc.contents) return null;

  let node = doc.contents;

  for (const segment of path) {
    if (isMap(node) && typeof segment === "string") {
      const pair = node.items.find(
        (p) => isScalar(p.key) && p.key.value === segment,
      );
      if (!pair) return null;
      node = pair.value as typeof node;
    } else if (isSeq(node) && typeof segment === "number") {
      const item = node.items[segment];
      if (!item) return null;
      node = item as typeof node;
    } else {
      return null;
    }
  }

  if (!node || !node.range) return null;

  const [startOffset, endOffset] = node.range;
  const start = offsetToLineCol(source, startOffset);
  const end = offsetToLineCol(source, endOffset);
  return {
    startLine: start.line,
    startCol: start.col,
    endLine: end.line,
    endCol: end.col,
  };
}

/**
 * Given a YAML source string and a path (e.g. from a Zod issue),
 * return the source range of the value node at that path.
 *
 * Returns null if the path cannot be resolved.
 *
 * For resolving many paths against the same document, use
 * createPositionMapper() instead to avoid re-parsing.
 */
export function pathToRange(
  source: string,
  path: (string | number)[],
): SourceRange | null {
  const doc = parseDocument(source, { uniqueKeys: false });
  return resolvePathInDoc(doc, source, path);
}

export interface PositionMapper {
  /** Resolve a path to a source range. Returns null if the path cannot be resolved. */
  resolve(path: (string | number)[]): SourceRange | null;
  /** Get the parsed JS object (for passing to Zod or remapErrorPath). */
  toJSON(): unknown;
}

/**
 * Parse a YAML source string once and return a mapper that can
 * resolve many paths to source ranges without re-parsing.
 *
 * Use this in the validation pipeline where a single document
 * may produce many Zod errors that each need position mapping.
 */
export function createPositionMapper(source: string): PositionMapper {
  const doc = parseDocument(source, { uniqueKeys: false });
  return {
    resolve(path) {
      return resolvePathInDoc(doc, source, path);
    },
    toJSON() {
      return doc.toJSON();
    },
  };
}

/**
 * Extract YAML syntax errors and duplicate key warnings from a source string.
 *
 * Returns structured errors with line positions and messages.
 */
export function extractYamlErrors(source: string): YamlError[] {
  const doc = parseDocument(source, { uniqueKeys: true });
  const errors: YamlError[] = [];

  for (const err of doc.errors) {
    const pos = err.pos?.[0];
    if (pos !== undefined) {
      const { line, col } = offsetToLineCol(source, pos);
      errors.push({ line, col, message: err.message });
    } else {
      errors.push({ line: 0, col: 0, message: err.message });
    }
  }

  for (const warn of doc.warnings) {
    const pos = warn.pos?.[0];
    if (pos !== undefined) {
      const { line, col } = offsetToLineCol(source, pos);
      errors.push({ line, col, message: warn.message });
    } else {
      errors.push({ line: 0, col: 0, message: warn.message });
    }
  }

  return errors;
}

interface TemplateInfo {
  templateName: string;
  templateIndex: number;
  /** Number of items this template expands into (>1 for broadcast). */
  expandedCount: number;
}

/**
 * Check if a plain JS object is a template context (has a `template` string property).
 */
function isTemplateContext(obj: unknown): obj is { template: string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    Object.hasOwn(obj, "template") &&
    typeof (obj as Record<string, unknown>).template === "string"
  );
}

/**
 * Count how many items a template context expands into.
 * Without broadcast: 1. With broadcast: product of all dimension lengths.
 */
function countExpandedItems(context: Record<string, unknown>): number {
  const broadcast = context.broadcast;
  if (!broadcast || typeof broadcast !== "object" || Array.isArray(broadcast)) {
    return 1;
  }
  let count = 1;
  for (const dim of Object.values(broadcast as Record<string, unknown>)) {
    if (Array.isArray(dim)) {
      count *= dim.length;
    }
  }
  return Math.max(count, 1);
}

/**
 * Given a Zod error path (relative to the expanded/validated object),
 * remap it to point to the original YAML source location.
 *
 * If the path goes through an expanded template context, the returned
 * path points into the template definition instead (e.g.
 * `["templates", 0, "templateContent", "elements", 0, "file"]`).
 *
 * If no remapping is needed, returns the original path unchanged.
 */
export function remapErrorPath(
  errorPath: (string | number)[],
  originalObj: Record<string, unknown>,
  templates: { templateName: string }[],
): (string | number)[] {
  const path = [...errorPath];
  let current: unknown = originalObj;
  const consumed: (string | number)[] = [];

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];

    if (Array.isArray(current) && typeof segment === "number") {
      // Walk the original array, accounting for template expansions
      // that may have shifted indices.
      let expandedIndex = 0;
      for (let origIdx = 0; origIdx < current.length; origIdx++) {
        const item = current[origIdx];

        if (isTemplateContext(item)) {
          const info = resolveTemplate(item, templates);
          if (!info) {
            // Template not found — can't remap, treat as opaque
            expandedIndex += 1;
            if (expandedIndex > segment) {
              break;
            }
            continue;
          }

          const expandedCount = countExpandedItems(
            item as Record<string, unknown>,
          );

          if (
            segment >= expandedIndex &&
            segment < expandedIndex + expandedCount
          ) {
            // This expanded index came from this template
            const remaining = path.slice(i + 1);
            return [
              "templates",
              info.templateIndex,
              "templateContent",
              ...remaining,
            ];
          }

          expandedIndex += expandedCount;
        } else {
          if (expandedIndex === segment) {
            // Found the matching non-template item
            current = item;
            consumed.push(segment);
            break;
          }
          expandedIndex += 1;
        }
      }

      if (consumed[consumed.length - 1] !== segment) {
        // We didn't find a match — return original path
        return errorPath;
      }
    } else if (
      typeof current === "object" &&
      current !== null &&
      !Array.isArray(current) &&
      typeof segment === "string"
    ) {
      if (!Object.hasOwn(current, segment)) return errorPath;
      current = (current as Record<string, unknown>)[segment];
      consumed.push(segment);
    } else {
      // Can't walk further — return original path
      return errorPath;
    }
  }

  return errorPath;
}

function resolveTemplate(
  context: { template: string },
  templates: { templateName: string }[],
): TemplateInfo | null {
  const idx = templates.findIndex((t) => t.templateName === context.template);
  if (idx === -1) return null;
  return {
    templateName: context.template,
    templateIndex: idx,
    expandedCount: countExpandedItems(
      context as unknown as Record<string, unknown>,
    ),
  };
}
