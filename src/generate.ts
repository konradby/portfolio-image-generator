import { resolve } from "node:path";
import {
  captureScreenshots,
  screenshotPaths,
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
  console.log("Screenshoty (desktop / tablet / mobile)…");
  const screenshots = await captureScreenshots(url, screenshotsDir);

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
  const paths = screenshotPaths(screenshotsDir);
  const screenshots: CapturedScreenshots = {
    desktop: paths.desktop,
    tablet: paths.tablet,
    mobile: paths.mobile,
  };

  const templates = await getAllTemplates();
  const mockupPaths: Record<string, string> = {};

  for (const template of templates) {
    const mockupPath = defaultOutputPath(projectRoot, slug, template.id);
    await compositeMockup(template, screenshots, mockupPath);
    mockupPaths[template.id] = mockupPath;
    console.log(`  ✓ ${template.id} → ${mockupPath}`);
  }

  return mockupPaths;
}
