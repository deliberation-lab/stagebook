const DEFAULT_MAX_DISTANCE = 5;

/**
 * Compute the Levenshtein edit distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use a single-row DP approach for O(min(m,n)) space
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  let prev = Array.from({ length: shorter.length + 1 }, (_, i) => i);

  for (let i = 1; i <= longer.length; i++) {
    const curr = [i];
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    prev = curr;
  }

  return prev[shorter.length];
}

/**
 * Find the closest matching string from a list of candidates.
 * Returns null if no candidate has distance strictly less than maxDistance.
 */
export function findClosestMatch(
  target: string,
  candidates: string[],
  maxDistance: number = DEFAULT_MAX_DISTANCE,
): string | null {
  let bestMatch: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const distance = levenshtein(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestDistance < maxDistance ? bestMatch : null;
}
