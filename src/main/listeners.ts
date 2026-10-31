import type { WebContents } from 'electron';

// Records listeners added through `on` so `off` can remove exactly those,
// leaving other owners' listeners on the same page in place.
export function listeners(page: WebContents) {
  const added: [string, (...args: never[]) => void][] = [];
  const on = ((event: string, listener: (...args: never[]) => void) => {
    added.push([event, listener]);
    return page.on(event as 'focus', listener as () => void);
  }) as WebContents['on'];
  const off = () => {
    for (const [event, listener] of added.splice(0))
      page.removeListener(event as 'focus', listener as () => void);
  };
  return { on, off };
}
