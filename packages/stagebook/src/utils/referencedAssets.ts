// Which element types have file-like fields, and which fields they are.
// This table is the single source of truth for "what counts as a local asset
// reference" — callers (VS Code extension file-existence checks, annotator
// manifest freezes, docs/CI tooling) depend on it instead of hard-coding
// field names like `file`.
//
// Order within each entry is the "field-declaration order" used to order
// results within a single element.
const FILE_FIELDS_BY_ELEMENT_TYPE: Record<string, readonly string[]> = {
  prompt: ["file"],
  image: ["file"],
  audio: ["file"],
  mediaPlayer: ["url", "captionsFile"],
  // timeline.source is a name reference to another element, not a file path
  timeline: [],
};

const PLACEHOLDER_PATTERN = /\$\{[^}]*\}/;
const FULL_URL_PATTERN = /^(?:https?:)?\/\//i;

export interface ReferencedAsset {
  /** The raw path as it appears in the treatment YAML. */
  path: string;
  /** Which field the path came from (e.g. "file", "captionsFile", "url"). */
  field: string;
  /** The element type ("prompt", "mediaPlayer", "image", "audio", …). */
  elementType: string;
  /** Element name if the element has one. */
  elementName?: string;
  /** Location of the element in the parsed object, useful for source mapping. */
  pathInTree: (string | number)[];
}

function isCollectableLocalPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0) return false;
  if (PLACEHOLDER_PATTERN.test(value)) return false;
  if (FULL_URL_PATTERN.test(value)) return false;
  return true;
}

/**
 * Walk a parsed treatment file and return every local-asset path it
 * references, per the per-element-type allowlist above.
 *
 * Accepts `unknown` because callers typically pass the raw result of
 * parsing YAML — before schema validation — so that the asset list is
 * available even if the treatment doesn't yet validate. Non-object input
 * yields `[]`.
 *
 * Excludes template-placeholder paths (`${…}`), full URLs (`http://…`,
 * `https://…`, `//…`), and empty strings. Order is stable tree-walk order
 * (outer-to-inner, then insertion order within each object), with
 * field-declaration order from the table above within a single element.
 */
export function getReferencedAssets(treatmentFile: unknown): ReferencedAsset[] {
  const results: ReferencedAsset[] = [];
  walk(treatmentFile, [], results);
  return results;
}

function walk(
  node: unknown,
  path: (string | number)[],
  acc: ReferencedAsset[],
): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      walk(item, [...path, i], acc);
    });
    return;
  }

  if (node === null || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const type = record.type;

  if (typeof type === "string" && type in FILE_FIELDS_BY_ELEMENT_TYPE) {
    const fields = FILE_FIELDS_BY_ELEMENT_TYPE[type];
    for (const field of fields) {
      const value = record[field];
      if (isCollectableLocalPath(value)) {
        const asset: ReferencedAsset = {
          path: value,
          field,
          elementType: type,
          pathInTree: [...path],
        };
        if (typeof record.name === "string") {
          asset.elementName = record.name;
        }
        acc.push(asset);
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    walk(value, [...path, key], acc);
  }
}
