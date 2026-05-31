import { resolve } from "node:path";
import {
  captureScreenshots,
  loadCapturedScreenshots,
  type CapturedScreenshots,
} from "./capture-screenshots.js";
import { compositeMockup, portfolioOutputPath, slugFromUrl } from "./composite.js";
import { getAllTemplates } from "./templates/index.js";
import type { TemplateConfig } from "./templates/types.js";

export interface GenerateOptions {
  url: string;
  screenshotsDir?: string;
  projectRoot?: string;
  templateId?: string;
}

export interface GenerateResult {
  screenshotsDir: string;
  screenshots: CapturedScreenshots;
  templateId: string;
  outputPath: string;
}

function pickTemplate(
  templates: TemplateConfig[],
  templateId = "template_02",
): TemplateConfig {
  const selected = templates.find((t) => t.id === templateId);
  if (!selected) {
    const available = templates.map((t) => t.id).join(", ");
    throw new Error(
      `Nie znaleziono szablonu "${templateId}". Dostępne: ${available}`,
    );
  }
  return selected;
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
  const selectedTemplate = pickTemplate(templates, options.templateId);

  console.log(`URL: ${url}`);
  console.log("Screenshoty per maska (2x, dedupe po ratio)...");
  const screenshots = await captureScreenshots(url, screenshotsDir, [
    selectedTemplate,
  ]);

  const outputPath = portfolioOutputPath(projectRoot, slug);
  console.log(`Składam mockup: ${selectedTemplate.id}`);
  await compositeMockup(selectedTemplate, screenshots, outputPath);
  console.log(`  ✓ ${selectedTemplate.id} → ${outputPath}`);

  return {
    screenshotsDir,
    screenshots,
    templateId: selectedTemplate.id,
    outputPath,
  };
}

/** Tylko składanie mockupów z istniejących screenshotów. */
export async function compositeSelectedTemplate(
  slug: string,
  templateId = "template_02",
  projectRoot = process.cwd(),
): Promise<string> {
  const screenshotsDir = resolve(projectRoot, "output", slug, "screenshots");
  const templates = await getAllTemplates();
  const selectedTemplate = pickTemplate(templates, templateId);
  const screenshots: CapturedScreenshots = await loadCapturedScreenshots(
    screenshotsDir,
    [selectedTemplate],
  );

  const outputPath = portfolioOutputPath(projectRoot, slug);
  await compositeMockup(selectedTemplate, screenshots, outputPath);
  console.log(`  ✓ ${selectedTemplate.id} → ${outputPath}`);
  return outputPath;
}
