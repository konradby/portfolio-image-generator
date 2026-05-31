import { chromium, type Browser } from "playwright";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ViewportPreset } from "./templates/types.js";
import { DEVICE_VIEWPORTS, VIEWPORT_PRESETS } from "./viewports.js";

export interface CapturedScreenshots {
  desktop: string;
  tablet: string;
  mobile: string;
}

export function screenshotPaths(outputDir: string): Record<ViewportPreset, string> {
  return {
    desktop: join(outputDir, "desktop.png"),
    tablet: join(outputDir, "tablet.png"),
    mobile: join(outputDir, "mobile.png"),
  };
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function screenshotExists(path: string): Promise<boolean> {
  try {
    await access(path);
    const { size } = await stat(path);
    return size > 0;
  } catch {
    return false;
  }
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
  outputDir: string,
): Promise<CapturedScreenshots> {
  const url = normalizeUrl(urlInput);
  await mkdir(outputDir, { recursive: true });

  const paths = screenshotPaths(outputDir);
  const missing: ViewportPreset[] = [];

  for (const preset of VIEWPORT_PRESETS) {
    if (await screenshotExists(paths[preset])) {
      const vp = DEVICE_VIEWPORTS[preset];
      console.log(
        `  ⊘ ${preset} — pomijam (istnieje: ${paths[preset]}, ${vp.width}×${vp.height})`,
      );
    } else {
      missing.push(preset);
    }
  }

  if (missing.length > 0) {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const preset of missing) {
        const viewport = DEVICE_VIEWPORTS[preset];
        await captureOne(browser, url, preset, viewport, paths[preset]);
        console.log(
          `  ✓ ${preset} (${viewport.width}×${viewport.height})`,
        );
      }
    } finally {
      await browser.close();
    }
  } else {
    console.log("  Wszystkie screeny już istnieją — pomijam Playwright.");
  }

  for (const preset of VIEWPORT_PRESETS) {
    if (!(await screenshotExists(paths[preset]))) {
      throw new Error(`Brak screenshotu: ${paths[preset]}`);
    }
  }

  const meta = {
    url,
    capturedAt: new Date().toISOString(),
    viewports: DEVICE_VIEWPORTS,
  };
  await writeFile(
    join(outputDir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );

  return {
    desktop: paths.desktop,
    tablet: paths.tablet,
    mobile: paths.mobile,
  };
}
