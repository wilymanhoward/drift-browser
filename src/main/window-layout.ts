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
