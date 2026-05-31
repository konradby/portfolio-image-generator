import sharp from "sharp";
import type { TemplateConfig, ScreenRole } from "./types.js";
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

async function debugLog(
  runId: string,
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
): Promise<void> {
  // #region agent log
  await fetch("http://127.0.0.1:7612/ingest/f681acbf-5618-4bb7-94cc-2d7f8bf8b7a2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "b95aee",
    },
    body: JSON.stringify({
      sessionId: "b95aee",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function inRect(
  x: number,
  y: number,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
}

const maskCache = new Map<string, Promise<TemplateMaskSet>>();

export function clearMaskCache(): void {
  maskCache.clear();
}

export function loadTemplateMasks(
  templatePath: string,
  template: TemplateConfig,
): Promise<TemplateMaskSet> {
  const key = `${template.id}:v12:${templatePath}`;
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
  const runId = process.env.DEBUG_RUN_ID ?? "run1";
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

  let checkerCount = 0;
  for (let i = 0; i < checker.length; i++) {
    if (checker[i]) checkerCount++;
  }
  // #region agent log
  await debugLog(runId, "H1", "screen-masks.ts:checker-scan", "Checker density", {
    templateId: template.id,
    width,
    height,
    checkerCount,
    checkerRatio: checkerCount / checker.length,
  });
  // #endregion

  const roles = templateScreenRoles(template);
  const claimed = new Uint8Array(width * height);
  const perRolePixels = new Map<ScreenRole, Uint8Array>();
  for (const k of roles) {
    perRolePixels.set(k, new Uint8Array(width * height));
  }

  // 1) Piksele szachownicy przypisz do ekranów tylko wewnątrz ich prostokątów.
  for (const key of roles) {
    const rect = template.screens[key];
    if (!rect) continue;
    const pixels = perRolePixels.get(key)!;
    const pad = rect.inset ?? 0;
    const x1 = Math.max(0, rect.x + pad);
    const y1 = Math.max(0, rect.y + pad);
    const x2 = Math.min(width, rect.x + rect.width - pad);
    const y2 = Math.min(height, rect.y + rect.height - pad);

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const idx = y * width + x;
        if (checker[idx]) {
          pixels[idx] = 1;
        }
      }
    }

    // #region agent log
    await debugLog(
      runId,
      "H7",
      "screen-masks.ts:solidify",
      "Solidify disabled after runtime rejection",
      { templateId: template.id, role: key },
    );
    // #endregion

  }

  const candidateOverlap: Partial<Record<ScreenRole, number>> = {};
  for (const role of roles) {
    candidateOverlap[role] = 0;
  }
  for (let i = 0; i < checker.length; i++) {
    const owners = roles.filter((role) => perRolePixels.get(role)![i] === 1);
    if (owners.length > 1) {
      for (const owner of owners) {
        candidateOverlap[owner] = (candidateOverlap[owner] ?? 0) + 1;
      }
    }
  }
  // #region agent log
  await debugLog(
    runId,
    "H2",
    "screen-masks.ts:candidate-overlap",
    "Per-role overlap before layer priority",
    {
      templateId: template.id,
      overlapByRole: candidateOverlap,
      layerOrder: template.layerOrder,
    },
  );
  // #endregion

  // 2) W obszarach wspólnych pierwszeństwo ma urządzenie z przodu.
  const orderedFrontToBack = [...template.layerOrder].reverse();
  const finalPixels = new Map<ScreenRole, Uint8Array>();
  for (const k of roles) {
    finalPixels.set(k, new Uint8Array(width * height));
  }
  for (const key of orderedFrontToBack) {
    const src = perRolePixels.get(key)!;
    const dst = finalPixels.get(key)!;
    for (let i = 0; i < src.length; i++) {
      if (src[i] && !claimed[i]) {
        dst[i] = 1;
        claimed[i] = 1;
      }
    }
  }

  let claimedCount = 0;
  let claimedOutsideChecker = 0;
  for (let i = 0; i < claimed.length; i++) {
    if (claimed[i]) {
      claimedCount++;
      if (!checker[i]) claimedOutsideChecker++;
    }
  }
  // #region agent log
  await debugLog(
    runId,
    "H3",
    "screen-masks.ts:claimed-summary",
    "Claimed screen pixels summary",
    {
      templateId: template.id,
      claimedCount,
      claimedOutsideChecker,
    },
  );
  // #endregion

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

    // #region agent log
    await debugLog(runId, "H4", "screen-masks.ts:role-bbox", "Role mask bbox", {
      templateId: template.id,
      role: key,
      configRect,
      bbox,
      usedFallback: !hasPixel,
    });
    // #endregion
  }

  const overlay = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pi = idx * channels;
      const oi = idx * 4;
      overlay[oi] = data[pi];
      overlay[oi + 1] = data[pi + 1];
      overlay[oi + 2] = data[pi + 2];
      // Dziury tylko w rzeczywiście przypisanych pikselach ekranu.
      overlay[oi + 3] = claimed[idx] ? 0 : 255;
    }
  }
  const frameOverlay = await sharp(overlay, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  // #region agent log
  await debugLog(runId, "H5", "screen-masks.ts:frame-overlay", "Frame overlay built", {
    templateId: template.id,
    frameBytes: frameOverlay.length,
  });
  // #endregion

  return { width, height, screens, frameOverlay };
}
