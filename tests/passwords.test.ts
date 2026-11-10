import { expect, it } from 'vitest';
import {
  loginOrigin,
  parsePasswordCommand,
  parseVault,
} from '../src/shared/passwords';
it('keys logins by web origin only', () => {
  expect(loginOrigin('https://accounts.example.com/login?next=/')).toBe(
    'https://accounts.example.com',
  );
  expect(loginOrigin('http://localhost:3000/a')).toBe('http://localhost:3000');
  expect(loginOrigin('file:///C:/a.html')).toBeNull();
  expect(loginOrigin('drift://settings')).toBeNull();
  expect(loginOrigin('not a url')).toBeNull();
});
it('rejects malformed vaults instead of loading them', () => {
  const login = {
    id: 'a',
    origin: 'https://example.com',
    username: 'me',
    password: 'pw',
  };
  expect(parseVault(JSON.stringify([login]))).toEqual([login]);
  expect(() => parseVault('{}')).toThrow();
  expect(() =>
    parseVault(JSON.stringify([{ ...login, origin: 'https://example.com/x' }])),
  ).toThrow();
  expect(() =>
    parseVault(JSON.stringify([{ ...login, password: '' }])),
  ).toThrow();
});
it('accepts only known password commands', () => {
  expect(parsePasswordCommand({ type: 'delete', id: 'a' })).toEqual({
    type: 'delete',
    id: 'a',
  });
  expect(() => parsePasswordCommand({ type: 'reveal', id: 'a' })).toThrow();
  expect(() => parsePasswordCommand({ type: 'delete', id: 1 })).toThrow();
});
