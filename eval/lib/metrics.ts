/**
 * Retrieval metrics. Citation, attribution and persona checks join them with the answer
 * pipeline (Phase 3).
 */

export function recallAt(k: number, retrievedEpisodeGuids: string[], expected: string[]): boolean {
  return retrievedEpisodeGuids.slice(0, k).some((g) => expected.includes(g));
}

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};
