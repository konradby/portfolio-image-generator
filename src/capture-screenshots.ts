import { chromium, type Browser } from "playwright";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ScreenRole,
  TemplateConfig,
  ViewportPreset,
} from "./templates/types.js";

export interface CaptureRequest {
  key: string;
  width: number;
  height: number;
  ratioBucket: number;
  slotIds: string[];
}

export interface CapturedScreenshots {
  captures: Record<string, string>;
  slotToCapture: Record<string, string>;
}

export interface CaptureMetaV2 {
  version: "mask-v2";
  url: string;
  capturedAt: string;
  requests: Array<{
    key: string;
    width: number;
    height: number;
    ratioBucket: number;
    slotCount: number;
  }>;
  slotToCapture: Record<string, string>;
}

const LEGACY_ROLE_KEY: Record<ScreenRole, ViewportPreset> = {
  monitor: "desktop",
  laptop: "desktop",
  tablet: "tablet",
  mobile: "mobile",
};
const RATIO_BUCKET_SCALE = 50; // bucket ~co 0.02 ratio

function captureKey(
  ratioBucket: number,
  width: number,
  height: number,
): string {
  return `r${ratioBucket}-w${width}-h${height}`;
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

function slotId(templateId: string, role: ScreenRole): string {
  return `${templateId}:${role}`;
}

function capturePath(outputDir: string, key: string): string {
  return join(outputDir, `mask-${key}.png`);
}

function upscaledViewport(
  width: number,
  height: number,
  scale = 2,
  minLongSide = 900,
): { width: number; height: number } {
  let w = Math.max(1, Math.round(width * scale));
  let h = Math.max(1, Math.round(height * scale));
  const longSide = Math.max(w, h);
  if (longSide < minLongSide) {
    const factor = minLongSide / longSide;
    w = Math.max(1, Math.round(w * factor));
    h = Math.max(1, Math.round(h * factor));
  }
  return { width: w, height: h };
}

export function buildCaptureRequests(
  templates: TemplateConfig[],
): { requests: CaptureRequest[]; slotToCapture: Record<string, string> } {
  const byNormalizedKey = new Map<
    string,
    {
      key: string;
      width: number;
      height: number;
      ratioBucket: number;
      slotIds: string[];
    }
  >();
  const slotToCapture: Record<string, string> = {};

  for (const template of templates) {
    for (const role of template.layerOrder) {
      const screen = template.screens[role];
      if (!screen) continue;

      const inset = screen.inset ?? 0;
      const targetW = Math.max(1, screen.width - inset * 2);
      const targetH = Math.max(1, screen.height - inset * 2);
      const vp = upscaledViewport(targetW, targetH, 2, 900);
      const ratioBucket = Math.round((targetW / targetH) * RATIO_BUCKET_SCALE);
      const key = captureKey(ratioBucket, vp.width, vp.height);
      const id = slotId(template.id, role);

      const existing = byNormalizedKey.get(key);
      if (!existing) {
        byNormalizedKey.set(key, {
          key,
          width: vp.width,
          height: vp.height,
          ratioBucket,
          slotIds: [id],
        });
      } else {
        existing.slotIds.push(id);
      }
      slotToCapture[id] = key;
    }
  }

  const requests = [...byNormalizedKey.values()]
    .map((v) => ({
      key: v.key,
      width: v.width,
      height: v.height,
      ratioBucket: v.ratioBucket,
      slotIds: v.slotIds,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { requests, slotToCapture };
}

async function captureOne(
  browser: Browser,
  url: string,
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
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
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
  templates: TemplateConfig[],
): Promise<CapturedScreenshots> {
  const url = normalizeUrl(urlInput);
  await mkdir(outputDir, { recursive: true });

  const { requests, slotToCapture } = buildCaptureRequests(templates);
  const captures: Record<string, string> = {};
  const missing: CaptureRequest[] = [];

  for (const req of requests) {
    const path = capturePath(outputDir, req.key);
    captures[req.key] = path;
    if (await screenshotExists(path)) {
      console.log(
        `  ⊘ ${req.key} — pomijam (istnieje: ${path}, ${req.width}×${req.height})`,
      );
    } else {
      missing.push(req);
    }
  }

  if (missing.length > 0) {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const req of missing) {
        await captureOne(
          browser,
          url,
          { width: req.width, height: req.height },
          captures[req.key],
        );
        console.log(
          `  ✓ ${req.key} (${req.width}×${req.height}) [sloty: ${req.slotIds.length}]`,
        );
      }
    } finally {
      await browser.close();
    }
  } else {
    console.log("  Wszystkie screenshoty per-maska już istnieją — pomijam Playwright.");
  }

  for (const req of requests) {
    if (!(await screenshotExists(captures[req.key]))) {
      throw new Error(`Brak screenshotu: ${captures[req.key]}`);
    }
  }

  const meta: CaptureMetaV2 = {
    version: "mask-v2",
    url,
    capturedAt: new Date().toISOString(),
    requests: requests.map((r) => ({
      key: r.key,
      width: r.width,
      height: r.height,
      ratioBucket: r.ratioBucket,
      slotCount: r.slotIds.length,
    })),
    slotToCapture,
  };
  await writeFile(join(outputDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  return { captures, slotToCapture };
}

function legacyScreenshotPaths(
  outputDir: string,
): Record<ViewportPreset, string> {
  return {
    desktop: join(outputDir, "desktop.png"),
    tablet: join(outputDir, "tablet.png"),
    mobile: join(outputDir, "mobile.png"),
  };
}

function legacyMapping(
  templates: TemplateConfig[],
  captures: Record<string, string>,
): CapturedScreenshots {
  const slotToCapture: Record<string, string> = {};
  for (const template of templates) {
    for (const role of template.layerOrder) {
      if (!template.screens[role]) continue;
      slotToCapture[slotId(template.id, role)] = LEGACY_ROLE_KEY[role];
    }
  }
  return { captures, slotToCapture };
}

export async function loadCapturedScreenshots(
  outputDir: string,
  templates: TemplateConfig[],
): Promise<CapturedScreenshots> {
  const metaPath = join(outputDir, "meta.json");
  try {
    const raw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(raw) as Partial<CaptureMetaV2>;
    if (meta.version === "mask-v2" && meta.slotToCapture) {
      const keys = new Set(Object.values(meta.slotToCapture));
      const captures: Record<string, string> = {};
      for (const key of keys) {
        const path = capturePath(outputDir, key);
        if (!(await screenshotExists(path))) {
          throw new Error(`Brak screenshotu per-maska: ${path}`);
        }
        captures[key] = path;
      }
      return { captures, slotToCapture: meta.slotToCapture };
    }
  } catch {
    // fallback legacy below
  }

  const legacy = legacyScreenshotPaths(outputDir);
  const captures: Record<string, string> = {
    desktop: legacy.desktop,
    tablet: legacy.tablet,
    mobile: legacy.mobile,
  };
  for (const path of Object.values(captures)) {
    if (!(await screenshotExists(path))) {
      throw new Error(
        `Brak screenshotów. Uruchom ponownie generate albo dostarcz meta mask-v2: ${path}`,
      );
    }
  }
  return legacyMapping(templates, captures);
}
