#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { generatePortfolioImage } from "./generate.js";
import { listTemplates } from "./templates/index.js";

await yargs(hideBin(process.argv))
  .scriptName("portfolio-image-generator")
  .usage("$0 <url> [opcje]")
  .command(
    "$0 <url>",
    "Zrób 3 screeny strony i złóż je w szablon mockupu",
    (y) =>
      y
        .positional("url", {
          describe: "Adres publicznej strony (np. https://example.com)",
          type: "string",
          demandOption: true,
        })
        .option("template", {
          alias: "t",
          describe: "ID szablonu",
          type: "string",
          default: "template_01",
        })
        .option("output", {
          alias: "o",
          describe: "Katalog na screeny pośrednie",
          type: "string",
        }),
    async (argv) => {
      await generatePortfolioImage({
        url: argv.url,
        templateId: argv.template,
        outputDir: argv.output,
      });
    },
  )
  .command("templates", "Lista dostępnych szablonów", () => {
    console.log("Szablony:", listTemplates().join(", "));
  })
  .demandCommand(1)
  .strict()
  .help()
  .parse();
