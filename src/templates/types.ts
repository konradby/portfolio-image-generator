export type ViewportPreset = "desktop" | "tablet" | "mobile";

export type ScreenRole = "monitor" | "laptop" | "tablet" | "mobile";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  id: string;
  file: string;
  width: number;
  height: number;
  /** Tylko ekrany obecne w tym szablonie. */
  screens: Partial<Record<ScreenRole, ScreenRect>>;
  /** Kolejność nakładania (od spodu). */
  layerOrder: ScreenRole[];
}

export function templateScreenRoles(config: TemplateConfig): ScreenRole[] {
  return config.layerOrder.filter((role) => config.screens[role] != null);
}
