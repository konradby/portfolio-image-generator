/** Piksel tła szachownicy (placeholder ekranu) — jasne i ciemne pole. */
export function isCheckerPixel(r: number, g: number, b: number): boolean {
  const avg = (r + g + b) / 3;
  if (avg > 252 || avg < 40) return false;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 40) return false;
  return avg >= 125 && avg <= 252;
}
