// ── Globe types ───────────────────────────────────────────────────────────────

export type GlobeMode = "auto" | "free" | "follow";

export interface TweakValues {
  rotationSpeed: number;
  autoRotate: boolean;
  showTerminator: boolean;
  showSunMarker: boolean;
  markerPulse: boolean;
  timeOffset: number;
  satAltExaggerate: boolean;
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

// ── Infrastructure layer types ────────────────────────────────────────────────

export interface SubmarineCable {
  id: string;
  name: string;
  color: string;
  // each segment is an array of [lat, lng] pairs (already swapped from GeoJSON [lng,lat])
  segments: Array<Array<[number, number]>>;
}

export interface DataCenter {
  id: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure' | 'equinix' | 'other';
  lat: number;
  lng: number;
  city: string;
  country: string;
}

export interface IxPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  netCount: number;
}

export type InfraHoverInfo =
  | { kind: 'datacenter'; item: DataCenter }
  | { kind: 'ixp'; item: IxPoint }
  | { kind: 'satellite'; item: SatHoverItem };

// Групи супутників (CelesTrak)
export type SatelliteGroup = 'stations' | 'starlink' | 'oneweb' | 'gps-ops' | 'galileo' | 'weather';

// Стиснутий OMM-запис: лише поля, потрібні для SGP4
export interface SatOmm {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export interface SatPosition {
  lat: number;
  lng: number;
  altKm: number;
}

export interface SatHoverItem {
  name: string;
  noradId: number;
  altKm: number;
  speedKmS: number;
}
