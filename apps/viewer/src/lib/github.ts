export interface GitHubUrlParts {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  rawFileUrl: string;
  rawBaseUrl: string;
}

/**
 * Parse a GitHub URL into its components and derive raw.githubusercontent.com URLs.
 *
 * Accepts:
 *   https://github.com/{owner}/{repo}/blob/{branch}/{path}
 *   https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
 */
export function parseGitHubUrl(url: string): GitHubUrlParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (parsed.hostname === "raw.githubusercontent.com") {
    // raw URL: /{owner}/{repo}/{branch}/{...filePath}
    if (segments.length < 4) {
      throw new Error(`No file path found in raw URL: ${url}`);
    }
    const owner = segments[0];
    const repo = segments[1];
    const branch = segments[2];
    const filePath = segments.slice(3).join("/");
    return buildResult(owner, repo, branch, filePath, url);
  }

  if (parsed.hostname === "github.com") {
    // blob URL: /{owner}/{repo}/blob/{branch}/{...filePath}
    if (segments.length >= 5 && segments[2] === "blob") {
      const owner = segments[0];
      const repo = segments[1];
      const branch = segments[3];
      const filePath = segments.slice(4).join("/");
      return buildResult(owner, repo, branch, filePath, url);
    }
    throw new Error(
      `Expected a GitHub blob URL (github.com/owner/repo/blob/branch/path): ${url}`,
    );
  }

  throw new Error(`Not a GitHub URL: ${url}`);
}

function buildResult(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  originalUrl: string,
): GitHubUrlParts {
  if (!filePath) {
    throw new Error(`No file path found in URL: ${originalUrl}`);
  }

  const dirPath = filePath.includes("/")
    ? filePath.substring(0, filePath.lastIndexOf("/") + 1)
    : "";

  const rawFileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dirPath}`;

  return { owner, repo, branch, filePath, rawFileUrl, rawBaseUrl };
}
