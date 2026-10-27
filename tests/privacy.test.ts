import { expect, it } from 'vitest';
import { cleanTracking, thirdParty, localHost } from '../src/main/privacy';
it('strips only tracking parameters and compares registrable schemeful sites', () => {
  expect(
    cleanTracking('https://example.com/?q=hello&utm_source=mail&fbclid=123'),
  ).toBe('https://example.com/?q=hello');
  expect(
    thirdParty('https://cdn.example.co.uk/a', 'https://www.example.co.uk/'),
  ).toBe(false);
  expect(thirdParty('https://evil.co.uk/a', 'https://example.co.uk/')).toBe(
    true,
  );
  expect(thirdParty('http://example.com/a', 'https://example.com/')).toBe(true);
  expect(localHost('localhost')).toBe(true);
  expect(localHost('localhost.evil.com')).toBe(false);
});
