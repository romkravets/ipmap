"use client";

import { EXCHANGES, STOCK_MARKETS, SESSION_COLORS_HEX, TWEAK_DEFAULTS } from "@/lib/constants";
import { getSunLatLng } from "@/lib/session-logic";
import type { GlobeMode, TweakValues } from "@sessionmap/types";
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
    exchangeData?: typeof EXCHANGES;
    globeState?: {
      setMode: (m: GlobeMode) => void;
      mode: GlobeMode;
    };
    globeCamDist?: number;
    globeLayerGroups?: Record<string, { visible: boolean }>;
    timeOffsetHours?: number;
    tweakPulse?: boolean;
    onWhaleArc?: (w: {
      type: string;
      amount: number;
      from: string;
      to: string;
    }) => void;
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
  onWhaleArc?: (w: {
    type: string;
    amount: number;
    from: string;
    to: string;
  }) => void;
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

      // ── Submarine cables ────────────────────────────────────────────────
      const SUBMARINE_CABLES: Array<{ name: string; waypoints: [number, number][] }> = [
        { name: "TAT-14",       waypoints: [[39.0, -74.5], [47.5, -40.0], [51.5, -0.1]] },
        { name: "MAREA",        waypoints: [[36.8, -75.9], [43.3, -8.4]] },
        { name: "Columbus-3",   waypoints: [[25.8, -80.2], [37.4, -5.9]] },
        { name: "SAT-3",        waypoints: [[51.5, -0.1], [14.7, -17.4], [4.3, 9.7], [-33.9, 18.4]] },
        { name: "BRUSA",        waypoints: [[-23.6, -46.6], [32.3, -64.8], [38.0, -74.0]] },
        { name: "SAm-1",        waypoints: [[25.8, -80.2], [10.5, -75.5], [-12.0, -77.1], [-33.4, -70.7], [-23.6, -46.6]] },
        { name: "TPC-5",        waypoints: [[33.7, -118.2], [19.9, -155.6], [35.7, 139.7]] },
        { name: "Hawaiki",      waypoints: [[-36.9, 174.8], [-33.9, 151.2], [21.3, -157.8], [45.5, -122.7]] },
        { name: "JUPITER",      waypoints: [[34.0, -118.2], [21.3, -157.8], [35.7, 139.7], [14.1, 121.0]] },
        { name: "AAG",          waypoints: [[22.3, 114.2], [10.8, 106.7], [13.1, 100.5], [19.9, -155.6], [34.0, -118.2]] },
        { name: "C2C",          waypoints: [[22.3, 114.2], [35.7, 139.7], [47.6, -122.3]] },
        { name: "SEA-ME-WE 3",  waypoints: [[43.3, 5.4], [29.9, 32.5], [12.8, 43.2], [22.1, 60.0], [19.1, 72.8], [6.9, 79.8], [1.3, 103.8], [-6.2, 106.8]] },
        { name: "IMEWE",        waypoints: [[22.3, 114.2], [22.1, 60.0], [25.3, 57.0], [12.8, 43.2], [29.9, 32.5], [43.3, 5.4]] },
        { name: "EASSy",        waypoints: [[11.6, 43.1], [2.0, 45.3], [-4.0, 39.7], [-17.7, 37.0], [-33.9, 18.4]] },
        { name: "SEACOM",       waypoints: [[-33.9, 18.4], [-23.0, 35.5], [-4.0, 39.7], [1.3, 103.8]] },
        { name: "SJC",          waypoints: [[35.7, 139.7], [31.2, 121.5], [22.3, 114.2]] },
      ];

      const cableMaterials: THREE.LineDashedMaterial[] = [];
      const cableGroup = new THREE.Group();
      scene.add(cableGroup);

      SUBMARINE_CABLES.forEach((cable) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < cable.waypoints.length - 1; i++) {
          const [la1, ln1] = cable.waypoints[i];
          const [la2, ln2] = cable.waypoints[i + 1];
          pts.push(...greatCircleArc(
            latLngToVec3(la1, ln1, 1.0),
            latLngToVec3(la2, ln2, 1.0),
            0.002,
            40,
          ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({
          color: 0x22d3ee,
          dashSize: 0.018,
          gapSize: 0.012,
          linewidth: 1,
          transparent: true,
          opacity: 0.5,
          depthTest: true,
        });
        const line = new THREE.Line(geo, mat);
        (line as unknown as { computeLineDistances(): void }).computeLineDistances();
        cableGroup.add(line);
        cableMaterials.push(mat);
      });

      // ── Globe projection (shared with React overlay) ───────────────────
      window.exchangeData = EXCHANGES;
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
        cables:  cableGroup,
        borders: bordersProxy,
      };

      // Apply initial layer defaults immediately after Three.js groups are registered
      const initLayers = (window as Window & { globeLayers?: Record<string, boolean> }).globeLayers;
      bordersProxy.visible = initLayers?.borders ?? false;
      if (initLayers?.cables !== undefined) cableGroup.visible = initLayers.cables;

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

      // ── Whale arc system ──────────────────────────────────────────────────
      interface ArcEntry {
        line: THREE.Line;
        dotMesh: THREE.Mesh;
        glowMesh: THREE.Mesh;
        tail: THREE.Line;
        tailMat: THREE.LineBasicMaterial;
        lineMat: THREE.LineBasicMaterial;
        arcPts: THREE.Vector3[];
        progress: number;
        born: number;
        lifetime: number;
        amountBTC: number;
      }

      const WHALE_COLORS: Record<string, THREE.Color> = {
        transfer: new THREE.Color(0xfbbf24),
        deposit: new THREE.Color(0x7dd3fc),
        withdraw: new THREE.Color(0xf472b6),
        dex: new THREE.Color(0x34d399),
      };

      const whaleGroup = new THREE.Group();
      scene.add(whaleGroup);
      const activeArcs: ArcEntry[] = [];

      function spawnWhaleArc(whale?: {
        type: string;
        amount: number;
        from: string;
        to: string;
      }) {
        const exList = EXCHANGES;
        let i1 = Math.floor(Math.random() * exList.length);
        let i2 = Math.floor(Math.random() * (exList.length - 1));
        if (i2 >= i1) i2++;

        const ex1 = exList[i1];
        const ex2 = exList[i2];
        const p1 = latLngToVec3(ex1.lat, ex1.lng, 1);
        const p2 = latLngToVec3(ex2.lat, ex2.lng, 1);
        const dist = p1.distanceTo(p2);
        const peakAlt = 0.08 + dist * 0.14;
        const arcPts = greatCircleArc(p1, p2, peakAlt);

        const type = whale?.type ?? "transfer";
        const amountBTC =
          whale?.amount ?? Math.floor(Math.random() * 4500 + 200);
        const col = WHALE_COLORS[type] ?? WHALE_COLORS.transfer;
        const lineOpacity = 0.15 + Math.min(amountBTC / 5000, 1) * 0.35;

        const lineMat = new THREE.LineBasicMaterial({
          color: col,
          transparent: true,
          opacity: lineOpacity,
          depthWrite: false,
        });
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(arcPts),
          lineMat,
        );
        whaleGroup.add(line);

        const dotSize = 0.009 + Math.min(amountBTC / 5000, 1) * 0.016;
        const dotMesh = new THREE.Mesh(
          new THREE.SphereGeometry(dotSize, 8, 8),
          new THREE.MeshBasicMaterial({ color: col, depthWrite: false }),
        );
        const glowMesh = new THREE.Mesh(
          new THREE.SphereGeometry(dotSize * 2.5, 8, 8),
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
          }),
        );
        whaleGroup.add(dotMesh, glowMesh);

        const tailMat = new THREE.LineBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        });
        const tail = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([arcPts[0], arcPts[0]]),
          tailMat,
        );
        whaleGroup.add(tail);

        activeArcs.push({
          line,
          dotMesh,
          glowMesh,
          tail,
          tailMat,
          lineMat,
          arcPts,
          progress: 0,
          born: elapsed,
          lifetime: 5.5,
          amountBTC,
        });
      }

      function updateWhaleArcs() {
        const TAIL_SEGS = 12;
        for (let i = activeArcs.length - 1; i >= 0; i--) {
          const arc = activeArcs[i];
          const age = elapsed - arc.born;
          const lifeRatio = age / arc.lifetime;

          if (lifeRatio >= 1) {
            whaleGroup.remove(arc.line, arc.dotMesh, arc.glowMesh, arc.tail);
            arc.line.geometry.dispose();
            arc.lineMat.dispose();
            arc.tail.geometry.dispose();
            arc.tailMat.dispose();
            (arc.dotMesh.material as THREE.Material).dispose();
            (arc.glowMesh.material as THREE.Material).dispose();
            activeArcs.splice(i, 1);
            continue;
          }

          const t = lifeRatio;
          arc.progress = t < 0.85 ? t / 0.85 : 1;
          const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          arc.lineMat.opacity =
            (0.12 + Math.min(arc.amountBTC / 5000, 1) * 0.3) * alpha;
          arc.tailMat.opacity = 0.7 * alpha;
          (arc.dotMesh.material as THREE.MeshBasicMaterial).opacity = alpha;
          (arc.glowMesh.material as THREE.MeshBasicMaterial).opacity =
            0.25 * alpha;

          const idx = Math.floor(arc.progress * (arc.arcPts.length - 1));
          arc.dotMesh.position.copy(arc.arcPts[idx]);
          arc.glowMesh.position.copy(arc.arcPts[idx]);

          const tailStart = Math.max(0, idx - TAIL_SEGS);
          const tailPts = arc.arcPts.slice(tailStart, idx + 1);
          if (tailPts.length > 1) arc.tail.geometry.setFromPoints(tailPts);
        }
      }

      // Expose spawn to outside world (for WS whale events)
      window.onWhaleArc = (w) => spawnWhaleArc(w);

      // ── Animation loop ────────────────────────────────────────────────────
      let elapsed = 0;
      const clock = new THREE.Clock();
      let nextSpawn = 3;

      // ── Exchange markers (flat billboards) ───────────────────────────
      const markerGroup = new THREE.Group();
      scene.add(markerGroup);
      const markerMeshes: {
        dot: THREE.Mesh;
        ring: THREE.Mesh;
        phase: number;
        ex: (typeof EXCHANGES)[0];
      }[] = [];

      EXCHANGES.forEach((ex) => {
        const pos = latLngToVec3(ex.lat, ex.lng, 1.013);
        const r = 0.007 + Math.log(ex.vol + 1) * 0.003;
        const col = new THREE.Color(SESSION_COLORS_HEX[ex.region]);

        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(r, 16),
          new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
        );

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(r * 1.8, r * 2.6, 24),
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );

        dot.position.copy(pos);
        ring.position.copy(pos);
        markerGroup.add(dot, ring);
        markerMeshes.push({ dot, ring, phase: Math.random() * Math.PI * 2, ex });
      });

      // ── Stock market diamond markers ─────────────────────────────────
      const stockGroup = new THREE.Group();
      scene.add(stockGroup);
      const stockMeshes: { mesh: THREE.Mesh }[] = [];

      STOCK_MARKETS.forEach((m) => {
        const pos = latLngToVec3(m.lat, m.lng, 1.017);
        const size = 0.014;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(size, size),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(m.color),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          }),
        );
        mesh.position.copy(pos);
        mesh.rotation.z = Math.PI / 4; // rotate 45° → diamond shape
        stockGroup.add(mesh);
        stockMeshes.push({ mesh });
      });

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
        controls.autoRotate = mode === "auto";

        markerMeshes.forEach((m) => {
          // Billboard — always face camera
          m.dot.quaternion.copy(camera.quaternion);
          m.ring.quaternion.copy(camera.quaternion);

          if (!tweaks.markerPulse) {
            (m.ring.material as THREE.MeshBasicMaterial).opacity = 0;
            return;
          }
          const s = 1 + 0.5 * Math.sin(elapsed * 1.4 + m.phase);
          m.ring.scale.setScalar(s);
          (m.ring.material as THREE.MeshBasicMaterial).opacity =
            0.35 * (2.2 - s) * 0.5;
        });

        // Billboard stock market squares
        stockMeshes.forEach((m) => {
          m.mesh.quaternion.copy(camera.quaternion);
        });

        // Animate trade route dash flow (golden ant march effect)
        tradeMaterials.forEach((mat) => {
          (
            mat as THREE.LineDashedMaterial & { dashOffset: number }
          ).dashOffset -= dt * 0.04;
        });

        // Animate submarine cable dash flow (cyan, slower)
        cableMaterials.forEach((mat) => {
          (
            mat as THREE.LineDashedMaterial & { dashOffset: number }
          ).dashOffset -= dt * 0.02;
        });

        // auto-spawn arcs when no WS (fallback mode)
        nextSpawn -= dt;
        if (nextSpawn <= 0) {
          spawnWhaleArc();
          nextSpawn = 3 + Math.random() * 4;
        }

        updateWhaleArcs();
        window.globeCamDist = camera.position.length();
        controls.update();
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
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        tradeMaterials.forEach((m) => m.dispose());
        cableMaterials.forEach((m) => m.dispose());
        delete window.globeLayerGroups;
        delete window.globeProject;
        delete window.globeState;
        delete window.globeCamDist;
        delete window.onWhaleArc;
      };
    })();

    return () => {
      mounted = false;
      cancelAnimationFrame(animId);
    };
  }, [canvasRef]);
}
