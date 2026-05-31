import sharp from "sharp";
import { template01 } from "./templates/template_01.js";
import { resolveTemplatePath } from "./templates/index.js";
import { clearMaskCache, loadTemplateMasks } from "./templates/screen-masks.js";

async function maskBuffers() {
  clearMaskCache();
  const m = await loadTemplateMasks(resolveTemplatePath(template01), template01);
  const out: Record<string, { bbox: { x: number; y: number; width: number; height: number }; data: Buffer; width: number; height: number }> = {};
  for (const role of template01.layerOrder) {
    const layer = m.screens[role];
    if (!layer) continue;
    const raw = await sharp(layer.mask).raw().toBuffer({ resolveWithObject: true });
    out[role] = {
      bbox: layer.bbox,
      data: raw.data,
      width: raw.info.width!,
      height: raw.info.height!,
    };
  }
  return out;
}

function coveredAt(
  x: number,
  y: number,
  layers: Record<string, { bbox: { x: number; y: number; width: number; height: number }; data: Buffer; width: number; height: number }>,
) {
  for (const role of Object.keys(layers)) {
    const layer = layers[role]!;
    const lx = x - layer.bbox.x;
    const ly = y - layer.bbox.y;
    if (lx < 0 || ly < 0 || lx >= layer.width || ly >= layer.height) continue;
    if (layer.data[ly * layer.width + lx] > 0) return role;
  }
  return null;
}

async function run() {
  const layers = await maskBuffers();
  const strips = [
    { name: "laptop-right", x1: 620, y1: 410, x2: 638, y2: 620 },
    { name: "tablet-left", x1: 1228, y1: 442, x2: 1244, y2: 790 },
    { name: "mobile-left", x1: 1438, y1: 572, x2: 1448, y2: 810 },
  ];
  for (const s of strips) {
    let covered = 0;
    let total = 0;
    const owners: Record<string, number> = {};
    for (let y = s.y1; y < s.y2; y++) {
      for (let x = s.x1; x < s.x2; x++) {
        total++;
        const owner = coveredAt(x, y, layers);
        if (owner) {
          covered++;
          owners[owner] = (owners[owner] ?? 0) + 1;
        }
      }
    }
    console.log(s.name, { covered, total, ratio: covered / total, owners });
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

