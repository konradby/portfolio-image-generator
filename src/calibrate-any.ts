import sharp from "sharp";
import { resolve } from "node:path";
import { detectScreenRegions } from "./templates/auto-config.js";

const file = process.argv[2] ?? "src/templates/template_02.png";
const path = resolve(file);
const meta = await sharp(path).metadata();
console.log(`Plik: ${path}`);
console.log(`Rozmiar: ${meta.width}×${meta.height}`);

const { config, regions } = await detectScreenRegions(path);
console.log("\nRegiony:");
for (const r of regions) {
  console.log(
    `  ${r.role} x=${r.x} y=${r.y} w=${r.w} h=${r.h} area=${r.area}`,
  );
}
console.log("\nKonfiguracja screens:");
console.log(JSON.stringify(config.screens, null, 2));
