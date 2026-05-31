import sharp from "sharp";
import { resolve, dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { TemplateConfig } from "./templates/types.js";
import type { CapturedScreenshots } from "./capture-screenshots.js";

type ScreenKey = keyof TemplateConfig["screens"];

const SCREEN_SOURCE: Record<ScreenKey, keyof CapturedScreenshots> = {
  monitor: "desktop",
  laptop: "desktop",
  tablet: "tablet",
  mobile: "mobile",
};

async function fitScreenshot(
  sourcePath: string,
  rect: { width: number; height: number },
): Promise<Buffer> {
  return sharp(sourcePath)
    .resize(rect.width, rect.height, {
      fit: "cover",
      position: "top",
    })
    .png()
    .toBuffer();
}

export async function compositeMockup(
  template: TemplateConfig,
  screenshots: CapturedScreenshots,
  outputPath: string,
  projectRoot: string,
): Promise<string> {
  const templatePath = resolve(projectRoot, template.file);
  const base = sharp(templatePath);
  const meta = await base.metadata();

  if (meta.width !== template.width || meta.height !== template.height) {
    console.warn(
      `Uwaga: rozmiar szablonu (${meta.width}×${meta.height}) różni się od konfiguracji (${template.width}×${template.height}).`,
    );
  }

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const key of template.layerOrder) {
    const rect = template.screens[key];
    const sourceKey = SCREEN_SOURCE[key];
    const sourcePath = screenshots[sourceKey];
    const buffer = await fitScreenshot(sourcePath, rect);
    composites.push({ input: buffer, left: rect.x, top: rect.y });
  }

  await mkdir(dirname(outputPath), { recursive: true });

  await base.composite(composites).png().toFile(outputPath);

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
