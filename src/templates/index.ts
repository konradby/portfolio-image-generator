import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TemplateConfig } from "./types.js";
import { template01 } from "./template_01.js";
import { template02 } from "./template_02.js";
import { buildAutoTemplateConfig } from "./auto-config.js";

const templatesDir = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_MODULE_RE = /^template_[\w-]+\.ts$/;
const TEMPLATE_IMAGE_RE = /^template_[\w-]+\.(jpg|jpeg|png|webp)$/i;

const registered: Record<string, TemplateConfig> = {
  template_01: template01,
  template_02: template02,
};

let cache: TemplateConfig[] | null = null;

function isTemplateConfig(value: unknown): value is TemplateConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as TemplateConfig;
  return (
    typeof v.id === "string" &&
    typeof v.file === "string" &&
    v.screens != null &&
    Array.isArray(v.layerOrder) &&
    v.layerOrder.length > 0
  );
}

function configFromModule(mod: Record<string, unknown>): TemplateConfig | null {
  if (isTemplateConfig(mod.default)) return mod.default;
  for (const value of Object.values(mod)) {
    if (isTemplateConfig(value)) return value;
  }
  return null;
}

export async function getAllTemplates(): Promise<TemplateConfig[]> {
  if (cache) return cache;

  const byId = new Map<string, TemplateConfig>(
    Object.entries(registered),
  );

  for (const file of readdirSync(templatesDir).filter((f) =>
    TEMPLATE_MODULE_RE.test(f),
  )) {
    const moduleUrl = pathToFileURL(join(templatesDir, file)).href;
    const mod = (await import(moduleUrl)) as Record<string, unknown>;
    const config = configFromModule(mod);
    if (config) {
      byId.set(config.id, config);
    }
  }

  for (const file of readdirSync(templatesDir).filter((f) =>
    TEMPLATE_IMAGE_RE.test(f),
  )) {
    const id = file.replace(/\.[^.]+$/i, "");
    if (byId.has(id)) continue;

    const imagePath = join(templatesDir, file);
    console.log(`Szablon "${id}" — wykrywam ekrany z ${file}…`);
    const config = await buildAutoTemplateConfig(imagePath);
    byId.set(config.id, config);
  }

  const list = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

  if (list.length === 0) {
    throw new Error("Brak szablonów w src/templates/");
  }

  cache = list;
  return list;
}

export function getTemplate(id: string): TemplateConfig {
  const list = cache ?? Object.values(registered);
  const config = list.find((t) => t.id === id);
  if (!config) {
    const available = list.map((t) => t.id).join(", ") || "(brak)";
    throw new Error(`Nieznany szablon "${id}". Dostępne: ${available}`);
  }
  return config;
}

export function resolveTemplatePath(template: TemplateConfig): string {
  return join(templatesDir, template.file);
}

export function listTemplates(): string[] {
  return (cache ?? Object.values(registered)).map((t) => t.id);
}

export function clearTemplateCache(): void {
  cache = null;
}
