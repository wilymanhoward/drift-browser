import { expect, it } from 'vitest';
import { pairedSidebar } from '../src/main/window-layout';

const left = { x: 0, y: 0, width: 900, height: 1000 };
const right = { ...left, x: 900 };
it('places adjacent sidebars at the outside edges', () => {
  expect(pairedSidebar(left, [right])).toBe('left');
  expect(pairedSidebar(right, [left])).toBe('right');
  expect(pairedSidebar({ ...right, x: 892 }, [left])).toBe('right');
  expect(pairedSidebar({ ...right, x: 916, y: 60 }, [left])).toBe('right');
  expect(pairedSidebar({ ...right, x: -900 }, [{ ...left, x: -1800 }])).toBe(
    'right',
  );
});
it('leaves solitary, overlapping, separated and stacked windows alone', () => {
  expect(pairedSidebar(left, [])).toBeUndefined();
  expect(pairedSidebar(left, [left])).toBeUndefined();
  expect(pairedSidebar(left, [{ ...right, x: 500 }])).toBeUndefined();
  expect(pairedSidebar(left, [{ ...right, x: 1100 }])).toBeUndefined();
  expect(pairedSidebar(left, [{ ...right, y: 700 }])).toBeUndefined();
  expect(pairedSidebar(left, [{ ...left, y: 1000 }])).toBeUndefined();
});

it('follows the side of the screen a window is snapped to', async () => {
  const { snappedSidebar } = await import('../src/main/window-layout');
  const area = { x: 0, y: 0, width: 1920, height: 1032 };
  const half = { x: 960, y: 0, width: 960, height: 1032 };
  expect(snappedSidebar(half, area, true)).toBe('right');
  expect(snappedSidebar({ ...half, x: -7, width: 974 }, area, true)).toBe(
    'left',
  );
  // A snapped third and a snapped quarter.
  expect(snappedSidebar({ ...half, x: 1280, width: 640 }, area, true)).toBe(
    'right',
  );
  expect(snappedSidebar({ ...half, height: 516 }, area, true)).toBe('right');
  // Full height against an edge counts even if Windows did not report a snap.
  expect(snappedSidebar(half, area, false)).toBe('right');
  // A second screen to the left of the main one.
  expect(
    snappedSidebar({ ...half, x: -960 }, { ...area, x: -1920 }, true),
  ).toBe('right');
});
it('leaves maximized, floating and short unsnapped windows alone', async () => {
  const { snappedSidebar } = await import('../src/main/window-layout');
  const area = { x: 0, y: 0, width: 1920, height: 1032 };
  expect(snappedSidebar(area, area, false)).toBeUndefined();
  expect(
    snappedSidebar({ x: 300, y: 100, width: 1200, height: 800 }, area, false),
  ).toBeUndefined();
  expect(
    snappedSidebar({ x: 960, y: 100, width: 960, height: 600 }, area, false),
  ).toBeUndefined();
  expect(
    snappedSidebar({ x: 500, y: 0, width: 900, height: 1032 }, area, true),
  ).toBeUndefined();
});
