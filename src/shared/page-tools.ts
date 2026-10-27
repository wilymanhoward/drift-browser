export interface FindState {
  query: string;
  matches: number;
  active: number;
}
export type FindCommand =
  | { type: 'query'; query: string }
  | { type: 'next'; forward: boolean }
  | { type: 'close' };
export function parseFind(value: unknown): FindCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid find command');
  const v = value as Record<string, unknown>;
  const allowed =
    v.type === 'query'
      ? ['type', 'query']
      : v.type === 'next'
        ? ['type', 'forward']
        : ['type'];
  if (
    Object.keys(v).some((k) => !allowed.includes(k)) ||
    !['query', 'next', 'close'].includes(String(v.type)) ||
    (v.type === 'query' &&
      (typeof v.query !== 'string' || v.query.length > 1024)) ||
    (v.type === 'next' && typeof v.forward !== 'boolean')
  )
    throw new Error('Invalid find command');
  return v as FindCommand;
}
export const PAGE_ACTIONS = [
  'find',
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'print',
  'fullscreen',
] as const;
export type PageAction = (typeof PAGE_ACTIONS)[number];
export function zoomOrigin(url: string) {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}
export function parseZoom(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid zoom preferences');
  const result: Record<string, number> = {};
  for (const [origin, factor] of Object.entries(value)) {
    if (
      zoomOrigin(origin) !== origin ||
      typeof factor !== 'number' ||
      !Number.isFinite(factor) ||
      factor < 0.25 ||
      factor > 3
    )
      throw new Error('Invalid zoom preference');
    result[origin] = factor;
  }
  if (Object.keys(result).length > 2000)
    throw new Error('Too many zoom preferences');
  return result;
}
