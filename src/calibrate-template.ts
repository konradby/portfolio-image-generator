/**
 * Pomocniczy skrypt do wykrywania obszarów ekranów (szachownica) w szablonie.
 * Uruchom: npm run calibrate
 */
import sharp from "sharp";
import { isCheckerPixel } from "./templates/checker.js";
import { getTemplate, resolveTemplatePath } from "./templates/index.js";

const TEMPLATE = resolveTemplatePath(getTemplate("template_01"));

async function main() {
  const { data, info } = await sharp(TEMPLATE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isCheckerPixel(data[i], data[i + 1], data[i + 2])) {
        mask[y * width + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const regions: { x: number; y: number; w: number; h: number; area: number }[] =
    [];

  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const start = sy * width + sx;
      if (!mask[start] || visited[start]) continue;

      let minX = sx,
        maxX = sx,
        minY = sy,
        maxY = sy;
      let area = 0;
      const stack: [number, number][] = [[sx, sy]];

      while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (!mask[idx] || visited[idx]) continue;
        visited[idx] = 1;
        area++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      if (area > 5000) {
        regions.push({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          area,
        });
      }
    }
  }

  regions.sort((a, b) => b.area - a.area);
  console.log(`Szablon: ${width}x${height}`);
  console.log("Wykryte obszary ekranów (od największego):");
  for (const r of regions) {
    console.log(
      `  x=${r.x} y=${r.y} w=${r.w} h=${r.h} area=${r.area} ratio=${(r.w / r.h).toFixed(2)}`,
    );
  }
}

main().catch(console.error);
