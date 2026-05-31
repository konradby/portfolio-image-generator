import type { TemplateConfig } from "./types.js";

/** Plik: src/templates/template_01.jpg (1633×980). Współrzędne: npm run calibrate:any */
export const template01: TemplateConfig = {
  id: "template_01",
  file: "template_01.jpg",
  width: 1633,
  height: 980,
  screens: {
    monitor: { x: 588, y: 203, width: 712, height: 403, inset: 1 },
    laptop: { x: 130, y: 435, width: 508, height: 318, inset: 1 },
    tablet: { x: 1237, y: 455, width: 245, height: 327, inset: 1 },
    mobile: { x: 1440, y: 581, width: 103, height: 219, inset: 1 },
  },
  layerOrder: ["monitor", "laptop", "tablet", "mobile"],
};
