import { parseTreatmentYaml } from "./treatment";
import { expandTreatmentFile } from "./expandTreatmentFile";

export interface ExampleEntry {
  /** Directory name, e.g. "annotated-walkthrough". */
  id: string;
  /** First treatment's `name` after template expansion. */
  title: string;
  /** First treatment's `notes` field (Markdown), if set. */
  notes?: string;
  /** Raw YAML source. */
  yaml: string;
  /** Content of every `*.prompt.md` in the example, keyed by path
   *  relative to the example directory (e.g. `"prompts/consent.prompt.md"`). */
  prompts: Record<string, string>;
}

/**
 * Pure: given an input map of treatment YAML files and a map of
 * `*.prompt.md` files (both keyed by absolute import path, as returned
 * by `import.meta.glob`), build the sorted catalog of examples.
 *
 * Separating this from the glob call keeps it testable without
 * relying on Vite's runtime glob.
 */
export function buildCatalog(
  yamlByPath: Record<string, string>,
  textByPath: Record<string, string>,
): ExampleEntry[] {
  return Object.entries(yamlByPath)
    .map(([path, yaml]) => buildEntry(path, yaml, textByPath))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildEntry(
  path: string,
  yaml: string,
  textByPath: Record<string, string>,
): ExampleEntry {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];
  const id = parts[parts.length - 2];
  const exampleDir = path.substring(0, path.length - fileName.length);

  const parsed = parseTreatmentYaml(yaml);
  const { result } = expandTreatmentFile(parsed);
  const firstTreatment = result.treatments[0] as
    | { name: string; notes?: string }
    | undefined;

  const prompts: Record<string, string> = {};
  for (const [p, content] of Object.entries(textByPath)) {
    if (p.startsWith(exampleDir)) {
      prompts[p.substring(exampleDir.length)] = content;
    }
  }

  return {
    id,
    title: firstTreatment?.name ?? id,
    notes: firstTreatment?.notes,
    yaml,
    prompts,
  };
}

// --- Build-time discovery ------------------------------------------
// `import.meta.glob` inlines every matched file's content at build
// time, so the bundle is only rebuilt when an example is added,
// removed, or edited — not on every build.
const yamlByPath = import.meta.glob(
  "../../../../examples/*/*.treatments.yaml",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const textByPath = import.meta.glob("../../../../examples/**/*.prompt.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const exampleCatalog: ExampleEntry[] = buildCatalog(
  yamlByPath,
  textByPath,
);

/**
 * Build `getTextContent` / `getAssetURL` functions for an example
 * loaded from bundled content (no network).
 */
export function createExampleContentFns(entry: ExampleEntry) {
  return {
    getTextContent(path: string): Promise<string> {
      const content = entry.prompts[path];
      if (content === undefined) {
        return Promise.reject(
          new Error(
            `No bundled content for "${path}" in example "${entry.id}"`,
          ),
        );
      }
      return Promise.resolve(content);
    },
    getAssetURL(path: string): string {
      return path;
    },
  };
}
