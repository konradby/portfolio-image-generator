import type { TemplateConfig } from "./types.js";

/** 3 urządzenia (1619×972). Współrzędne: npm run calibrate:any */
export const template02: TemplateConfig = {
  id: "template_02",
  file: "template_02.png",
  width: 1619,
  height: 972,
  screens: {
    monitor: { x: 493, y: 177, width: 758, height: 607, fit: "cover" },
    tablet: { x: 297, y: 344, width: 300, height: 431 },
    mobile: { x: 1217, y: 475, width: 144, height: 314 },
  },
  layerOrder: ["monitor", "tablet", "mobile"],
};
