import { parseGitHubUrl } from "./github";
import { expandTreatmentFile } from "./expandTreatmentFile";
import { safeParseTreatmentFile, type TreatmentFileType } from "stagebook";
import {
  loadAndMergeImports,
  validateTreatmentSource,
  checkPromptLocaleConsistencyWithLoader,
} from "stagebook/validate";
import type { ViewerDiagnostic } from "./diagnostics";

export interface LoadResult {
  /**
   * The parsed + expanded treatment file, or `null` when the file has errors
   * that prevent it from rendering (YAML syntax, schema violations). When
   * null, `diagnostics` explains why and the caller shows a placeholder.
   */
  treatmentFile: TreatmentFileType | null;
  /**
   * Validation diagnostics — the same rich, positioned diagnostics the VS Code
   * extension shows in its Problems panel (schema errors + duplicate-key
   * warnings, positioned against the entry file), plus prompt
   * locale-consistency errors. Empty for a clean file. Present even when
   * `treatmentFile` is set (warnings don't block rendering).
   */
  diagnostics: ViewerDiagnostic[];
  unresolvedFields: string[];
  rawBaseUrl: string;
}

type FetchFn = (
  url: string,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/**
 * Load a treatment file from a GitHub URL, resolving any `imports:`
 * against the same repo and branch as the entry-point file (#312), and
 * surfacing schema/warning diagnostics on load (#440).
 *
 * Validation is non-fatal: a file with only warnings still renders (its
 * warnings ride along in `diagnostics`); a file with errors returns a null
 * `treatmentFile` plus the positioned diagnostics that explain why. Network
 * failures (unreachable root, unreadable import) still throw — those aren't
 * file-content diagnostics.
 *
 * Diagnostics come from `validateTreatmentSource` over the entry file's raw
 * source, so positions land in the file the author is editing and the messages
 * match the VS Code extension's Problems panel. Rendering is driven off the
 * imports-merged, template-expanded object, so a file can be simultaneously
 * renderable and carry warnings.
 *
 * Accepts an injectable fetch function for testing.
 */
export async function loadTreatmentFromUrl(
  githubUrl: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<LoadResult> {
  const { rawFileUrl, rawBaseUrl, filePath } = parseGitHubUrl(githubUrl);

  // Cache-bust: raw.githubusercontent.com has aggressive CDN caching
  const bustUrl = `${rawFileUrl}?t=${Date.now()}`;
  const response = await fetchFn(bustUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch treatment file (HTTP ${response.status}): ${rawFileUrl}`,
    );
  }

  const rootYaml = await response.text();

  // Fetch each `imports:` from the same repo + branch as the entry-point
  // file. `canonicalPath` is POSIX-normalized (e.g. `modules/foo.stagebook.yaml`),
  // and `rawBaseUrl` already has a trailing slash, so concatenation produces
  // a valid raw.githubusercontent.com URL.
  const loadImport = async (canonicalPath: string): Promise<string> => {
    const importUrl = `${rawBaseUrl}${canonicalPath}?t=${Date.now()}`;
    const importResponse = await fetchFn(importUrl);
    if (!importResponse.ok) {
      throw new Error(
        `Failed to fetch imported file '${canonicalPath}' (HTTP ${importResponse.status}) — ` +
          `make sure the file exists in the same repo as the entry-point file. ` +
          `Tried: ${rawBaseUrl}${canonicalPath}`,
      );
    }
    return importResponse.text();
  };

  // Rich, positioned diagnostics against the entry file's raw source — the same
  // messages/positions the VS Code extension surfaces (#440). Tagged with the
  // entry file's display path so the panel can attribute each one.
  const diagnostics: ViewerDiagnostic[] = validateTreatmentSource(
    rootYaml,
  ).diagnostics.map((d) => ({ ...d, file: filePath }));

  // `loadAndMergeImports` parses the root YAML, recursively fetches every
  // imported file via `loadImport`, and returns the merged object (`imports:`
  // stripped, `templates:` merged). We drive rendering off this path.
  const loadResult = await loadAndMergeImports({
    source: rootYaml,
    loadImport,
  });
  if (!loadResult.ok) {
    if (loadResult.stage === "parse") {
      // Root YAML couldn't be parsed (syntax error, duplicate key). Nothing
      // renders; `diagnostics` already carries the positioned reason. Fall back
      // to the raw message only if the validator produced nothing.
      return {
        treatmentFile: null,
        diagnostics: diagnostics.length
          ? diagnostics
          : [
              {
                message: loadResult.message,
                severity: "error",
                range: null,
                file: filePath,
              },
            ],
        unresolvedFields: [],
        rawBaseUrl,
      };
    }
    // Import fetch / parse / merge failure — a network/structural problem the
    // author resolves outside this file. Surface as a hard error (unchanged).
    throw new Error(loadResult.message);
  }

  // Build the render object from the merged (imports-resolved) source.
  const parsed = safeParseTreatmentFile(loadResult.merged);
  if (!parsed.success) {
    // The merged object failed schema validation. Usually the raw-source
    // diagnostics already explain it (positioned); but when the offending
    // value lives inside an imported template, raw validation sees nothing —
    // fall back to the merged object's schema issues (unpositioned) so the
    // placeholder is never blank.
    if (!diagnostics.some((d) => d.severity === "error")) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "(root)";
        diagnostics.push({
          message: `${issue.message} (${path})`,
          severity: "error",
          range: null,
          file: filePath,
        });
      }
    }
    return {
      treatmentFile: null,
      diagnostics,
      unresolvedFields: [],
      rawBaseUrl,
    };
  }

  const { result, unresolvedFields } = expandTreatmentFile(parsed.data);

  // Post-hydration locale-consistency rule (ADR 2026-06-localization #6):
  // every referenced prompt's frontmatter `locale` must match its container's
  // `locale` (both default `en`). Runs on the hydrated tree, fetching each
  // prompt's frontmatter from the same repo + branch as the entry-point file.
  // Surfaced as diagnostics tagged with each prompt's own path. Unreadable /
  // unparseable prompts return null and are skipped — those failures surface
  // elsewhere. A mismatch doesn't block rendering, so the preview still shows.
  const loadPrompt = async (relPath: string): Promise<string | null> => {
    const promptResponse = await fetchFn(
      `${rawBaseUrl}${relPath}?t=${Date.now()}`,
    );
    return promptResponse.ok ? promptResponse.text() : null;
  };
  const localeMismatches = await checkPromptLocaleConsistencyWithLoader({
    fileObj: result,
    loadPrompt,
  });
  for (const mismatch of localeMismatches) {
    diagnostics.push({
      message: mismatch.message,
      severity: "error",
      range: null,
      file: mismatch.promptFile,
    });
  }

  return { treatmentFile: result, diagnostics, unresolvedFields, rawBaseUrl };
}
