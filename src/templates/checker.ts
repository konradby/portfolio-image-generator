/** Piksel tła szachownicy (placeholder ekranu) w szablonie JPG. */
export function isCheckerPixel(r: number, g: number, b: number): boolean {
  const avg = (r + g + b) / 3;
  if (avg > 248 || avg < 40) return false;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 25) return false;
  return avg >= 170 && avg <= 245;
}
