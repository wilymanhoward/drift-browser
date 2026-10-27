import { it, expect } from 'vitest';
import { parseFind, parseZoom, zoomOrigin } from '../src/shared/page-tools';
it('bounds find commands and per-origin zoom preferences', () => {
  expect(parseFind({ type: 'query', query: 'needle' })).toEqual({
    type: 'query',
    query: 'needle',
  });
  for (const v of [
    { type: 'query', query: 'x'.repeat(1025) },
    { type: 'next', forward: 1 },
    { type: 'close', url: 'file:///secret' },
  ])
    expect(() => parseFind(v)).toThrow();
  expect(parseZoom({ 'https://example.com': 1.2 })).toEqual({
    'https://example.com': 1.2,
  });
  for (const v of [
    null,
    [],
    { 'https://example.com/path': 1 },
    { 'file:///secret': 1 },
    { 'https://example.com': NaN },
    { 'https://example.com': 0.1 },
  ])
    expect(() => parseZoom(v)).toThrow();
  expect(zoomOrigin('drift://settings/')).toBeNull();
});
