import { resolve } from "node:path";
import {
  captureScreenshots,
  loadCapturedScreenshots,
  type CapturedScreenshots,
} from "./capture-screenshots.js";
import { compositeMockup, defaultOutputPath, slugFromUrl } from "./composite.js";
import { getAllTemplates } from "./templates/index.js";

export interface GenerateOptions {
  url: string;
  screenshotsDir?: string;
  projectRoot?: string;
}

export interface GenerateResult {
  screenshotsDir: string;
  screenshots: CapturedScreenshots;
  mockupPaths: Record<string, string>;
}

export async function generatePortfolioImage(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const projectRoot = options.projectRoot ?? process.cwd();

  const url = options.url.trim().startsWith("http")
    ? options.url.trim()
    : `https://${options.url.trim()}`;
  const slug = slugFromUrl(url);

  const screenshotsDir =
    options.screenshotsDir ??
    resolve(projectRoot, "output", slug, "screenshots");

  const templates = await getAllTemplates();

  console.log(`URL: ${url}`);
  console.log("Screenshoty per maska (2x, dedupe po ratio)...");
  const screenshots = await captureScreenshots(url, screenshotsDir, templates);

  const mockupPaths: Record<string, string> = {};

  console.log(
    `Składam mockupy (${templates.length} szablonów): ${templates.map((t) => t.id).join(", ")}`,
  );

  for (const template of templates) {
    const mockupPath = defaultOutputPath(projectRoot, slug, template.id);
    await compositeMockup(template, screenshots, mockupPath);
    mockupPaths[template.id] = mockupPath;
    console.log(`  ✓ ${template.id} → ${mockupPath}`);
  }

  return { screenshotsDir, screenshots, mockupPaths };
}

/** Tylko składanie mockupów z istniejących screenshotów. */
export async function compositeAllTemplates(
  slug: string,
  projectRoot = process.cwd(),
): Promise<Record<string, string>> {
  const screenshotsDir = resolve(projectRoot, "output", slug, "screenshots");
  const templates = await getAllTemplates();
  const screenshots: CapturedScreenshots = await loadCapturedScreenshots(
    screenshotsDir,
    templates,
  );
  const mockupPaths: Record<string, string> = {};

  for (const template of templates) {
    const mockupPath = defaultOutputPath(projectRoot, slug, template.id);
    await compositeMockup(template, screenshots, mockupPath);
    mockupPaths[template.id] = mockupPath;
    console.log(`  ✓ ${template.id} → ${mockupPath}`);
  }

  return mockupPaths;
}
