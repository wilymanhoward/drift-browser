import type { Rectangle } from 'electron';

export function pairedSidebar(
  bounds: Rectangle,
  peers: Rectangle[],
): 'left' | 'right' | undefined {
  for (const peer of peers) {
    const overlap =
      Math.min(bounds.y + bounds.height, peer.y + peer.height) -
      Math.max(bounds.y, peer.y);
    if (overlap < Math.min(bounds.height, peer.height) * 0.6) continue;
    // Windows' invisible resize borders can overlap even when snapped.
    const leftGap = bounds.x - (peer.x + peer.width);
    const rightGap = peer.x - (bounds.x + bounds.width);
    if (leftGap >= -16 && leftGap <= 32) return 'right';
    if (rightGap >= -16 && rightGap <= 32) return 'left';
  }
}

// A window snapped beside another app keeps its sidebar on the screen's
// outer edge: on the right when it fills the right of the screen, and so on.
// `snapped` is Windows' own word; a full-height window against one edge looks
// the same, so it counts too.
export function snappedSidebar(
  bounds: Rectangle,
  area: Rectangle,
  snapped: boolean,
): 'left' | 'right' | undefined {
  // A maximized or near-full-width window has no side to follow.
  if (bounds.width > area.width * 0.75) return;
  if (!snapped && bounds.height < area.height * 0.9) return;
  // Windows' invisible resize borders reach a few pixels past the edge.
  const right = Math.abs(bounds.x + bounds.width - (area.x + area.width)) <= 16;
  const left = Math.abs(bounds.x - area.x) <= 16;
  if (right !== left) return right ? 'right' : 'left';
}
