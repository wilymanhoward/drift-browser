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
