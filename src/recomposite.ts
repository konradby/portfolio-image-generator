/** Składanie mockupu dla wybranego szablonu z istniejących screenshotów. */
import { compositeSelectedTemplate } from "./generate.js";

const args = process.argv.slice(2);
let slug = "y.co";
let templateId = "template_02";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--template" || arg === "-t") {
    if (args[i + 1]) {
      templateId = args[i + 1];
      i++;
    }
    continue;
  }
  if (!arg.startsWith("-")) {
    slug = arg;
  }
}

const t0 = Date.now();
const outputPath = await compositeSelectedTemplate(slug, templateId);
console.log(`Gotowe (${Date.now() - t0} ms): ${outputPath}`);
