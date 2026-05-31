/**
 * Kalibracja: wykrywa regiony szachownicy i proponuje współrzędne.
 * Użyj wyniku w template_XX.ts (pola screens).
 */
import { resolve } from "node:path";
import sharp from "sharp";
import { detectCheckerRegions } from "./templates/detect-regions.js";
import {
  classifyFour,
  classifyThree,
} from "./templates/region-classify.js";

const file = resolve(process.argv[2] ?? "src/templates/template_01.jpg");
const meta = await sharp(file).metadata();
console.log(`Plik: ${file}`);
console.log(`Rozmiar: ${meta.width}×${meta.height}`);

const { regions, width } = await detectCheckerRegions(file);
console.log(`\nSurowe regiony (${regions.length}):`);
for (const r of regions) {
  console.log(
    `  x=${r.x} y=${r.y} w=${r.w} h=${r.h} area=${r.area} ratio=${(r.w / r.h).toFixed(2)}`,
  );
}

if (regions.length >= 4) {
  const a = classifyFour(regions);
  console.log("\nPrzypisanie (4 urządzenia):");
  for (const [role, r] of Object.entries(a)) {
    console.log(
      `  ${role}: { x: ${r!.x}, y: ${r!.y}, width: ${r!.w}, height: ${r!.h} },`,
    );
  }
} else if (regions.length === 3) {
  const a = classifyThree(regions);
  console.log("\nPrzypisanie (3 urządzenia):");
  for (const [role, r] of Object.entries(a)) {
    console.log(
      `  ${role}: { x: ${r!.x}, y: ${r!.y}, width: ${r!.w}, height: ${r!.h} },`,
    );
  }
} else {
  console.warn(
    "\nZa mało regionów — doprecyzuj prostokąty ręcznie w template_XX.ts",
  );
}

void width;
