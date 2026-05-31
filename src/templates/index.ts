import type { TemplateConfig } from "./types.js";
import { template01 } from "./template_01.js";

const templates: Record<string, TemplateConfig> = {
  template_01: template01,
};

export function getTemplate(id: string): TemplateConfig {
  const config = templates[id];
  if (!config) {
    const available = Object.keys(templates).join(", ");
    throw new Error(`Nieznany szablon "${id}". Dostępne: ${available}`);
  }
  return config;
}

export function listTemplates(): string[] {
  return Object.keys(templates);
}
