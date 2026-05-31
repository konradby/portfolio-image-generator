import type { ViewportPreset } from "./templates/types.js";

/** Wspólne rozmiary screenshotów (niezależne od szablonu mockupu). */
export const DEVICE_VIEWPORTS: Record<
  ViewportPreset,
  { width: number; height: number }
> = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  "desktop",
  "tablet",
  "mobile",
];
