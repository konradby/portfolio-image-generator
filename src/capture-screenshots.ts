import { chromium, type Browser } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateConfig, ViewportPreset } from "./templates/types.js";

export interface CapturedScreenshots {
  desktop: string;
  tablet: string;
  mobile: string;
}

const PRESETS: ViewportPreset[] = ["desktop", "tablet", "mobile"];

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function captureOne(
  browser: Browser,
  url: string,
  preset: ViewportPreset,
  viewport: { width: number; height: number },
  outputPath: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: outputPath,
      fullPage: false,
      type: "png",
    });
  } finally {
    await context.close();
  }
}

export async function captureScreenshots(
  urlInput: string,
  template: TemplateConfig,
  outputDir: string,
): Promise<CapturedScreenshots> {
  const url = normalizeUrl(urlInput);
  await mkdir(outputDir, { recursive: true });

  const paths: Partial<Record<ViewportPreset, string>> = {};
  for (const preset of PRESETS) {
    paths[preset] = join(outputDir, `${preset}.png`);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    for (const preset of PRESETS) {
      const viewport = template.viewports[preset];
      await captureOne(
        browser,
        url,
        preset,
        viewport,
        paths[preset]!,
      );
      console.log(`  ✓ ${preset} (${viewport.width}×${viewport.height})`);
    }
  } finally {
    await browser.close();
  }

  const meta = { url, capturedAt: new Date().toISOString(), template: template.id };
  await writeFile(
    join(outputDir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );

  return {
    desktop: paths.desktop!,
    tablet: paths.tablet!,
    mobile: paths.mobile!,
  };
}
