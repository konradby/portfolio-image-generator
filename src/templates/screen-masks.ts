import sharp from "sharp";
import type { TemplateConfig, ScreenRole } from "./types.js";
import { templateScreenRoles } from "./types.js";
import { isCheckerPixel } from "./checker.js";

export interface ScreenMaskLayer {
  bbox: { x: number; y: number; width: number; height: number };
  /** Maska alfa (PNG) dopasowana do bbox – tylko obszar ekranu. */
  mask: Buffer;
}

export interface TemplateMaskSet {
  width: number;
  height: number;
  screens: Partial<Record<ScreenRole, ScreenMaskLayer>>;
  frameOverlay: Buffer;
}

interface Region {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
  cx: number;
  cy: number;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function rectCenter(r: { x: number; y: number; width: number; height: number }) {
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}

/** Odrzuca artefakty łączące dwa ekrany w jeden blob. */
function isValidScreenRegion(r: Region): boolean {
  if (r.area < 5000) return false;
  const ratio = r.w / r.h;
  if (ratio > 2.8 || ratio < 0.35) return false;
  return true;
}

function assignRegionToScreen(
  region: Region,
  screens: TemplateConfig["screens"],
  roles: ScreenRole[],
): ScreenRole {
  let best = roles[0]!;
  let bestD = Infinity;
  for (const key of roles) {
    const rect = screens[key];
    if (!rect) continue;
    const { cx, cy } = rectCenter(rect);
    const d = dist(region.cx, region.cy, cx, cy);
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}

const maskCache = new Map<string, Promise<TemplateMaskSet>>();

export function clearMaskCache(): void {
  maskCache.clear();
}

export function loadTemplateMasks(
  templatePath: string,
  template: TemplateConfig,
): Promise<TemplateMaskSet> {
  const key = `${template.id}:v3:${templatePath}`;
  let cached = maskCache.get(key);
  if (!cached) {
    cached = buildTemplateMasks(templatePath, template);
    maskCache.set(key, cached);
  }
  return cached;
}

async function buildTemplateMasks(
  templatePath: string,
  template: TemplateConfig,
): Promise<TemplateMaskSet> {
  const { data, info } = await sharp(templatePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const checker = new Uint8Array(width * height);
  const pixelLabel = new Int32Array(width * height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isCheckerPixel(data[i], data[i + 1], data[i + 2])) {
        checker[y * width + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const regions: Region[] = [];
  let nextId = 0;

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
      const id = nextId++;

      while (stack.length) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (!checker[idx] || visited[idx]) continue;
        visited[idx] = 1;
        pixelLabel[idx] = id;
        area++;
        sumX += x;
        sumY += y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      regions.push({
        id,
        x: minX,
        y: minY,
        w,
        h,
        area,
        cx: sumX / area,
        cy: sumY / area,
      });
    }
  }

  const roles = templateScreenRoles(template);
  const validRegions = regions.filter(isValidScreenRegion);
  const labelToScreen = new Map<number, ScreenRole>();
  for (const region of validRegions) {
    labelToScreen.set(
      region.id,
      assignRegionToScreen(region, template.screens, roles),
    );
  }

  const screenPixels = new Map<ScreenRole, Uint8Array>();
  for (const k of roles) {
    screenPixels.set(k, new Uint8Array(width * height));
  }

  for (let i = 0; i < pixelLabel.length; i++) {
    const label = pixelLabel[i];
    if (label < 0) continue;
    const screenKey = labelToScreen.get(label);
    if (!screenKey) continue;
    screenPixels.get(screenKey)![i] = 1;
  }

  // Nakładające się bboxy: front w layerOrder przejmuje piksel szachownicy
  const claimed = new Uint8Array(width * height);
  const orderedFrontToBack = [...template.layerOrder].reverse();
  const finalPixels = new Map<ScreenRole, Uint8Array>();
  for (const k of roles) {
    finalPixels.set(k, new Uint8Array(width * height));
  }

  for (const key of orderedFrontToBack) {
    const src = screenPixels.get(key)!;
    const dst = finalPixels.get(key)!;
    for (let i = 0; i < width * height; i++) {
      if (src[i] && !claimed[i]) {
        dst[i] = 1;
        claimed[i] = 1;
      }
    }
  }

  const screens: Partial<Record<ScreenRole, ScreenMaskLayer>> = {};

  for (const key of roles) {
    const pixels = finalPixels.get(key)!;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    let hasPixel = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!pixels[y * width + x]) continue;
        hasPixel = true;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    if (!hasPixel) {
      const fallback = template.screens[key]!;
      screens[key] = {
        bbox: { ...fallback },
        mask: await sharp({
          create: {
            width: fallback.width,
            height: fallback.height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
      };
      continue;
    }

    const bbox = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    const crop = Buffer.alloc(bbox.width * bbox.height);
    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const globalIdx = (bbox.y + y) * width + (bbox.x + x);
        crop[y * bbox.width + x] = pixels[globalIdx] ? 255 : 0;
      }
    }

    const mask = await sharp(crop, {
      raw: { width: bbox.width, height: bbox.height, channels: 1 },
    })
      .png()
      .toBuffer();

    screens[key] = { bbox, mask };
  }

  const overlay = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pi = idx * channels;
      const oi = idx * 4;
      // Każdy piksel szachownicy = dziura na screenshot (nie tylko „claimed”).
      const isScreen = checker[idx] === 1;
      if (isScreen) {
        overlay[oi + 3] = 0;
      } else {
        overlay[oi] = data[pi];
        overlay[oi + 1] = data[pi + 1];
        overlay[oi + 2] = data[pi + 2];
        overlay[oi + 3] = 255;
      }
    }
  }

  const frameOverlay = await sharp(overlay, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  return {
    width,
    height,
    screens,
    frameOverlay,
  };
}
