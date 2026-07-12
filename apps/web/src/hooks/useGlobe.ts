"use client";

import { TWEAK_DEFAULTS } from "@/lib/constants";
import { blockMarkerVisual } from "@/lib/markerScale";
import { getSunLatLng } from "@/lib/sun";
import type { GlobeMode, TweakValues, CountryAlloc, IpBlock, SubmarineCable, DataCenter, IxPoint, InfraHoverInfo } from "@ipmap/types";
import { useEffect, useRef } from "react";
import * as THREE from "three";

// ── Helpers ───────────────────────────────────────────────────────────────────
function latLngToVec3(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function greatCircleArc(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  peakAlt: number,
  segments = 64,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = new THREE.Vector3().lerpVectors(p1, p2, t).normalize();
    const alt = 1 + peakAlt * Math.sin(t * Math.PI);
    pts.push(pt.multiplyScalar(alt));
  }
  return pts;
}

// ── Globe context shared with React overlay ───────────────────────────────────
interface GlobeProject {
  (lat: number, lng: number): { x: number; y: number; visible: boolean };
}

declare global {
  interface Window {
    globeProject?: GlobeProject;
    globeState?: {
      setMode: (m: GlobeMode) => void;
      mode: GlobeMode;
    };
    globeCamDist?: number;
    globeLayerGroups?: Record<string, { visible: boolean }>;
  }
}

// ── Vertex / Fragment shaders ─────────────────────────────────────────────────
const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    // Use world-space normals so sunDir (world-space) dot product is correct
    // regardless of camera orbit position. modelMatrix is identity for the
    // non-rotating globe, so mat3(modelMatrix) * normal = object-space normal
    // = world-space normal.
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D dayTex;
  uniform sampler2D nightTex;
  uniform vec3 sunDir;
  uniform bool hasDayTex;
  uniform bool hasNightTex;
  uniform float u_declination; // solar declination in degrees (-23.45..+23.45)
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 S = normalize(sunDir);
    float d = dot(N, S);

    float dayBlend   = smoothstep(-0.05, 0.15, d);
    float nightBlend = smoothstep(0.08, -0.08, d);

    // Seasonal calculations (used to modulate polar whiteness and tint)
    // vUv.y: 0=south pole, 1=north pole. lat_frac: -1..+1
    float lat_frac = (vUv.y - 0.5) * 2.0;              // -1(S) .. +1(N)
    float dec_norm  = u_declination / 23.45;           // -1..+1 (neg=SH summer)
    // seasonal: +1 where it's summer on this hemisphere, -1 where it's winter
    float seasonal  = lat_frac * dec_norm;             // +1 summer side, -1 winter side
    // winterFactor: 1.0 on winter side, 0.0 on summer side
    float winterFactor = clamp(-seasonal, 0.0, 1.0);

    // Procedural fallback land mask (used when textures are absent)
    float lng = (vUv.x - 0.5) * 6.28318;
    float lat = (vUv.y - 0.5) * 3.14159;
    float land  = sin(lng * 1.8) * cos(lat * 2.2) * 0.5
                + sin(lng * 3.1 + 0.9) * cos(lat * 1.4 + 0.5) * 0.35
                + sin(lng * 0.9 - 1.2) * cos(lat * 3.0 - 0.3) * 0.25;
    land = smoothstep(0.18, 0.42, land);
    float polar = smoothstep(0.75, 0.95, abs(vUv.y * 2.0 - 1.0));

    vec4 day, night;
    if (hasDayTex) {
      day = texture2D(dayTex, vUv);
    } else {
      vec3 dayRGB = mix(vec3(0.04, 0.16, 0.42), vec3(0.14, 0.30, 0.12), land);
      dayRGB = mix(dayRGB, vec3(0.75, 0.83, 0.88), polar * (0.15 + 0.85 * winterFactor));
      day = vec4(dayRGB, 1.0);
    }
    if (hasNightTex) {
      night = texture2D(nightTex, vUv);
      night.rgb = night.rgb * 3.5 * nightBlend;
    } else {
      night = vec4(mix(vec3(0.01, 0.03, 0.10), vec3(0.22, 0.18, 0.04), land) * nightBlend * 2.0, 1.0);
    }

    vec3 col = mix(night.rgb, day.rgb, dayBlend);
    float termGlow = exp(-abs(d) * 12.0) * 0.22;
    col = mix(col, vec3(0.85, 0.42, 0.12), termGlow * (1.0 - dayBlend * 0.7));
    col += (1.0 - nightBlend) * (1.0 - dayBlend) * 0.012;

    // Subtle season tint: warm in summer hemisphere, cool in winter hemisphere.
    float warmTint  = clamp(seasonal, 0.0, 1.0) * 0.055 * dayBlend;
    float coolTint  = clamp(-seasonal, 0.0, 1.0) * 0.04 * dayBlend;
    col += vec3(warmTint * 0.9, warmTint * 0.4, 0.0);   // warm amber in summer hemi
    col -= vec3(coolTint * 0.1, coolTint * 0.1, 0.0);   // very subtle desaturate in winter

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 cameraWorldPos;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    // Rim: angle between surface normal and direction to camera (world-space)
    vec3 toCamera = normalize(cameraWorldPos - vWorldPos);
    float rim = 1.0 - abs(dot(vNormal, toCamera));
    rim = pow(rim, 2.8);
    float day = clamp(dot(normalize(vNormal), normalize(sunDir)) * 1.5 + 0.5, 0.0, 1.0);
    vec3 dayColor   = vec3(0.25, 0.55, 0.95);
    vec3 nightColor = vec3(0.05, 0.08, 0.22);
    vec3 col = mix(nightColor, dayColor, day);
    gl_FragColor = vec4(col * rim, rim * 0.75);
  }
`;

// ── OrbitControls import shim ─────────────────────────────────────────────────
// We import from the three/examples module directly to allow tree-shaking
async function loadOrbitControls() {
  const { OrbitControls } =
    await import("three/examples/jsm/controls/OrbitControls.js");
  return OrbitControls;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export interface UseGlobeOptions {
  mode: GlobeMode;
  tweaks: TweakValues;
  countries?: CountryAlloc[];
  selectedCountry?: string | null;
  countryData?: CountryAlloc | null;
  countryBlocks?: IpBlock[];
  selectedBlock?: IpBlock | null;
  onCountryClick?: (cc: string) => void;
  onBlockClick?: (block: IpBlock) => void;
  onBlockHover?: (block: IpBlock | null, x: number, y: number) => void;
  onInfraHover?: (info: InfraHoverInfo | null, x: number, y: number) => void;
  cables?: SubmarineCable[];
  dataCenters?: DataCenter[];
  ixps?: IxPoint[];
}

export function useGlobe(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseGlobeOptions,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let mounted = true;

    (async () => {
      const OrbitControls = await loadOrbitControls();
      if (!mounted) return;

      // ── Renderer ──────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        42,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.set(0, 0, 2.8);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 1.5;
      controls.maxDistance = 6;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;

      // ── Starfield ─────────────────────────────────────────────────────────
      const starPos = new Float32Array(3000 * 3);
      for (let i = 0; i < starPos.length; i++)
        starPos[i] = (Math.random() - 0.5) * 600;
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      scene.add(
        new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.6,
          }),
        ),
      );

      // ── Earth uniforms ────────────────────────────────────────────────────
      const uniforms = {
        dayTex: { value: null as THREE.Texture | null },
        nightTex: { value: null as THREE.Texture | null },
        sunDir: { value: new THREE.Vector3(1, 0.2, 0.3).normalize() },
        hasDayTex:  { value: false },
        hasNightTex: { value: false },
        u_declination: { value: 0.0 },
      };

      // ── Globe sphere ──────────────────────────────────────────────────────
      const globeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 256, 256),
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms,
          // Push globe slightly back in depth buffer so overlays at r=1.004
          // don't z-fight with the surface
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      globeMesh.renderOrder = 0;
      scene.add(globeMesh);
      window.dispatchEvent(new CustomEvent("globe-load-progress", { detail: { pct: 20 } }));

      const roadGroup = new THREE.Group();
      scene.add(roadGroup);

      const roadURLs = [
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_roads.geojson",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_roads.geojson",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_roads.geojson",
      ];

      (async () => {
        // Try a local, pre-simplified roads GeoJSON first (generated by scripts/download-roads.mjs)
        try {
          const localRes = await fetch("/data/ne_roads_simplified.geojson");
          if (localRes && localRes.ok) {
            const geo = await localRes.json();
            if (mounted) {
              const pts: THREE.Vector3[] = [];
              for (const feature of geo.features) {
                if (!feature.geometry) continue;
                const { type, coordinates } = feature.geometry as any;
                const lines: number[][][] =
                  type === "MultiLineString"
                    ? (coordinates as number[][][])
                    : [coordinates as number[][]];
                for (const line of lines) {
                  for (let i = 0; i < line.length - 1; i++) {
                    pts.push(
                      latLngToVec3(line[i][1], line[i][0], 1.002),
                      latLngToVec3(line[i + 1][1], line[i + 1][0], 1.002),
                    );
                  }
                }
              }
              const roadLines = new THREE.LineSegments(
                new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({
                  color: 0xd0d0d0,
                  transparent: true,
                  opacity: 0.7,
                  depthWrite: false,

                  depthTest: true,
                }),
              );
              roadLines.renderOrder = 60;
              roadGroup.add(roadLines);
            }
            return;
          }
        } catch (e) {
          // ignore and try CDN fallbacks below
        }

        for (const url of roadURLs) {
          try {
            const res = await fetch(url);
            if (!res || !res.ok) continue;
            const geo = await res.json();
            if (!mounted) return;
            const pts: THREE.Vector3[] = [];
            for (const feature of geo.features) {
              if (!feature.geometry) continue;
              const { type, coordinates } = feature.geometry as any;
              const lines: number[][][] =
                type === "MultiLineString"
                  ? (coordinates as number[][][])
                  : [coordinates as number[][]];
              for (const line of lines) {
                for (let i = 0; i < line.length - 1; i++) {
                  pts.push(
                    latLngToVec3(line[i][1], line[i][0], 1.002),
                    latLngToVec3(line[i + 1][1], line[i + 1][0], 1.002),
                  );
                }
              }
            }
            const roadLines = new THREE.LineSegments(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({
                color: 0xd0d0d0,
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                depthTest: true,
              }),
            );
            roadLines.renderOrder = 60;
            roadGroup.add(roadLines);
            break;
          } catch (e) {
            continue;
          }
        }
      })().catch(() => {});

      // Texture loader with POT conversion, mipmaps and anisotropic filtering.
      const maxAnisotropy =
        renderer.capabilities &&
        typeof renderer.capabilities.getMaxAnisotropy === "function"
          ? renderer.capabilities.getMaxAnisotropy()
          : 1;
      const loader = new THREE.TextureLoader();

      const dayURLs = [
        "/textures/earth-day-8k.jpg",
        "/textures/earth-topo-4k.jpg",
        "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
      ];
      const nightURLs = [
        "/textures/earth-night-4k.jpg",
        "https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night-4k.jpg",
        "https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg",
      ];

      function checkTextures(which: "day" | "night") {
        if (which === "day") {
          uniforms.hasDayTex.value = true;
          window.dispatchEvent(new CustomEvent("globe-load-progress", { detail: { pct: 60 } }));
        }
        if (which === "night") {
          uniforms.hasNightTex.value = true;
          window.dispatchEvent(new CustomEvent("globe-load-progress", { detail: { pct: 85 } }));
        }
      }

      function ensurePOTAndSetup(t: THREE.Texture) {
        let tex: THREE.Texture = t;
        const img = t.image as HTMLImageElement | HTMLCanvasElement | null;
        const isPOT = (n: number) => (n & (n - 1)) === 0;
        if (img && typeof (img as HTMLImageElement).width === "number") {
          const w = (img as HTMLImageElement).width;
          const h = (img as HTMLImageElement).height;
          if (!isPOT(w) || !isPOT(h)) {
            const nextPow2 = (n: number) =>
              Math.pow(2, Math.ceil(Math.log2(Math.max(1, n))));
            const nw = Math.min(8192, nextPow2(w));
            const nh = Math.min(8192, nextPow2(h));
            try {
              const canvas = document.createElement("canvas");
              canvas.width = nw;
              canvas.height = nh;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(img as CanvasImageSource, 0, 0, nw, nh);
                const canvasTex = new THREE.CanvasTexture(canvas);
                canvasTex.anisotropy = maxAnisotropy;
                canvasTex.minFilter = THREE.LinearMipmapLinearFilter;
                canvasTex.magFilter = THREE.LinearFilter;
                canvasTex.generateMipmaps = true;
                canvasTex.needsUpdate = true;
                tex = canvasTex;
              }
            } catch (e) {
              tex = t;
            }
          }
        }
        tex.anisotropy = maxAnisotropy;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
      }

      function tryLoad(
        urls: string[],
        uniform: { value: THREE.Texture | null },
        onDone: () => void,
      ) {
        if (!urls || urls.length === 0) {
          onDone();
          return;
        }
        const url = urls[0];
        loader.load(
          url,
          (t) => {
            try {
              const tex = ensurePOTAndSetup(t);
              uniform.value = tex;
            } catch (e) {
              uniform.value = t;
            }
            // small debug message to trace which texture succeeded
            try {
              console.debug("Texture loaded:", url);
            } catch (_) {}
            onDone();
          },
          undefined,
          (_err) => {
            tryLoad(urls.slice(1), uniform, onDone);
          },
        );
      }

      tryLoad(dayURLs,   uniforms.dayTex,   () => checkTextures("day"));
      tryLoad(nightURLs, uniforms.nightTex, () => checkTextures("night"));

      // ── Atmosphere ────────────────────────────────────────────────────────
      const atmoUniforms = {
        sunDir: uniforms.sunDir, // shared reference — same vec3 object
        cameraWorldPos: { value: camera.position.clone() },
      };
      scene.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(1.06, 64, 64),
          new THREE.ShaderMaterial({
            vertexShader: ATMO_VERT,
            fragmentShader: ATMO_FRAG,
            uniforms: atmoUniforms,
            transparent: true,
            side: THREE.FrontSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );

      // ── Terminator ring ───────────────────────────────────────────────────
      const TERM_SEGS = 256;
      const termPositions = new Float32Array((TERM_SEGS + 1) * 3);
      const termGeo = new THREE.BufferGeometry();
      termGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(termPositions, 3),
      );
      const termLine = new THREE.Line(
        termGeo,
        new THREE.LineBasicMaterial({
          color: 0xffa040,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      scene.add(termLine);

      function updateTerminator(sunDir: THREE.Vector3) {
        const u = new THREE.Vector3();
        const v = new THREE.Vector3();
        const up =
          Math.abs(sunDir.y) < 0.99
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);
        u.crossVectors(sunDir, up).normalize();
        v.crossVectors(sunDir, u).normalize();
        const R = 1.014;
        const pos = termGeo.attributes["position"].array as Float32Array;
        for (let i = 0; i <= TERM_SEGS; i++) {
          const a = (i / TERM_SEGS) * Math.PI * 2;
          pos[i * 3 + 0] = (Math.cos(a) * u.x + Math.sin(a) * v.x) * R;
          pos[i * 3 + 1] = (Math.cos(a) * u.y + Math.sin(a) * v.y) * R;
          pos[i * 3 + 2] = (Math.cos(a) * u.z + Math.sin(a) * v.z) * R;
        }
        termGeo.attributes["position"].needsUpdate = true;
      }

      // ── Sun marker ────────────────────────────────────────────────────────
      const sunMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd060 }),
      );
      const sunGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 10, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffaa20,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        }),
      );
      scene.add(sunMarker, sunGlow);

      // ── Country borders (political map) — use land-only boundary lines ───
      // Fetch Natural Earth 'boundary_lines_land' so coastlines are not drawn
      const borderGroup = new THREE.Group();
      scene.add(borderGroup);

      const boundaryURLs = [
        // prefer small (110m) resolution for speed & small download size
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_boundary_lines_land.geojson",
        // fallback to 50m
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_boundary_lines_land.geojson",
      ];

      (async () => {
        for (const url of boundaryURLs) {
          try {
            const res = await fetch(url);
            if (!res || !res.ok) continue;
            const geo = await res.json();
            if (!mounted) return;
            const pts: THREE.Vector3[] = [];
            for (const feature of geo.features) {
              if (!feature.geometry) continue;
              const { type, coordinates } = feature.geometry as any;
              const lines: number[][][] =
                type === "MultiLineString"
                  ? (coordinates as number[][][])
                  : [coordinates as number[][]];
              for (const line of lines) {
                for (let i = 0; i < line.length - 1; i++) {
                  pts.push(
                    latLngToVec3(line[i][1], line[i][0], 1.004),
                    latLngToVec3(line[i + 1][1], line[i + 1][0], 1.004),
                  );
                }
              }
            }
            const geom = new THREE.BufferGeometry().setFromPoints(pts);

            // Halo (outline) — slightly larger radius, drawn first so main line overlays it
            const haloPts = pts.map((p) => p.clone().multiplyScalar(1.008));
            const haloGeom = new THREE.BufferGeometry().setFromPoints(haloPts);
            const haloMat = new THREE.LineBasicMaterial({
              color: 0x000000,
              transparent: true,
              opacity: 0.36,
              depthWrite: false,
              depthTest: true,
            });
            const haloLines = new THREE.LineSegments(haloGeom, haloMat);
            haloLines.renderOrder = 30;
            borderGroup.add(haloLines);

            // Main border — solid red (no dashed style)
            const mat = new THREE.LineBasicMaterial({
              color: 0xff4444,
              transparent: true,
              opacity: 0.95,
              depthWrite: false,

              depthTest: true,
            });
            const borderLines = new THREE.LineSegments(geom, mat);
            borderLines.renderOrder = 31;
            borderGroup.add(borderLines);
            break;
          } catch (e) {
            // try next URL
            continue;
          }
        }
      })().catch(() => {});

      // ── Political country fill overlay ────────────────────────────────────
      // Draws each country polygon on a canvas (equirectangular) then wraps it
      // as a CanvasTexture on a sphere at r=1.001 with low opacity.
      const politicalGroup = new THREE.Group();
      scene.add(politicalGroup);
      const POLITICAL_PALETTE = [
        "#7dba8c", // green
        "#6ea8d8", // blue
        "#d4a84b", // gold
        "#c47fa0", // rose
        "#5fb8b0", // teal
        "#d07848", // terracotta
        "#9a80c8", // purple
        "#88b85a", // lime
        "#c09858", // amber
        "#5888b8", // indigo
        "#b05060", // crimson
        "#4da894", // seafoam
      ];

      function countryColor(name: string): string {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return POLITICAL_PALETTE[h % POLITICAL_PALETTE.length];
      }

      (async () => {
        const urls = [
          "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson",
          "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
        ];
        type Ring = number[][];
        type Poly = Ring[];
        type CountryFeature = {
          properties: { NAME?: string; name?: string };
          geometry: { type: string; coordinates: unknown };
        };

        let features: CountryFeature[] | null = null;

        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const raw = await res.json() as Record<string, unknown>;
            if (Array.isArray(raw["features"])) {
              features = raw["features"] as CountryFeature[];
              break;
            }
          } catch { continue; }
        }
        if (!features || !mounted) return;

        const W = 4096, H = 2048;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        function drawPolygon(rings: Poly, color: string) {
          ctx!.fillStyle = color;
          ctx!.beginPath();
          for (const ring of rings) {
            if (ring.length < 2) continue;
            ctx!.moveTo(((ring[0][0] + 180) / 360) * W, ((90 - ring[0][1]) / 180) * H);
            for (let i = 1; i < ring.length; i++) {
              ctx!.lineTo(((ring[i][0] + 180) / 360) * W, ((90 - ring[i][1]) / 180) * H);
            }
            ctx!.closePath();
          }
          ctx!.fill();
        }

        for (const feature of features) {
          const name = (feature.properties.NAME ?? feature.properties.name ?? "X") as string;
          const color = countryColor(name);
          const { type, coordinates } = feature.geometry as { type: string; coordinates: unknown };
          if (type === "Polygon") {
            drawPolygon(coordinates as Poly, color);
          } else if (type === "MultiPolygon") {
            for (const poly of coordinates as Poly[]) drawPolygon(poly, color);
          }
        }

        if (!mounted) return;
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        const politicalMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1.001, 128, 128),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            blending: THREE.NormalBlending,
          }),
        );
        politicalMesh.renderOrder = 1;
        politicalGroup.add(politicalMesh);
        console.log("[Political] overlay added:", features.length, "countries");
      })().catch((e) => console.error("[Political] failed:", e));

      // ── Rivers (Natural Earth 50m) ────────────────────────────────────────
      interface RiversGeoJSON {
        features: Array<{
          geometry: {
            type: "LineString" | "MultiLineString";
            coordinates: number[][] | number[][][];
          };
        }>;
      }
      const riverGroup = new THREE.Group();
      scene.add(riverGroup);

      fetch(
        "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_rivers_lake_centerlines.geojson",
      )
        .then((r) => r.json())
        .then((geo: RiversGeoJSON) => {
          if (!mounted) return;
          const pts: THREE.Vector3[] = [];
          for (const feature of geo.features) {
            const { type, coordinates } = feature.geometry;
            const lines: number[][][] =
              type === "MultiLineString"
                ? (coordinates as number[][][])
                : [coordinates as number[][]];
            for (const line of lines) {
              for (let i = 0; i < line.length - 1; i++) {
                pts.push(
                  // slightly above globe so rivers appear on top of texture
                  latLngToVec3(line[i][1], line[i][0], 1.003),
                  latLngToVec3(line[i + 1][1], line[i + 1][0], 1.003),
                );
              }
            }
          }
          const riverLines = new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({
              color: 0x3a8fc8, // blue rivers
              transparent: true,
              opacity: 0.75,
              depthWrite: false,
              depthTest: true,
            }),
          );
          riverLines.renderOrder = 40;
          riverGroup.add(riverLines);
        })
        .catch(() => {}); // Gracefully skip if CDN unreachable

      // ── Major railways (Natural Earth simplified with fallbacks) ──────────
      interface RailGeoJSON {
        features: Array<{
          geometry: {
            type: "LineString" | "MultiLineString";
            coordinates: number[][] | number[][][];
          };
        }>;
      }
      const railGroup = new THREE.Group();
      scene.add(railGroup);

      // Try smaller resolutions first to avoid CDN 20MB limit / 403 errors
      const railURLs = [
        // smaller, more compact dataset (50m)
        "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_railroads.geojson",
        // fallback to the lowest resolution if 50m unavailable
        "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_railroads.geojson",
      ];

      (async () => {
        // Try a local, pre-simplified GeoJSON first (generated by scripts/download-railroads.mjs)
        try {
          const localRes = await fetch("/data/ne_railroads_simplified.geojson");
          if (localRes && localRes.ok) {
            const geo: RailGeoJSON = await localRes.json();
            if (mounted) {
              const pts: THREE.Vector3[] = [];
              for (const feature of geo.features) {
                const { type, coordinates } = feature.geometry;
                const lines: number[][][] =
                  type === "MultiLineString"
                    ? (coordinates as number[][][])
                    : [coordinates as number[][]];
                for (const line of lines) {
                  for (let i = 0; i < line.length - 1; i++) {
                    pts.push(
                      latLngToVec3(line[i][1], line[i][0], 1.002),
                      latLngToVec3(line[i + 1][1], line[i + 1][0], 1.002),
                    );
                  }
                }
              }
              const railLines = new THREE.LineSegments(
                new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({
                  color: 0xb06020,
                  transparent: true,
                  opacity: 0.8,
                  depthWrite: false,
                  depthTest: true,
                }),
              );
              railLines.renderOrder = 50;
              railGroup.add(railLines);
            }
            return;
          }
        } catch (e) {
          // ignore and try CDN fallbacks below
        }

        for (const url of railURLs) {
          try {
            const res = await fetch(url);
            if (!res || !res.ok) continue;
            // try to guard against very large responses when headers are available
            const cl = res.headers ? res.headers.get("content-length") : null;
            if (cl && parseInt(cl, 10) > 20 * 1024 * 1024) continue;
            const geo: RailGeoJSON = await res.json();
            if (!mounted) return;
            const pts: THREE.Vector3[] = [];
            for (const feature of geo.features) {
              const { type, coordinates } = feature.geometry;
              const lines: number[][][] =
                type === "MultiLineString"
                  ? (coordinates as number[][][])
                  : [coordinates as number[][]];
              for (const line of lines) {
                for (let i = 0; i < line.length - 1; i++) {
                  pts.push(
                    latLngToVec3(line[i][1], line[i][0], 1.002),
                    latLngToVec3(line[i + 1][1], line[i + 1][0], 1.002),
                  );
                }
              }
            }
            const railLines = new THREE.LineSegments(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({
                color: 0xb06020, // warm brown — railway colour convention
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
                depthTest: true,
              }),
            );
            railLines.renderOrder = 50;
            railGroup.add(railLines);
            break; // loaded successfully — stop trying further URLs
          } catch (e) {
            // try next URL
            continue;
          }
        }
      })().catch(() => {});

      // Roads are handled by the earlier local-first loader (ne_roads_simplified)

      // ── Major shipping / trade routes ─────────────────────────────────────
      const TRADE_LANES: Array<{ waypoints: [number, number][] }> = [
        // Trans-Pacific: Los Angeles → Yokohama
        {
          waypoints: [
            [33.7, -118.2],
            [35, -152],
            [35.5, 139.6],
          ],
        },
        // Asia-Europe via Suez: Shanghai → Rotterdam
        {
          waypoints: [
            [31.2, 121.5],
            [1.3, 103.8],
            [12.8, 43.1],
            [29.9, 32.5],
            [36.8, 10.0],
            [37.9, 23.7],
            [41.0, 28.9],
            [51.9, 4.5],
          ],
        },
        // Trans-Atlantic: New York → Southampton
        {
          waypoints: [
            [40.7, -74.0],
            [47.0, -38.0],
            [50.9, -1.4],
          ],
        },
        // Cape route: Shanghai → Rotterdam around Africa
        {
          waypoints: [
            [31.2, 121.5],
            [-6.0, 39.6],
            [-34.4, 18.5],
            [5.0, -8.0],
            [51.9, 4.5],
          ],
        },
        // Trans-Pacific South: Sydney → Los Angeles
        {
          waypoints: [
            [-33.9, 151.2],
            [-18.0, -155.0],
            [33.7, -118.2],
          ],
        },
        // Americas: Buenos Aires → New York
        {
          waypoints: [
            [-34.6, -58.4],
            [10.5, -66.9],
            [40.7, -74.0],
          ],
        },
      ];

      const tradeMaterials: THREE.LineDashedMaterial[] = [];
      const tradeGroup = new THREE.Group();
      scene.add(tradeGroup);

      TRADE_LANES.forEach((lane) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < lane.waypoints.length - 1; i++) {
          const [la1, ln1] = lane.waypoints[i];
          const [la2, ln2] = lane.waypoints[i + 1];
          pts.push(...greatCircleArc(
            latLngToVec3(la1, ln1, 1.0),
            latLngToVec3(la2, ln2, 1.0),
            0.04,
            48,
          ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({
          color: 0xc8972a,
          dashSize: 0.025,
          gapSize: 0.018,
          linewidth: 1,
          transparent: true,
          opacity: 0.45,
        });
        const line = new THREE.Line(geo, mat);
        (line as unknown as { computeLineDistances(): void }).computeLineDistances();
        tradeGroup.add(line);
        tradeMaterials.push(mat);
      });

      // ── Submarine cables (dynamic) ────────────────────────────────────────
      const cableMaterials: THREE.LineBasicMaterial[] = [];
      const cableGroup = new THREE.Group();
      scene.add(cableGroup);

      function buildCableLayer(cables: SubmarineCable[]) {
        while (cableGroup.children.length) {
          const c = cableGroup.children[0] as THREE.Line;
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
          cableGroup.remove(c);
        }
        cableMaterials.length = 0;
        for (const cable of cables) {
          const color = new THREE.Color(cable.color || '#22d3ee');
          for (const seg of cable.segments) {
            if (seg.length < 2) continue;
            const pts = seg.map(([lat, lng]) => latLngToVec3(lat, lng, 1.002));
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
            const line = new THREE.Line(geo, mat);
            cableGroup.add(line);
            cableMaterials.push(mat);
          }
        }
      }
      if (optionsRef.current.cables?.length) buildCableLayer(optionsRef.current.cables);

      // ── Data centers ──────────────────────────────────────────────────────
      const PROVIDER_COLORS: Record<string, number> = {
        aws:     0xf97316,  // orange
        gcp:     0x34d399,  // green
        azure:   0x60a5fa,  // blue
        equinix: 0xfbbf24,  // amber
        other:   0x94a3b8,  // slate
      };

      const dcGroup = new THREE.Group();
      scene.add(dcGroup);

      function buildDcLayer(dcs: DataCenter[]) {
        while (dcGroup.children.length) {
          const m = dcGroup.children[0] as THREE.Mesh;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
          dcGroup.remove(m);
        }
        const geo = new THREE.CircleGeometry(0.008, 6);
        for (const dc of dcs) {
          const mat = new THREE.MeshBasicMaterial({ color: PROVIDER_COLORS[dc.provider] ?? PROVIDER_COLORS.other });
          const mesh = new THREE.Mesh(geo, mat);
          const pos = latLngToVec3(dc.lat, dc.lng, 1.003);
          mesh.position.copy(pos);
          mesh.lookAt(pos.clone().multiplyScalar(2));
          mesh.userData = { dc };
          dcGroup.add(mesh);
        }
      }
      if (optionsRef.current.dataCenters?.length) buildDcLayer(optionsRef.current.dataCenters);

      // ── IXPs ──────────────────────────────────────────────────────────────
      const ixpGroup = new THREE.Group();
      scene.add(ixpGroup);
      let ixpPoints: THREE.Points | null = null;

      function buildIxpLayer(ixps: IxPoint[]) {
        if (ixpPoints) {
          ixpGroup.remove(ixpPoints);
          ixpPoints.geometry.dispose();
          (ixpPoints.material as THREE.Material).dispose();
          ixpPoints = null;
        }
        if (!ixps.length) return;
        const positions = new Float32Array(ixps.length * 3);
        ixps.forEach((ix, i) => {
          const v = latLngToVec3(ix.lat, ix.lng, 1.004);
          positions[i * 3]     = v.x;
          positions[i * 3 + 1] = v.y;
          positions[i * 3 + 2] = v.z;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0xa78bfa, size: 0.012, sizeAttenuation: true });
        ixpPoints = new THREE.Points(geo, mat);
        ixpGroup.add(ixpPoints);
      }
      if (optionsRef.current.ixps?.length) buildIxpLayer(optionsRef.current.ixps);

      // ── Globe projection (shared with React overlay) ───────────────────
      window.globeProject = (lat: number, lng: number) => {
        const pos = latLngToVec3(lat, lng, 1.0);
        const camDir = camera.position.clone().normalize();
        const facing = pos.dot(camDir);
        const v = pos.clone().project(camera);
        return {
          x: ((v.x + 1) / 2) * window.innerWidth,
          y: ((-v.y + 1) / 2) * window.innerHeight,
          visible: facing > 0.15,
        };
      };

      // Expose Three.js layer groups so LayerTogglePanel can toggle visibility
      const bordersProxy = {
        get visible() { return borderGroup.visible; },
        set visible(v: boolean) { borderGroup.visible = v; politicalGroup.visible = v; },
      };
      window.globeLayerGroups = {
        cables:      cableGroup,
        borders:     bordersProxy,
        datacenters: dcGroup,
        ixps:        ixpGroup,
      };

      // Apply initial layer defaults immediately after Three.js groups are registered
      const initLayers = (window as Window & { globeLayers?: Record<string, boolean> }).globeLayers;
      bordersProxy.visible = initLayers?.borders ?? false;
      if (initLayers?.cables !== undefined) cableGroup.visible = initLayers.cables;
      if (initLayers?.datacenters !== undefined) dcGroup.visible = initLayers.datacenters;
      if (initLayers?.ixps !== undefined) ixpGroup.visible = initLayers.ixps;

      window.globeState = {
        mode: optionsRef.current.mode,
        setMode: (m: GlobeMode) => {
          optionsRef.current = { ...optionsRef.current, mode: m };
          if (m === "auto") {
            controls.autoRotate = true;
            controls.enabled = true;
          } else {
            controls.autoRotate = false;
            controls.enabled = true;
          }
        },
      };

      // ── Country markers ───────────────────────────────────────────────────────────
      const countryGroup = new THREE.Group();
      scene.add(countryGroup);

      interface CountryMeshEntry {
        dot: THREE.Mesh;
        ring: THREE.Mesh;
        cc: string;
      }
      const countryMeshes: CountryMeshEntry[] = [];

      function buildCountryMarkers(countries: CountryAlloc[]) {
        // Очистити попередні маркери
        for (const entry of countryMeshes) {
          countryGroup.remove(entry.dot, entry.ring);
          entry.dot.geometry.dispose();
          entry.ring.geometry.dispose();
          (entry.dot.material as THREE.Material).dispose();
          (entry.ring.material as THREE.Material).dispose();
        }
        countryMeshes.length = 0;

        if (!countries.length) return;

        const maxLog = Math.log10(Math.max(...countries.map(c => c.ipCount)));

        for (const country of countries) {
          const pos = latLngToVec3(country.lat, country.lng, 1.015);
          const logRatio = Math.log10(Math.max(country.ipCount, 1)) / maxLog; // 0..1
          const r = 0.005 + logRatio * 0.018;

          // Колір: холодний синій (мало) → теплий жовтогарячий (багато)
          const col = new THREE.Color().setHSL(0.6 - logRatio * 0.55, 0.9, 0.55);

          const dot = new THREE.Mesh(
            new THREE.CircleGeometry(r, 16),
            new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
          );
          dot.position.copy(pos);
          dot.userData.cc = country.cc;

          const ring = new THREE.Mesh(
            new THREE.RingGeometry(r * 1.6, r * 2.2, 24),
            new THREE.MeshBasicMaterial({
              color: col,
              transparent: true,
              opacity: 0.3,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          ring.position.copy(pos);

          countryGroup.add(dot, ring);
          countryMeshes.push({ dot, ring, cc: country.cc });
        }
      }

      // Збудувати маркери якщо дані вже є при ініціалізації
      if (optionsRef.current.countries?.length) {
        buildCountryMarkers(optionsRef.current.countries);
      }

      // ── Block cluster ─────────────────────────────────────────────────────────────
      const blockGroup = new THREE.Group();
      scene.add(blockGroup);

      interface BlockMeshEntry {
        dot: THREE.Mesh;
        ring: THREE.Mesh;
        block: IpBlock;
      }
      let blockMeshes: BlockMeshEntry[] = [];
      let hoveredBlockIdx: number | null = null;

      function updateBlockRings() {
        const selected = optionsRef.current.selectedBlock;
        blockMeshes.forEach((m, i) => {
          m.ring.visible = i === hoveredBlockIdx || m.block.start === selected?.start;
        });
      }

      function clearBlockCluster() {
        for (const entry of blockMeshes) {
          blockGroup.remove(entry.dot, entry.ring);
          entry.dot.geometry.dispose();
          (entry.dot.material as THREE.Material).dispose();
          entry.ring.geometry.dispose();
          (entry.ring.material as THREE.Material).dispose();
        }
        blockMeshes = [];
        hoveredBlockIdx = null;
      }

      function buildBlockCluster(blocks: IpBlock[], centerLat: number, centerLng: number) {
        clearBlockCluster();
        if (!blocks.length) return;

        const cols = Math.ceil(Math.sqrt(blocks.length));
        const step = 0.6; // degrees between blocks
        const minSize = Math.min(...blocks.map(b => b.size));
        const maxSize = Math.max(...blocks.map(b => b.size));

        blocks.forEach((block, i) => {
          const row = Math.floor(i / cols) - Math.floor(cols / 2);
          const col = (i % cols) - Math.floor(cols / 2);
          const lat = centerLat + row * step;
          const lng = centerLng + col * step;
          const pos = latLngToVec3(lat, lng, 1.015);

          const visual = blockMarkerVisual(block.size, minSize, maxSize);
          const color = new THREE.Color().setHSL(visual.hue, visual.saturation, visual.lightness);

          const dot = new THREE.Mesh(
            new THREE.CircleGeometry(visual.radius, 16),
            new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
          );
          dot.position.copy(pos);

          const ring = new THREE.Mesh(
            new THREE.RingGeometry(visual.radius * 1.6, visual.radius * 2.2, 24),
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          ring.position.copy(pos);
          ring.visible = false;

          blockGroup.add(dot, ring);
          blockMeshes.push({ dot, ring, block });
        });

        updateBlockRings();
      }

      // ── Camera tween ──────────────────────────────────────────────────────────────
      let camTarget: THREE.Vector3 | null = null;
      let camFrom: THREE.Vector3 | null = null;
      let camTweenT = 1.0;

      function tweenCameraTo(lat: number, lng: number, dist = 2.2) {
        camFrom = camera.position.clone();
        camTarget = latLngToVec3(lat, lng).multiplyScalar(dist);
        camTweenT = 0;
        controls.autoRotate = false;
      }

      // ── Raycasting click ──────────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const onCanvasClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);

        // Рівень Країна: клік по блоку
        if (blockPoints) {
          raycaster.params.Points = { threshold: 0.015 };
          const blockHits = raycaster.intersectObject(blockPoints);
          if (blockHits.length > 0) {
            const idx = blockHits[0].index ?? 0;
            if (blockEntries[idx]) {
              optionsRef.current.onBlockClick?.(blockEntries[idx]);
            }
            return;
          }
        }

        // Рівень Світ: клік по country marker
        if (countryGroup.visible) {
          const dots = countryMeshes.map(m => m.dot);
          const hits = raycaster.intersectObjects(dots);
          if (hits.length > 0) {
            const cc = hits[0].object.userData.cc as string;
            optionsRef.current.onCountryClick?.(cc);
            return;
          }
        }

      };
      canvas.addEventListener('click', onCanvasClick);

      // ── Raycasting hover (blocks only) ────────────────────────────────────
      const onCanvasMouseMove = (e: MouseEvent) => {
        if (!blockPoints) {
          optionsRef.current.onBlockHover?.(null, 0, 0);
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);
        raycaster.params.Points = { threshold: 0.015 };
        const hits = raycaster.intersectObject(blockPoints);
        if (hits.length > 0) {
          const idx = hits[0].index ?? 0;
          if (blockEntries[idx]) {
            optionsRef.current.onBlockHover?.(blockEntries[idx], e.clientX, e.clientY);
            canvas.style.cursor = 'pointer';
            return;
          }
        }
        optionsRef.current.onBlockHover?.(null, 0, 0);
        canvas.style.cursor = '';
      };
      canvas.addEventListener('mousemove', onCanvasMouseMove);

      // ── Animation loop ────────────────────────────────────────────────────
      let elapsed = 0;
      const clock = new THREE.Clock();
      // Відстежуємо зміни масиву countries між рендерами
      const lastCountriesRef = { current: optionsRef.current.countries };
      // Відстежуємо зміну вибраної країни
      const lastSelectedRef = { current: undefined as string | null | undefined };
      // Відстежуємо зміни інфраструктурних даних
      const lastCablesRef = { current: optionsRef.current.cables };
      const lastDcsRef = { current: optionsRef.current.dataCenters };
      const lastIxpsRef = { current: optionsRef.current.ixps };

      function animate() {
        if (!mounted) return;
        animId = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        elapsed += dt;

        const { tweaks, mode } = optionsRef.current;
        const timeOffset = tweaks.timeOffset ?? 0;
        const simDate = new Date(Date.now() + timeOffset * 3_600_000);
        const sunLL = getSunLatLng(simDate);
        const sunVec = latLngToVec3(sunLL.lat, sunLL.lng, 1).normalize();
        // sunDir stays world-space — normals in both shaders are now world-space too
        uniforms.sunDir.value.copy(sunVec);
        uniforms.u_declination.value = sunLL.lat;
        // Keep atmosphere camera position in sync
        atmoUniforms.cameraWorldPos.value.copy(camera.position);

        if (tweaks.showTerminator) {
          updateTerminator(sunVec);
          termLine.visible = true;
        } else {
          termLine.visible = false;
        }

        if (tweaks.showSunMarker) {
          const sunPos = latLngToVec3(sunLL.lat, sunLL.lng, 1.025);
          sunMarker.position.copy(sunPos);
          sunGlow.position.copy(sunPos);
          sunMarker.visible = true;
          sunGlow.visible = true;
          const pulse = 1 + 0.2 * Math.sin(elapsed * 2.5);
          sunGlow.scale.setScalar(pulse);
        } else {
          sunMarker.visible = false;
          sunGlow.visible = false;
        }

        if (mode === "follow") {
          const dist = camera.position.length();
          const followTarget = sunVec.clone().multiplyScalar(dist);
          camera.position.lerp(followTarget, 0.005);
          camera.position.setLength(dist);
        }

        const speed =
          ((tweaks.rotationSpeed ?? TWEAK_DEFAULTS.rotationSpeed) / 50) * 0.6;
        controls.autoRotateSpeed = speed;
        // Не перезаписувати autoRotate під час tween камери
        if (camTweenT >= 1.0) {
          controls.autoRotate = (tweaks.autoRotate ?? true) && mode === "auto" && !optionsRef.current.selectedCountry;
        }

        // Animate trade route dash flow (golden ant march effect)
        tradeMaterials.forEach((mat) => {
          (
            mat as THREE.LineDashedMaterial & { dashOffset: number }
          ).dashOffset -= dt * 0.04;
        });

        // Camera tween до країни
        if (camTweenT < 1.0 && camTarget && camFrom) {
          camTweenT = Math.min(1.0, camTweenT + dt * 1.0);
          const ease = 1 - Math.pow(1 - camTweenT, 3); // cubic ease-out
          camera.position.lerpVectors(camFrom, camTarget, ease);
        }

        window.globeCamDist = camera.position.length();
        controls.update();

        // Відстеження зміни selectedCountry
        const newSelected = optionsRef.current.selectedCountry;
        const newBlocks = optionsRef.current.countryBlocks;
        const newCountryData = optionsRef.current.countryData;

        if (newSelected !== lastSelectedRef.current) {
          lastSelectedRef.current = newSelected;
          if (newSelected && newCountryData) {
            // Перейти на рівень країни
            countryGroup.visible = false;
            tweenCameraTo(newCountryData.lat, newCountryData.lng);
            buildBlockCluster(newBlocks ?? [], newCountryData.lat, newCountryData.lng);
          } else {
            // Повернутись на рівень світу
            countryGroup.visible = true;
            clearBlockCluster();
            controls.autoRotate = optionsRef.current.mode === 'auto';
          }
        }

        // Rebuild country markers if data changed
        const newCountries = optionsRef.current.countries;
        if (newCountries !== lastCountriesRef.current) {
          lastCountriesRef.current = newCountries;
          if (newCountries) buildCountryMarkers(newCountries);
        }

        // Rebuild cable/dc/ixp layers when data props change
        const curCables = optionsRef.current.cables;
        if (curCables !== lastCablesRef.current) {
          lastCablesRef.current = curCables;
          if (curCables) buildCableLayer(curCables);
        }
        const curDcs = optionsRef.current.dataCenters;
        if (curDcs !== lastDcsRef.current) {
          lastDcsRef.current = curDcs;
          if (curDcs) buildDcLayer(curDcs);
        }
        const curIxps = optionsRef.current.ixps;
        if (curIxps !== lastIxpsRef.current) {
          lastIxpsRef.current = curIxps;
          if (curIxps) buildIxpLayer(curIxps);
        }

        // Маркери завжди дивляться на камеру (billboard)
        for (const m of countryMeshes) {
          m.dot.quaternion.copy(camera.quaternion);
          m.ring.quaternion.copy(camera.quaternion);
          if (tweaks.markerPulse) {
            const s = 1 + 0.4 * Math.sin(elapsed * 1.2);
            m.ring.scale.setScalar(s);
            (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 * (2 - s) * 0.5;
          } else {
            (m.ring.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        }

        renderer.render(scene, camera);
        if (firstFrame) {
          firstFrame = false;
          window.dispatchEvent(new CustomEvent("globe-load-progress", { detail: { pct: 100 } }));
        }
      }
      let firstFrame = true;
      animate();

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      // ── Cleanup ───────────────────────────────────────────────────────────
      return () => {
        mounted = false;
        cancelAnimationFrame(animId);
        canvas.removeEventListener('click', onCanvasClick);
        canvas.removeEventListener('mousemove', onCanvasMouseMove);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        tradeMaterials.forEach((m) => m.dispose());
        cableMaterials.forEach((m) => m.dispose());
        delete window.globeLayerGroups;
        delete window.globeProject;
        delete window.globeState;
        delete window.globeCamDist;
      };
    })();

    return () => {
      mounted = false;
      cancelAnimationFrame(animId);
    };
  }, [canvasRef]);
}
