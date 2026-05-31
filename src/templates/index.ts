import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TemplateConfig } from "./types.js";
import { template01 } from "./template_01.js";

const templatesDir = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_MODULE_RE = /^template_[\w-]+\.ts$/;

const registered: Record<string, TemplateConfig> = {
  template_01: template01,
};

let cache: TemplateConfig[] | null = null;

function isTemplateConfig(value: unknown): value is TemplateConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as TemplateConfig;
  return (
    typeof v.id === "string" &&
    typeof v.file === "string" &&
    v.screens != null &&
    Array.isArray(v.layerOrder)
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

  const list = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

  const templateFiles = readdirSync(templatesDir);
  for (const config of list) {
    if (!templateFiles.includes(config.file)) {
      console.warn(
        `Szablon "${config.id}": brak obrazu ${config.file} w src/templates/`,
      );
    }
  }

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
