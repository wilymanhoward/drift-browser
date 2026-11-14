import { describe, expect, it } from 'vitest';
import { isWebURL, navigationURL } from '../src/shared/navigation';

describe('navigation trust boundary', () => {
  it('normalizes domains and preserves web addresses', () => {
    expect(navigationURL(' example.com/path ')).toBe(
      'https://example.com/path',
    );
    expect(navigationURL('http://localhost:3210/test')).toBe(
      'http://localhost:3210/test',
    );
    expect(navigationURL('localhost:3210/test')).toBe(
      'http://localhost:3210/test',
    );
    expect(navigationURL('127.0.0.1:8080')).toBe('http://127.0.0.1:8080/');
    expect(navigationURL('app.localhost')).toBe('http://app.localhost/');
    expect(navigationURL('localhost.example.com')).toBe(
      'https://localhost.example.com/',
    );
  });
  it.each([
    '',
    ' ',
    'javascript:alert(1)',
    'file:///C:/secret',
    'data:text/html,test',
    'drift://unknown',
    'https://user:pass@example.com',
    {},
    null,
    'a'.repeat(8193),
  ])('rejects unsafe or malformed input %s', (value) => {
    expect(() => navigationURL(value)).toThrow();
  });
  it('requires explicit web protocols on page-initiated navigation', () => {
    expect(isWebURL('https://example.com')).toBe(true);
    expect(isWebURL('example.com')).toBe(false);
    expect(isWebURL('mailto:user@example.com')).toBe(false);
  });
});

describe('app links', () => {
  it('sends only other-app schemes to the open-in-app prompt', async () => {
    const { isAppURL } = await import('../src/shared/navigation');
    for (const url of [
      'mailto:a@b.c',
      'zoommtg://zoom.us/join',
      'msteams:/l/x',
      'tel:+1555',
    ])
      expect(isAppURL(url)).toBe(true);
    for (const url of [
      'https://a.com',
      'file:///C:/x',
      'javascript:alert(1)',
      'drift://newtab/',
      'ms-settings:',
      'search-ms:q',
      'not a url',
    ])
      expect(isAppURL(url)).toBe(false);
  });
});

describe('local PDF files', () => {
  it('opens PDFs from this computer and nothing else local', async () => {
    const { isLocalPDF, isPageURL } = await import('../src/shared/navigation');
    const { externalLink } = await import('../src/shared/external-links');
    expect(navigationURL(String.raw`C:\Users\me\My Report.pdf`)).toBe(
      'file:///C:/Users/me/My%20Report.pdf',
    );
    expect(navigationURL('file:///C:/a/b.PDF#page=2')).toBe(
      'file:///C:/a/b.PDF#page=2',
    );
    expect(isLocalPDF('file:///C:/a/b.pdf')).toBe(true);
    expect(isPageURL('file:///C:/a/b.pdf')).toBe(true);
    for (const bad of [
      'file:///C:/a/b.txt',
      String.raw`C:\Windows\win.ini`,
      'file:///C:/a/',
    ])
      expect(() => navigationURL(bad)).toThrow();
    expect(isLocalPDF('file:///C:/a/b.html')).toBe(false);
    expect(isWebURL('file:///C:/a/b.pdf')).toBe(false);
    expect(externalLink(['Drift.exe', '--', String.raw`D:\Docs\x.pdf`])).toBe(
      'file:///D:/Docs/x.pdf',
    );
    expect(
      externalLink(['Drift.exe', '--', String.raw`D:\Docs\x.exe`]),
    ).toBeUndefined();
  });
});
