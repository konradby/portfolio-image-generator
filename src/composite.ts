import sharp from "sharp";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { TemplateConfig } from "./templates/types.js";
import { resolveTemplatePath } from "./templates/index.js";
import { loadTemplateMasks } from "./templates/screen-masks.js";
import type { CapturedScreenshots } from "./capture-screenshots.js";

type ScreenKey = keyof TemplateConfig["screens"];

const SCREEN_SOURCE: Record<ScreenKey, keyof CapturedScreenshots> = {
  monitor: "desktop",
  laptop: "desktop",
  tablet: "tablet",
  mobile: "mobile",
};

async function maskedScreenshotLayer(
  sourcePath: string,
  bbox: { width: number; height: number },
  mask: Buffer,
): Promise<Buffer> {
  const fitted = await sharp(sourcePath)
    .resize(bbox.width, bbox.height, {
      fit: "cover",
      position: "top",
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  return sharp(fitted)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export async function compositeMockup(
  template: TemplateConfig,
  screenshots: CapturedScreenshots,
  outputPath: string,
): Promise<string> {
  const templatePath = resolveTemplatePath(template);
  const masks = await loadTemplateMasks(templatePath, template);

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const key of template.layerOrder) {
    const layer = masks.screens[key];
    const sourcePath = screenshots[SCREEN_SOURCE[key]];
    const masked = await maskedScreenshotLayer(
      sourcePath,
      layer.bbox,
      layer.mask,
    );
    composites.push({
      input: masked,
      left: layer.bbox.x,
      top: layer.bbox.y,
    });
  }

  composites.push({ input: masks.frameOverlay, left: 0, top: 0 });

  await mkdir(dirname(outputPath), { recursive: true });

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
