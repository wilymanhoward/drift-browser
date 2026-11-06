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
