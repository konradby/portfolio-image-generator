import type { ScreenRole } from "./types.js";
import type { RawRegion } from "./region-types.js";

export function isValidScreenRegion(
  r: RawRegion,
  imageWidth: number,
): boolean {
  if (r.area < 5000) return false;
  const ratio = r.w / r.h;
  if (ratio > 2.8 || ratio < 0.35) return false;
  if (r.w > imageWidth * 0.55) return false;
  return true;
}

export function classifyFour(
  regions: RawRegion[],
): Partial<Record<ScreenRole, RawRegion>> {
  const sorted = [...regions].sort((a, b) => b.area - a.area);
  if (sorted.length < 4) {
    throw new Error(`Oczekiwano 4 ekranów, jest ${sorted.length}`);
  }
  const monitor = sorted[0]!;
  const mobile = sorted.reduce((a, b) => (a.area < b.area ? a : b))!;
  const rest = sorted.filter((r) => r !== monitor && r !== mobile);
  const portrait = rest.filter((r) => r.w / r.h < 1);
  const tablet =
    portrait.sort((a, b) => b.area - a.area)[0] ??
    rest.sort((a, b) => b.area - a.area)[0]!;
  const laptop = rest.find((r) => r !== tablet) ?? sorted[1]!;
  return { monitor, laptop, tablet, mobile };
}

export function classifyThree(
  regions: RawRegion[],
): Partial<Record<ScreenRole, RawRegion>> {
  const sorted = [...regions].sort((a, b) => b.area - a.area);
  if (sorted.length < 3) {
    throw new Error(`Oczekiwano 3 ekranów, jest ${sorted.length}`);
  }
  const monitor = sorted[0]!;
  const side = sorted.slice(1);
  const [left, right] = side[0]!.cx <= side[1]!.cx ? side : [side[1], side[0]];
  return { monitor, tablet: left!, mobile: right! };
}

export function classifyByDeviceCount(
  regions: RawRegion[],
  deviceCount: number,
): Partial<Record<ScreenRole, RawRegion>> {
  if (deviceCount >= 4) return classifyFour(regions);
  if (deviceCount === 3) return classifyThree(regions);
  throw new Error(`Nieobsługiwana liczba urządzeń: ${deviceCount}`);
}

/** Przypisuje wykryte bloby (po id) do ról na podstawie bliskości centroidów. */
export function matchRegionsToRoles(
  regions: { id: number; cx: number; cy: number }[],
  assigned: Partial<Record<ScreenRole, RawRegion>>,
): Map<number, ScreenRole> {
  const map = new Map<number, ScreenRole>();
  const entries = Object.entries(assigned) as [ScreenRole, RawRegion][];

  for (const region of regions) {
    let best: ScreenRole = entries[0]![0];
    let bestD = Infinity;
    for (const [role, target] of entries) {
      const d = Math.hypot(region.cx - target.cx, region.cy - target.cy);
      if (d < bestD) {
        bestD = d;
        best = role;
      }
    }
    map.set(region.id, best);
  }
  return map;
}
