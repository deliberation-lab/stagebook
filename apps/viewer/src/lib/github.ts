export interface GitHubUrlParts {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  rawFileUrl: string;
  rawBaseUrl: string;
}

/**
 * Parse a GitHub blob URL into its components and derive raw.githubusercontent.com URLs.
 *
 * Expects: https://github.com/{owner}/{repo}/blob/{branch}/{path}
 */
export function parseGitHubUrl(url: string): GitHubUrlParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.hostname !== "github.com") {
    throw new Error(`Not a GitHub URL: ${url}`);
  }

  // pathname: /{owner}/{repo}/blob/{branch}/{...filePath}
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < 4 || segments[2] !== "blob") {
    throw new Error(
      `Expected a GitHub blob URL (github.com/owner/repo/blob/branch/path): ${url}`,
    );
  }

  const owner = segments[0];
  const repo = segments[1];
  const branch = segments[3];
  const filePath = segments.slice(4).join("/");

  if (!filePath) {
    throw new Error(`No file path found in URL: ${url}`);
  }

  const dirPath = filePath.includes("/")
    ? filePath.substring(0, filePath.lastIndexOf("/") + 1)
    : "";

  const rawFileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dirPath}`;

  return { owner, repo, branch, filePath, rawFileUrl, rawBaseUrl };
}
