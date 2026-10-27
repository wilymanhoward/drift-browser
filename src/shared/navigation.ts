export const NEW_TAB_URL = 'drift://newtab/';
export const SETTINGS_URL = 'drift://settings/';
export function navigationURL(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 8192
  ) {
    throw new Error('Enter a web address.');
  }
  const input = value.trim();
  if (input === 'drift://newtab' || input === NEW_TAB_URL) return NEW_TAB_URL;
  if (input === 'drift://settings' || input === SETTINGS_URL)
    return SETTINGS_URL;
  const candidate =
    /^[a-z][a-z\d+.-]*:/i.test(input) && !/^[\w.-]+:\d+(\/|$)/.test(input)
      ? input
      : `https://${input}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Enter a valid web address.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Only HTTP and HTTPS addresses without embedded credentials are supported.',
    );
  }
  if (url.href.length > 8192) throw new Error('This address is too long.');
  return url.href;
}

export function isPageURL(value: string): boolean {
  return value === NEW_TAB_URL || value === SETTINGS_URL || isWebURL(value);
}

export function resolveInput(
  value: unknown,
  template = 'https://www.google.com/search?q={query}',
): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192)
    throw new Error('Enter an address or search term.');
  const input = value.trim();
  if (
    /^[a-z][a-z\d+.-]*:/i.test(input) ||
    /^(localhost|\[[a-f\d:]+\]|[^\s/]+\.[^\s/]+)([:/]|$)/i.test(input)
  )
    return navigationURL(input);
  return navigationURL(template.replace('{query}', encodeURIComponent(input)));
}

export function isWebURL(value: string): boolean {
  try {
    navigationURL(value);
    return /^https?:/i.test(value);
  } catch {
    return false;
  }
}
