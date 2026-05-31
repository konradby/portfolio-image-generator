#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  generatePortfolioImage,
  compositeAllTemplates,
} from "./generate.js";
import { getAllTemplates } from "./templates/index.js";

await yargs(hideBin(process.argv))
  .scriptName("portfolio-image-generator")
  .usage("$0 <url> [opcje]")
  .command(
    "$0 <url>",
    "Screeny strony (jeśli brak) + mockup dla każdego szablonu w src/templates",
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
        }),
    async (argv) => {
      await generatePortfolioImage({
        url: argv.url,
        screenshotsDir: argv.screenshots,
      });
    },
  )
  .command(
    "recomposite <slug>",
    "Złóż mockupy ze istniejących screenshotów (wszystkie szablony)",
    (y) =>
      y.positional("slug", {
        describe: "Slug katalogu w output/ (np. y.co)",
        type: "string",
        demandOption: true,
      }),
    async (argv) => {
      const templates = await getAllTemplates();
      console.log(`Szablony: ${templates.map((t) => t.id).join(", ")}`);
      await compositeAllTemplates(argv.slug);
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
