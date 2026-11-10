export interface SavedLogin {
  id: string;
  origin: string;
  username: string;
  password: string;
}
export interface PasswordList {
  logins: { id: string; origin: string; username: string }[];
  never: string[];
  error: string | null;
}
export type PasswordCommand =
  | { type: 'list' }
  | { type: 'delete'; id: string }
  | { type: 'allow'; origin: string };

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

// Logins are keyed by the page's origin, so http and https never share one.
export function loginOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.origin : null;
  } catch {
    return null;
  }
}
export function parseVault(json: string): SavedLogin[] {
  const value: unknown = JSON.parse(json);
  if (
    !Array.isArray(value) ||
    !value.every(
      (item: Partial<SavedLogin>) =>
        item &&
        text(item.id, 64) &&
        text(item.origin, 2048) &&
        loginOrigin(item.origin) === item.origin &&
        text(item.username, 1024) &&
        text(item.password, 1024) &&
        item.password !== '',
    )
  )
    throw new Error('Invalid password vault');
  return value as SavedLogin[];
}
export function parsePasswordCommand(value: unknown): PasswordCommand {
  const v = value as Partial<{ type: string; id: unknown; origin: unknown }>;
  if (v?.type === 'list') return { type: 'list' };
  if (v?.type === 'delete' && text(v.id, 64))
    return { type: 'delete', id: v.id };
  if (v?.type === 'allow' && text(v.origin, 2048))
    return { type: 'allow', origin: v.origin };
  throw new Error('Invalid password command');
}
