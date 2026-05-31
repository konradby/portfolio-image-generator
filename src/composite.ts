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

const LEGACY_ROLE_KEY: Record<ScreenRole, ViewportPreset> = {
  monitor: "desktop",
  laptop: "desktop",
  tablet: "tablet",
  mobile: "mobile",
};

async function maskedScreenshotLayer(
  sourcePath: string,
  bbox: { width: number; height: number },
  mask: Buffer,
  screen?: ScreenRect,
): Promise<Buffer> {
  const fitted = await sharp(sourcePath)
    .resize(bbox.width, bbox.height, {
      fit: screen?.fit ?? "cover",
      position: screen?.position ?? "top",
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
  const templatePath = resolveTemplatePath(template);
  const masks = await loadTemplateMasks(templatePath, template);

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const key of template.layerOrder) {
    const layer = masks.screens[key];
    if (!layer) continue;
    const slotId = `${template.id}:${key}`;
    const captureKey = screenshots.slotToCapture[slotId] ?? LEGACY_ROLE_KEY[key];
    const sourcePath = screenshots.captures[captureKey];
    if (!sourcePath) {
      throw new Error(
        `Brak screenshotu dla slotu ${slotId} (captureKey=${captureKey})`,
      );
    }
    const masked = await maskedScreenshotLayer(
      sourcePath,
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
      background: { r: 0, g: 0, b: 0, alpha: 0 },
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
): string {
  return join(projectRoot, "output", slug, `portfolio_${slug}.png`);
}

export function portfolioOutputPath(projectRoot: string, slug: string): string {
  return defaultOutputPath(projectRoot, slug);
}

export function slugFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.replace(/[^a-z0-9.-]/gi, "_");
  } catch {
    return "site";
  }
}
