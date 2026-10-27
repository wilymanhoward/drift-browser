export interface SearchEntry {
  id: string;
  kind: 'tab' | 'bookmark' | 'history' | 'command';
  title: string;
  url: string;
}
export function fuzzyScore(query: string, text: string): number {
  const needle = query.trim().toLowerCase();
  const haystack = text.toLowerCase();
  if (!needle) return 1;
  if (haystack === needle) return 1000;
  const substring = haystack.indexOf(needle);
  if (substring >= 0) return 500 - Math.min(substring, 399);
  let position = -1;
  let gaps = 0;
  for (const char of needle) {
    const next = haystack.indexOf(char, position + 1);
    if (next < 0) return -1;
    gaps += next - position - 1;
    position = next;
  }
  return Math.max(0, 100 - gaps);
}
export function searchEntries(
  entries: SearchEntry[],
  query: string,
): SearchEntry[] {
  return entries
    .map((entry, index) => ({
      entry,
      index,
      score: fuzzyScore(query, `${entry.title} ${entry.url}`),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 12)
    .map((item) => item.entry);
}
