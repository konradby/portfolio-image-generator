import { basename } from "node:path";
import type { TemplateConfig, ScreenRole, ScreenRect } from "./types.js";
import type { RawRegion } from "./region-types.js";
import { detectCheckerRegions } from "./detect-regions.js";
import {
  classifyByDeviceCount,
  classifyFour,
  classifyThree,
} from "./region-classify.js";

export interface DetectedRegion extends RawRegion {
  role: ScreenRole;
}

function toScreenRect(r: RawRegion): ScreenRect {
  return { x: r.x, y: r.y, width: r.w, height: r.h };
}

function layerOrderForScreens(
  screens: Partial<Record<ScreenRole, RawRegion>>,
): ScreenRole[] {
  if (screens.laptop) {
    return ["monitor", "laptop", "tablet", "mobile"];
  }
  return ["monitor", "tablet", "mobile"];
}

export async function detectScreenRegions(templatePath: string): Promise<{
  config: TemplateConfig;
  regions: DetectedRegion[];
}> {
  const { regions: rawRegions, width, height } =
    await detectCheckerRegions(templatePath);

  let assigned: Partial<Record<ScreenRole, RawRegion>>;
  if (rawRegions.length >= 4) {
    assigned = classifyFour(rawRegions);
  } else if (rawRegions.length === 3) {
    assigned = classifyThree(rawRegions);
  } else {
    throw new Error(
      `Znaleziono ${rawRegions.length} ekranów (oczekiwano 3 lub 4) w ${templatePath}`,
    );
  }

  const screens: Partial<Record<ScreenRole, ScreenRect>> = {};
  for (const [role, region] of Object.entries(assigned) as [
    ScreenRole,
    RawRegion,
  ][]) {
    screens[role] = toScreenRect(region);
  }

  const id = basename(templatePath).replace(/\.[^.]+$/, "");
  const config: TemplateConfig = {
    id,
    file: basename(templatePath),
    width,
    height,
    screens,
    layerOrder: layerOrderForScreens(assigned),
  };

  const regions: DetectedRegion[] = (
    Object.entries(assigned) as [ScreenRole, RawRegion][]
  ).map(([role, r]) => ({ role, ...r }));

  return { config, regions };
}

export async function buildAutoTemplateConfig(
  templatePath: string,
  deviceCount = 4,
): Promise<TemplateConfig> {
  const { regions, width, height } = await detectCheckerRegions(templatePath);
  const assigned = classifyByDeviceCount(regions, deviceCount);
  const screens: Partial<Record<ScreenRole, ScreenRect>> = {};
  for (const [role, region] of Object.entries(assigned) as [
    ScreenRole,
    RawRegion,
  ][]) {
    screens[role] = toScreenRect(region);
  }
  return {
    id: basename(templatePath).replace(/\.[^.]+$/, ""),
    file: basename(templatePath),
    width,
    height,
    screens,
    layerOrder: layerOrderForScreens(assigned),
  };
}
