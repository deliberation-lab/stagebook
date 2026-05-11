import {
  fillTemplates,
  parseTreatmentYaml as parseStagebookYaml,
  resolveImportPath,
  resolveImports,
  treatmentFileSchema,
  type ParsedFile,
  type TreatmentFile,
} from "stagebook";

/**
 * Stage at which parsing/expanding/validating failed.
 *
 * - `parse`         — root YAML parse failed
 * - `import-read`   — an imported file couldn't be read by `loadImport`
 * - `import-parse`  — an imported file's YAML parse failed
 * - `resolve`       — `resolveImports` threw while merging templates
 * - `hydration`     — `fillTemplates` threw (most commonly: template name
 *                     not defined in this file or its imports)
 * - `schema`        — the hydrated form failed schema validation
 */
export type ParseFailureStage =
  | "parse"
  | "import-read"
  | "import-parse"
  | "resolve"
  | "hydration"
  | "schema";

export type ParseResult =
  | { ok: true; data: TreatmentFile }
  | { ok: false; stage: ParseFailureStage; message: string };

/**
 * Host-agnostic core of the treatment-file preview pipeline. Parses the
 * root source, loads its imports (transitively), merges them, runs
 * `fillTemplates`, and validates against `treatmentFileSchema`.
 *
 * Each failure mode returns `{ ok: false, stage, message }` rather than
 * a null/undefined so callers can surface specific text instead of a
 * generic "could not parse" notification. This replaces the previous
 * behavior of `parseTreatmentForPreview` in extension.ts which silently
 * swallowed every error — the root cause of #321 Repro 1.
 *
 * `loadImport` is the host's bridge to its filesystem. In VS Code it
 * wraps `vscode.workspace.fs.readFile`; in tests it's a Map-based mock.
 * Throw or reject on failure; the caller will tag it as `import-read`.
 *
 * See #321 for the broader validation pipeline this is part of.
 */
export async function parseTreatmentSource({
  source,
  loadImport,
}: {
  source: string;
  loadImport: (importPath: string) => Promise<string>;
}): Promise<ParseResult> {
  let rootParse: ReturnType<typeof parseStagebookYaml>;
  try {
    rootParse = parseStagebookYaml(source);
  } catch (e) {
    return {
      ok: false,
      stage: "parse",
      message: `YAML parse error: ${errorMessage(e)}`,
    };
  }
  const root = rootParse.parsed as ParsedFile;

  // The root file's own path is the parent for resolving its imports.
  // Using a fictional `root.stagebook.yaml` here gives the right relative
  // behavior because `resolveImportPath` only uses the parent's directory.
  const loaded = new Map<string, ParsedFile>();
  const queue: string[] = rootParse.imports.map((p) =>
    resolveImportPath("root.stagebook.yaml", p),
  );
  while (queue.length > 0) {
    const importPath = queue.shift()!;
    if (loaded.has(importPath)) continue;
    let contents: string;
    try {
      contents = await loadImport(importPath);
    } catch (e) {
      return {
        ok: false,
        stage: "import-read",
        message: `Could not read import file '${importPath}': ${errorMessage(e)}`,
      };
    }
    let importedParse: ReturnType<typeof parseStagebookYaml>;
    try {
      importedParse = parseStagebookYaml(contents);
    } catch (e) {
      return {
        ok: false,
        stage: "import-parse",
        message: `YAML parse error in import '${importPath}': ${errorMessage(e)}`,
      };
    }
    loaded.set(importPath, importedParse.parsed as ParsedFile);
    for (const next of importedParse.imports) {
      queue.push(resolveImportPath(importPath, next));
    }
  }

  let mergedTemplates: unknown[];
  try {
    mergedTemplates = resolveImports({ main: root, files: loaded });
  } catch (e) {
    return {
      ok: false,
      stage: "resolve",
      message: `Could not merge imports: ${errorMessage(e)}`,
    };
  }

  // Strip `imports:` from the root and replace `templates:` with the merged
  // set. Re-attach `templates:` whenever the root explicitly had it, even
  // if the merged array is empty — preserves the schema's rejection of
  // `templates: []` in the root (an authoring error that would otherwise
  // be silently masked by stripping the key).
  const rootHadTemplates = "templates" in root;
  const { imports: _imports, templates: _origTemplates, ...rest } = root;
  void _imports;
  void _origTemplates;
  const merged: Record<string, unknown> = { ...rest };
  if (mergedTemplates.length > 0 || rootHadTemplates) {
    merged.templates = mergedTemplates;
  }

  // Always pass through fillTemplates, even when there are zero templates,
  // so unresolved `template:` invocations always surface as a real
  // "Template not found" error. (Per #321 Repro 2: the previous
  // `templates.length > 0` gate let invocations silently pass through.)
  let expanded: Record<string, unknown>;
  try {
    const { result } = fillTemplates({
      obj: merged,
      templates: mergedTemplates,
      allowUnresolved: true,
    });
    expanded = result as Record<string, unknown>;
  } catch (e) {
    return {
      ok: false,
      stage: "hydration",
      message: `Template expansion failed: ${errorMessage(e)}`,
    };
  }

  const parsed = treatmentFileSchema.safeParse(expanded);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue
      ? `Schema validation failed at ${formatPath(firstIssue.path)}: ${firstIssue.message}`
      : "Schema validation failed";
    return { ok: false, stage: "schema", message };
  }
  return { ok: true, data: parsed.data };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatPath(p: (string | number)[]): string {
  if (p.length === 0) return "(root)";
  return p
    .map((seg) => (typeof seg === "number" ? `[${seg}]` : seg))
    .join(".")
    .replace(/\.\[/g, "[");
}
