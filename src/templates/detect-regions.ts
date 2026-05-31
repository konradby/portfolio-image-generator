import sharp from "sharp";
import { isCheckerPixel } from "./checker.js";
import type { RawRegion } from "./region-types.js";
import { isValidScreenRegion } from "./region-classify.js";

export { type RawRegion } from "./region-types.js";

/** Wykrywa obszary szachownicy w pełnej rozdzielczości. */
export async function detectCheckerRegions(
  templatePath: string,
): Promise<{ regions: RawRegion[]; width: number; height: number }> {
  const { data, info } = await sharp(templatePath)
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
      if (isValidScreenRegion(region, width)) {
        rawRegions.push(region);
      }
    }
  }

  return { regions: rawRegions, width: width!, height: height! };
}
