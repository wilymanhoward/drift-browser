import { expect, it } from 'vitest';
import { cleanTracking, localHost } from '../src/main/privacy';
it('strips only tracking parameters and recognises local hosts', () => {
  expect(
    cleanTracking('https://example.com/?q=hello&utm_source=mail&fbclid=123'),
  ).toBe('https://example.com/?q=hello');
  expect(localHost('localhost')).toBe(true);
  expect(localHost('localhost.evil.com')).toBe(false);
});
