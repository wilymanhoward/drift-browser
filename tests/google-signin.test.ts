import { describe, expect, it } from 'vitest';
import {
  cleanChromeUserAgent,
  firefoxUserAgent,
  firefoxVersion,
  isGoogleSignIn,
  signInHeaders,
} from '../src/shared/google-signin';

describe('Google sign-in compatibility', () => {
  it('matches only the Google accounts host over HTTPS', () => {
    expect(isGoogleSignIn('https://accounts.google.com/v3/signin')).toBe(true);
    expect(isGoogleSignIn('http://accounts.google.com/')).toBe(false);
    expect(isGoogleSignIn('https://mail.google.com/')).toBe(false);
    expect(isGoogleSignIn('https://chromewebstore.google.com/')).toBe(false);
    expect(isGoogleSignIn('https://accounts.google.com.evil.test/')).toBe(false);
    expect(isGoogleSignIn('not a url')).toBe(false);
  });
  it('tracks the Firefox release train', () => {
    expect(firefoxVersion(Date.UTC(2024, 6, 9))).toBe(128);
    expect(firefoxVersion(Date.UTC(2026, 10, 1))).toBeGreaterThan(150);
    expect(firefoxUserAgent('win32', Date.UTC(2026, 10, 1))).toMatch(
      /^Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64; rv:(\d+)\.0\) Gecko\/20100101 Firefox\/\1\.0$/,
    );
  });
  it('drops Chromium client hints and replaces the UA', () => {
    const out = signInHeaders(
      {
        'user-agent': 'Chrome',
        'sec-ch-ua': '"Chromium";v="140"',
        'Sec-CH-UA-Platform': '"Windows"',
        'sec-ch-ua-mobile': '?0',
        Accept: 'text/html',
      },
      'Firefox',
    );
    expect(out).toEqual({ Accept: 'text/html', 'User-Agent': 'Firefox' });
  });
  it('removes Electron and Drift tokens from the Chrome UA', () => {
    expect(
      cleanChromeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Drift/0.1.0 Chrome/140.0.7339.41 Electron/45.0.0 Safari/537.36',
      ),
    ).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    );
  });
});
