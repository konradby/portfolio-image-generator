export type ViewportPreset = "desktop" | "tablet" | "mobile";

export type ScreenRole = "monitor" | "laptop" | "tablet" | "mobile";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Margines wewnętrzny (px) — mniejszy obszar na screenshot. */
  inset?: number;
  /** Domyślnie cover. */
  fit?: "cover" | "contain";
}

/** Prostokąt urządzenia z ramką — zasłania ekrany warstw z tyłu. */
export interface DeviceOccluder {
  bounds: ScreenRect;
  /** Urządzenie na pierwszym planie (nie blokuj własnego ekranu). */
  exceptRole: ScreenRole;
}

export interface TemplateConfig {
  id: string;
  file: string;
  width: number;
  height: number;
  screens: Partial<Record<ScreenRole, ScreenRect>>;
  layerOrder: ScreenRole[];
  occluders?: DeviceOccluder[];
}

export function templateScreenRoles(config: TemplateConfig): ScreenRole[] {
  return config.layerOrder.filter((role) => config.screens[role] != null);
}
