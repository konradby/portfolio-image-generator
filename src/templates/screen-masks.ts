import sharp from "sharp";
import type { TemplateConfig, ScreenRole, DeviceOccluder } from "./types.js";
import { templateScreenRoles } from "./types.js";
import { isCheckerPixel } from "./checker.js";

export interface ScreenMaskLayer {
  bbox: { x: number; y: number; width: number; height: number };
  mask: Buffer;
}

export interface TemplateMaskSet {
  width: number;
  height: number;
  screens: Partial<Record<ScreenRole, ScreenMaskLayer>>;
  frameOverlay: Buffer;
}

function inRect(
  x: number,
  y: number,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
}

function blockedByOccluder(
  x: number,
  y: number,
  forRole: ScreenRole,
  occluders: DeviceOccluder[] | undefined,
): boolean {
  if (!occluders?.length) return false;
  for (const o of occluders) {
    if (o.exceptRole === forRole) continue;
    if (inRect(x, y, o.bounds)) return true;
  }
  return false;
}

const maskCache = new Map<string, Promise<TemplateMaskSet>>();

export function clearMaskCache(): void {
  maskCache.clear();
}

export function loadTemplateMasks(
  templatePath: string,
  template: TemplateConfig,
): Promise<TemplateMaskSet> {
  const key = `${template.id}:v11:${templatePath}`;
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

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isCheckerPixel(data[i], data[i + 1], data[i + 2])) {
        checker[y * width + x] = 1;
      }
    }
  }

  const roles = templateScreenRoles(template);
  const claimed = new Uint8Array(width * height);
  const finalPixels = new Map<ScreenRole, Uint8Array>();
  for (const k of roles) {
    finalPixels.set(k, new Uint8Array(width * height));
  }

  const orderedFrontToBack = [...template.layerOrder].reverse();

  for (const key of orderedFrontToBack) {
    const rect = template.screens[key];
    if (!rect) continue;
    const pixels = finalPixels.get(key)!;
    const pad = rect.inset ?? 0;
    const x1 = Math.max(0, rect.x + pad);
    const y1 = Math.max(0, rect.y + pad);
    const x2 = Math.min(width, rect.x + rect.width - pad);
    const y2 = Math.min(height, rect.y + rect.height - pad);

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const idx = y * width + x;
        if (
          checker[idx] &&
          !claimed[idx] &&
          !blockedByOccluder(x, y, key, template.occluders)
        ) {
          pixels[idx] = 1;
          claimed[idx] = 1;
        }
      }
    }
  }

  const screens: Partial<Record<ScreenRole, ScreenMaskLayer>> = {};

  for (const key of roles) {
    const pixels = finalPixels.get(key)!;
    const configRect = template.screens[key]!;

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

    const bbox = hasPixel
      ? {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        }
      : { ...configRect };

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

  const frameOverlay = await sharp(templatePath).ensureAlpha().png().toBuffer();

  return { width, height, screens, frameOverlay };
}
