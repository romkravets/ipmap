// ── Globe types ───────────────────────────────────────────────────────────────

export type GlobeMode = "auto" | "free" | "follow";

export interface TweakValues {
  rotationSpeed: number;
  showTerminator: boolean;
  showSunMarker: boolean;
  markerPulse: boolean;
  timeOffset: number;
}

// ── App state ─────────────────────────────────────────────────────────────────

export interface AppState {
  globeMode: GlobeMode;
  terminalMode: boolean;
  tweaks: TweakValues;
}

// ── IPv4 data types ───────────────────────────────────────────────────────────

export interface CountryAlloc {
  cc: string;
  name: string;
  ipCount: number;
  lat: number;
  lng: number;
}

export interface IpBlock {
  start: string;
  size: number;
}
