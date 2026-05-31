import { basename } from "node:path";
import type { TemplateConfig, ScreenRole } from "./types.js";
import type { RawRegion } from "./region-types.js";
import { detectCheckerRegions } from "./detect-regions.js";

export interface DetectedRegion extends RawRegion {
  role: ScreenRole;
}

function toScreenRect(r: RawRegion) {
  return { x: r.x, y: r.y, width: r.w, height: r.h };
}

function classifyFour(regions: RawRegion[]): Partial<Record<ScreenRole, RawRegion>> {
  const sorted = [...regions].sort((a, b) => b.area - a.area);
  const monitor = sorted[0]!;
  const mobile = sorted.reduce((a, b) => (a.area < b.area ? a : b))!;
  const rest = sorted.filter((r) => r !== monitor && r !== mobile);
  const portrait = rest.filter((r) => r.w / r.h < 1);
  const tablet =
    portrait.sort((a, b) => b.area - a.area)[0] ??
    rest.sort((a, b) => b.area - a.area)[0]!;
  const laptop = rest.find((r) => r !== tablet) ?? sorted[1]!;
  return { monitor, laptop, tablet, mobile };
}

/** Monitor + tablet (lewo) + telefon (prawo), bez laptopa. */
function classifyThree(regions: RawRegion[]): Partial<Record<ScreenRole, RawRegion>> {
  const sorted = [...regions].sort((a, b) => b.area - a.area);
  const monitor = sorted[0]!;
  const side = sorted.slice(1);
  if (side.length < 2) {
    throw new Error("Szablon 3-urządzeniowy wymaga tabletu i telefonu obok monitora.");
  }
  const [left, right] = side[0]!.cx <= side[1]!.cx ? side : [side[1], side[0]];
  return { monitor, tablet: left!, mobile: right! };
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
  const layerOrder = layerOrderForScreens(assigned);

  const config: TemplateConfig = {
    id,
    file: basename(templatePath),
    width,
    height,
    screens,
    layerOrder,
  };

  const regions: DetectedRegion[] = (
    Object.entries(assigned) as [ScreenRole, RawRegion][]
  ).map(([role, r]) => ({ role, ...r }));

  return { config, regions };
}

export async function buildAutoTemplateConfig(
  templatePath: string,
): Promise<TemplateConfig> {
  const { config } = await detectScreenRegions(templatePath);
  return config;
}
