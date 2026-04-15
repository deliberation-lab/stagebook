/**
 * Create getTextContent and getAssetURL functions backed by HTTP fetch
 * from a base URL (e.g., raw.githubusercontent.com).
 *
 * Results are cached so repeated calls for the same path don't re-fetch.
 */
export function createUrlContentFns(rawBaseUrl: string) {
  const cache = new Map<string, Promise<string>>();

  return {
    getTextContent(path: string): Promise<string> {
      const cached = cache.get(path);
      if (cached) return cached;
      const promise = fetch(rawBaseUrl + path)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch ${path} (HTTP ${res.status})`);
          }
          return res.text();
        })
        .catch((err) => {
          cache.delete(path);
          throw err;
        });
      cache.set(path, promise);
      return promise;
    },

    getAssetURL(path: string): string {
      return rawBaseUrl + path;
    },
  };
}
