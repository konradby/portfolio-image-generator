#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  generatePortfolioImage,
  compositeSelectedTemplate,
} from "./generate.js";
import { getAllTemplates } from "./templates/index.js";

await yargs(hideBin(process.argv))
  .scriptName("portfolio-image-generator")
  .usage("$0 <url> [opcje]")
  .command(
    "$0 <url>",
    "Screeny strony (jeśli brak) + mockup dla wybranego szablonu",
    (y) =>
      y
        .positional("url", {
          describe: "Adres publicznej strony (np. https://example.com)",
          type: "string",
          demandOption: true,
        })
        .option("screenshots", {
          alias: "s",
          describe: "Katalog na screenshoty per-maska (mask-<key>.png)",
          type: "string",
        })
        .option("template", {
          alias: "t",
          describe: "ID szablonu (domyślnie template_02)",
          type: "string",
          default: "template_02",
        }),
    async (argv) => {
      await generatePortfolioImage({
        url: argv.url,
        screenshotsDir: argv.screenshots,
        templateId: argv.template,
      });
    },
  )
  .command(
    "recomposite <slug>",
    "Złóż mockup z istniejących screenshotów (jeden szablon)",
    (y) =>
      y
        .positional("slug", {
          describe: "Slug katalogu w output/ (np. y.co)",
          type: "string",
          demandOption: true,
        })
        .option("template", {
          alias: "t",
          describe: "ID szablonu (domyślnie template_02)",
          type: "string",
          default: "template_02",
        }),
    async (argv) => {
      const templates = await getAllTemplates();
      console.log(`Szablony: ${templates.map((t) => t.id).join(", ")}`);
      await compositeSelectedTemplate(argv.slug, argv.template);
    },
  )
  .command("templates", "Lista dostępnych szablonów", async () => {
    const templates = await getAllTemplates();
    console.log("Szablony:", templates.map((t) => t.id).join(", "));
  })
  .demandCommand(1)
  .strict()
  .help()
  .parse();
