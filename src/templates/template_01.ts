import type { TemplateConfig } from "./types.js";

/** Plik: src/templates/template_01.jpg. Współrzędne z npm run calibrate (1633×980). */
export const template01: TemplateConfig = {
  id: "template_01",
  file: "template_01.jpg",
  width: 1633,
  height: 980,
  viewports: {
    desktop: { width: 1920, height: 1080 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 390, height: 844 },
  },
  screens: {
    monitor: { x: 588, y: 203, width: 712, height: 403 },
    laptop: { x: 130, y: 435, width: 508, height: 318 },
    tablet: { x: 1237, y: 455, width: 245, height: 327 },
    mobile: { x: 1440, y: 581, width: 103, height: 219 },
  },
  layerOrder: ["monitor", "laptop", "tablet", "mobile"],
};
