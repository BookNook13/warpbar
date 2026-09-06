/**
 * Lightweight fuzzy matcher: returns a score if `query`'s characters
 * appear in order somewhere in `target` (case-insensitive), or null
 * if they don't appear at all. Higher score = better match.
 *
 * Scoring rewards: consecutive character runs, and matches that start
 * right after a word boundary (space, -, _) or at the very start —
 * this is what makes "rd" rank "Restart Docker" above "card reader".
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let score = 0;
  let qIndex = 0;
  let consecutiveRun = 0;
  let prevMatchIndex = -1;

  for (let tIndex = 0; tIndex < t.length && qIndex < q.length; tIndex++) {
    if (t[tIndex] === q[qIndex]) {
      const isWordStart =
        tIndex === 0 || t[tIndex - 1] === " " || t[tIndex - 1] === "-" || t[tIndex - 1] === "_";
      const isConsecutive = prevMatchIndex === tIndex - 1;

      consecutiveRun = isConsecutive ? consecutiveRun + 1 : 1;
      score += 1 + consecutiveRun * 2 + (isWordStart ? 4 : 0);

      prevMatchIndex = tIndex;
      qIndex++;
    }
  }

  // Not every query character was found in order — no match at all.
  if (qIndex < q.length) return null;

  // Slight penalty for longer targets, so shorter/more precise
  // matches rank above long ones that happen to contain the letters.
  return score - t.length * 0.05;
}

export interface FuzzyCandidate {
  title: string;
  subtitle?: string;
  keywords: string[];
}

/**
 * Scores a candidate against a query using its best-matching field —
 * title, subtitle, or any keyword — and returns the highest score,
 * or null if nothing matches at all.
 */
export function fuzzyMatchCandidate(query: string, candidate: FuzzyCandidate): number | null {
  const fields = [candidate.title, candidate.subtitle ?? "", ...candidate.keywords];
  let best: number | null = null;

  for (const field of fields) {
    const score = fuzzyScore(query, field);
    if (score !== null && (best === null || score > best)) {
      best = score;
    }
  }

  return best;
}
