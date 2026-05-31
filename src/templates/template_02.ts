import type { TemplateConfig } from "./types.js";

/** 3 urządzenia (1619×972). Współrzędne: npm run calibrate:any */
export const template02: TemplateConfig = {
  id: "template_02",
  file: "template_02.png",
  width: 1619,
  height: 972,
  screens: {
    monitor: {
      x: 498,
      y: 188,
      width: 724,
      height: 552,
      inset: 6,
      fit: "cover",
    },
    tablet: { x: 297, y: 344, width: 300, height: 431 },
    mobile: { x: 1217, y: 475, width: 144, height: 314, inset: 4 },
  },
  layerOrder: ["monitor", "tablet", "mobile"],
  occluders: [
    {
      exceptRole: "tablet",
      bounds: { x: 278, y: 318, width: 352, height: 472 },
    },
    {
      exceptRole: "mobile",
      bounds: { x: 1195, y: 448, width: 215, height: 368 },
    },
  ],
};
