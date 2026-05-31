import { resolve } from "node:path";
import { captureScreenshots } from "./capture-screenshots.js";
import {
  compositeMockup,
  defaultOutputPath,
  slugFromUrl,
} from "./composite.js";
import { getTemplate } from "./templates/index.js";

export interface GenerateOptions {
  url: string;
  templateId?: string;
  outputDir?: string;
  projectRoot?: string;
  keepScreenshots?: boolean;
}

export interface GenerateResult {
  screenshotsDir: string;
  mockupPath: string;
  screenshots: { desktop: string; tablet: string; mobile: string };
}

export async function generatePortfolioImage(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const templateId = options.templateId ?? "template_01";
  const template = getTemplate(templateId);

  const url = options.url.trim().startsWith("http")
    ? options.url.trim()
    : `https://${options.url.trim()}`;
  const slug = slugFromUrl(url);

  const screenshotsDir =
    options.outputDir ?? resolve(projectRoot, "output", slug, "screenshots");

  console.log(`URL: ${url}`);
  console.log(`Szablon: ${templateId}`);
  console.log("Robię screeny…");

  const screenshots = await captureScreenshots(url, template, screenshotsDir);

  const mockupPath =
    options.outputDir != null
      ? resolve(resolve(options.outputDir, ".."), `${templateId}.png`)
      : defaultOutputPath(projectRoot, slug, templateId);

  console.log("Składam mockup…");
  await compositeMockup(template, screenshots, mockupPath);

  console.log(`Gotowe: ${mockupPath}`);

  return { screenshotsDir, mockupPath, screenshots };
}
