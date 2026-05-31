export type ViewportPreset = "desktop" | "tablet" | "mobile";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  id: string;
  file: string;
  /** Rozmiar źródłowego pliku szablonu (px). */
  width: number;
  height: number;
  screens: {
    /** Główny monitor (środek) – desktop */
    monitor: ScreenRect;
    /** Laptop po lewej – ten sam screenshot co desktop */
    laptop: ScreenRect;
    tablet: ScreenRect;
    mobile: ScreenRect;
  };
  /** Kolejność nakładania warstw (od spodu). */
  layerOrder: Array<"monitor" | "laptop" | "tablet" | "mobile">;
}
