import sharp from "sharp";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type {
  TemplateConfig,
  ScreenRole,
  ViewportPreset,
  ScreenRect,
} from "./templates/types.js";
import { resolveTemplatePath } from "./templates/index.js";
import { loadTemplateMasks } from "./templates/screen-masks.js";
import type { CapturedScreenshots } from "./capture-screenshots.js";

const SCREEN_SOURCE: Record<ScreenRole, ViewportPreset> = {
  monitor: "desktop",
  laptop: "desktop",
  tablet: "tablet",
  mobile: "mobile",
};

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

async function maskedScreenshotLayer(
  sourcePath: string,
  bbox: { width: number; height: number },
  mask: Buffer,
  screen?: ScreenRect,
): Promise<Buffer> {
  const fitted = await sharp(sourcePath)
    .resize(bbox.width, bbox.height, {
      fit: screen?.fit ?? "cover",
      position: "top",
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const maskPng = await sharp(mask)
    .resize(bbox.width, bbox.height, { fit: "fill" })
    .png()
    .toBuffer();

  return sharp(fitted)
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export async function compositeMockup(
  template: TemplateConfig,
  screenshots: CapturedScreenshots,
  outputPath: string,
): Promise<string> {
  const runId = process.env.DEBUG_RUN_ID ?? "run1";
  const templatePath = resolveTemplatePath(template);
  const masks = await loadTemplateMasks(templatePath, template);

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const key of template.layerOrder) {
    const layer = masks.screens[key];
    if (!layer) continue;
    // #region agent log
    await debugLog(runId, "H5", "composite.ts:layer-input", "Compositing layer", {
      templateId: template.id,
      role: key,
      source: SCREEN_SOURCE[key],
      sourcePath: screenshots[SCREEN_SOURCE[key]],
      bbox: layer.bbox,
      screenConfig: template.screens[key] ?? null,
    });
    // #endregion
    const masked = await maskedScreenshotLayer(
      screenshots[SCREEN_SOURCE[key]],
      layer.bbox,
      layer.mask,
      template.screens[key],
    );
    composites.push({
      input: masked,
      left: layer.bbox.x,
      top: layer.bbox.y,
    });
  }

  await mkdir(dirname(outputPath), { recursive: true });

  composites.push({ input: masks.frameOverlay, left: 0, top: 0 });

  await sharp({
    create: {
      width: masks.width,
      height: masks.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  // #region agent log
  await debugLog(runId, "H5", "composite.ts:output", "Composite output written", {
    templateId: template.id,
    outputPath,
    layersCount: composites.length,
  });
  // #endregion

  return outputPath;
}

export function defaultOutputPath(
  projectRoot: string,
  slug: string,
  templateId: string,
): string {
  return join(projectRoot, "output", slug, `${templateId}.png`);
}

export function slugFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.replace(/[^a-z0-9.-]/gi, "_");
  } catch {
    return "site";
  }
}
