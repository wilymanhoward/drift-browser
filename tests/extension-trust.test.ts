import { expect, it } from 'vitest';
import {
  grantedPermissions,
  optionalPermissions,
  trustedInstallFrame,
} from '../src/shared/extensions';

it('lets only the Web Store’s own top-level page start an install', () => {
  expect(
    trustedInstallFrame({ url: 'https://chromewebstore.google.com/detail/x' }),
  ).toBe(true);
  for (const url of [
    'https://chromewebstore.google.com.evil.example/detail/x',
    'https://chromewebstore.google.com:8443/detail/x',
    'http://chromewebstore.google.com/detail/x',
    'not a url',
  ])
    expect(trustedInstallFrame({ url })).toBe(false);
  expect(
    trustedInstallFrame({
      url: 'https://chromewebstore.google.com/detail/x',
      parent: {},
    }),
  ).toBe(false);
  // Imports from another browser have no page behind them.
  expect(trustedInstallFrame(undefined)).toBe(true);
});

it('counts content-script pages as access the user must approve', () => {
  const manifest = {
    permissions: ['storage', 'tabs'],
    host_permissions: ['https://example.com/*'],
    optional_permissions: ['downloads'],
    content_scripts: [
      { matches: ['<all_urls>'] },
      { matches: ['https://example.com/*'] },
      null,
    ],
  };
  expect(grantedPermissions(manifest)).toEqual([
    '<all_urls>',
    'https://example.com/*',
    'storage',
    'tabs',
  ]);
  expect(optionalPermissions(manifest)).toEqual(['downloads']);
  expect(grantedPermissions({ permissions: 'storage' })).toEqual([]);
});
