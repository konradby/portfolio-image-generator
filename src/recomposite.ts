/** Składanie mockupów dla wszystkich szablonów z istniejących screenshotów. */
import { compositeAllTemplates } from "./generate.js";

const slug = process.argv[2] ?? "y.co";
const t0 = Date.now();
const paths = await compositeAllTemplates(slug);
console.log(`Gotowe (${Date.now() - t0} ms), ${Object.keys(paths).length} plików`);
