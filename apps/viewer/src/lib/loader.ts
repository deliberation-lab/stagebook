import { parseGitHubUrl } from "./github";
import { parseTreatmentYaml, expandTreatmentFile } from "./treatment";
import type { TreatmentFileType } from "stagebook";

export interface LoadResult {
  treatmentFile: TreatmentFileType;
  unresolvedFields: string[];
  rawBaseUrl: string;
}

type FetchFn = (
  url: string,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/**
 * Load a treatment file from a GitHub URL.
 * Accepts an injectable fetch function for testing.
 */
export async function loadTreatmentFromUrl(
  githubUrl: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<LoadResult> {
  const { rawFileUrl, rawBaseUrl } = parseGitHubUrl(githubUrl);

  const response = await fetchFn(rawFileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch treatment file (HTTP ${response.status}): ${rawFileUrl}`,
    );
  }

  const yaml = await response.text();
  const parsed = parseTreatmentYaml(yaml);
  const { result, unresolvedFields } = expandTreatmentFile(parsed);

  return { treatmentFile: result, unresolvedFields, rawBaseUrl };
}
