import sharp from "sharp";
import { isCheckerPixel } from "./checker.js";
import type { RawRegion } from "./region-types.js";

export { type RawRegion } from "./region-types.js";

export function isValidScreenRegion(r: RawRegion): boolean {
  if (r.area < 5000) return false;
  const ratio = r.w / r.h;
  return ratio <= 2.8 && ratio >= 0.35;
}

/** Wykrywa obszary szachownicy; opcjonalnie skaluje obraz w dół dla szybkości. */
export async function detectCheckerRegions(
  templatePath: string,
  maxWidth = 1800,
): Promise<{ regions: RawRegion[]; width: number; height: number; scale: number }> {
  const meta = await sharp(templatePath).metadata();
  const fullW = meta.width!;
  const fullH = meta.height!;
  const scale = fullW > maxWidth ? maxWidth / fullW : 1;
  const w = Math.round(fullW * scale);
  const h = Math.round(fullH * scale);

  const { data, info } = await sharp(templatePath)
    .resize(w, h, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const checker = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const rawRegions: RawRegion[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isCheckerPixel(data[i], data[i + 1], data[i + 2])) {
        checker[y * width + x] = 1;
      }
    }
  }

  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const start = sy * width + sx;
      if (!checker[start] || visited[start]) continue;

      let minX = sx,
        maxX = sx,
        minY = sy,
        maxY = sy;
      let area = 0;
      let sumX = 0,
        sumY = 0;
      const stack: [number, number][] = [[sx, sy]];

      while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (!checker[idx] || visited[idx]) continue;
        visited[idx] = 1;
        area++;
        sumX += x;
        sumY += y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      const region: RawRegion = {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area,
        cx: sumX / area,
        cy: sumY / area,
      };
      if (isValidScreenRegion(region)) {
        if (scale !== 1) {
          region.x = Math.round(region.x / scale);
          region.y = Math.round(region.y / scale);
          region.w = Math.round(region.w / scale);
          region.h = Math.round(region.h / scale);
          region.cx = region.x + region.w / 2;
          region.cy = region.y + region.h / 2;
          region.area = Math.round(region.area / (scale * scale));
        }
        rawRegions.push(region);
      }
    }
  }

  return { regions: rawRegions, width: fullW, height: fullH, scale };
}
