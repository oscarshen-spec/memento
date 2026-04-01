/**
 * Returns true if the flip gesture should snap forward (complete the turn)
 * rather than spring back to the starting position.
 *
 * @param progress  Absolute drag distance in the flip direction (px, always ≥ 0)
 * @param pageWidth Total page width in px
 * @param velocity  Drag velocity in the flip direction (px/ms, always ≥ 0)
 */
export function shouldSnapForward(
  progress: number,
  pageWidth: number,
  velocity: number,
): boolean {
  // >= 0.35: boundary case (exactly 35%) is treated as snap-forward (inclusive threshold)
  return progress >= pageWidth * 0.35 || velocity > 0.5;
}
