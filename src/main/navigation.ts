export function navigationURL(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 8192
  ) {
    throw new Error('Enter a web address.');
  }
  const input = value.trim();
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
  return url.href;
}

export function isWebURL(value: string): boolean {
  try {
    navigationURL(value);
    return /^https?:/i.test(value);
  } catch {
    return false;
  }
}
