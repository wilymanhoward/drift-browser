// Google's sign-in page refuses embedded browsers ("This browser or app may
// not be secure"). Chromium-based Electron trips that check even with a clean
// Chrome user agent, so accounts.google.com alone sees Drift as Firefox: a
// Firefox UA and no Chromium client hints. Every other site keeps Chrome's UA,
// which the Chrome Web Store and extensions rely on.

const SIGN_IN_HOSTS = new Set(['accounts.google.com']);

export function isGoogleSignIn(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && SIGN_IN_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// Firefox ships every four weeks; 128 shipped on 2024-07-09. One version of
// slack keeps the UA from claiming a release that is not out yet.
export function firefoxVersion(now = Date.now()): number {
  const base = Date.UTC(2024, 6, 9);
  const weeks4 = 28 * 86400000;
  return Math.max(128, 128 + Math.floor((now - base) / weeks4) - 1);
}

export function firefoxUserAgent(
  platform: string = process.platform,
  now = Date.now(),
): string {
  const os =
    platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10.15'
        : 'X11; Linux x86_64';
  const v = firefoxVersion(now);
  return `Mozilla/5.0 (${os}; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`;
}

// Firefox sends no Sec-CH-UA headers; Chromium's would contradict the UA.
export function signInHeaders(
  headers: Record<string, string>,
  userAgent: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'user-agent' || lower.startsWith('sec-ch-ua')) continue;
    next[key] = value;
  }
  next['User-Agent'] = userAgent;
  return next;
}

export function cleanChromeUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s(?:Drift|Electron|drift-browser)\/[^ ]+/g, '')
    .replace(/Chrome\/(\d+)\.[\d.]+/, 'Chrome/$1.0.0.0');
}
