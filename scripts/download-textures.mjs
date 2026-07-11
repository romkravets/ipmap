/**
 * download-textures.mjs
 * Downloads high-quality NASA earth textures for the SessionMap globe.
 *
 *  pnpm dl-textures       (from repo root)
 *  node scripts/download-textures.mjs
 *
 * Textures downloaded:
 *  earth-day-8k.jpg    — Solar System Scope 8K day map — clean land colors, flat ocean blue,
 *                         no ocean floor relief noise (CC BY 4.0)
 *  earth-topo-4k.jpg   — NASA Topo + Bathymetry 5400×2700 (fallback)
 *  earth-night-4k.jpg  — Solar System Scope 8K night map — city lights (CC BY 4.0)
 *
 * Sources: solarsystemscope.com (CC BY 4.0), NASA Visible Earth (public domain).
 */

import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST = path.join(__dirname, "../apps/web/public/textures");

const TEXTURES = [
  {
    filename: "earth-day-8k.jpg",
    // Same source/style as night texture: clean colors, no relief noise, 8K
    minSizeMB: 3,
    urls: [
      // Solar System Scope 8K day map (CC BY 4.0) — clean land colors, flat ocean, no noise
      "https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg",
      // NASA Blue Marble Next Generation — clean, no topo/bathy shading, 5400×2700
      "https://eoimages.gsfc.nasa.gov/images/imagerecords/76000/76487/world.200406.3x5400x2700.jpg",
      // CDN fallback
      "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
    ],
    description: "Solar System Scope 8K day map — clean, no ocean relief",
  },
  {
    filename: "earth-topo-4k.jpg",
    urls: [
      // NASA Visible Earth — Topography + Bathymetry, April 2004, 5400×2700 (kept as fallback)
      "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
    ],
    description:
      "NASA Topo + Bathymetry (terrain relief + ocean depth) — fallback only",
  },
  {
    filename: "earth-night-4k.jpg",
    // minSizeMB: reject download if result is smaller (low-quality previews)
    minSizeMB: 2,
    urls: [
      // NASA ARC Night lights 2012 (JPEG ~10 MB, 3600×1800, high quality)
      "https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg",
      // three-globe NPM package (hosted on multiple CDNs)
      "https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night-4k.jpg",
      "https://unpkg.com/three-globe@2.31.1/example/img/earth-night-4k.jpg",
      // Solar System Scope 8K night map (CC BY 4.0)
      "https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg",
    ],
    description: "NASA city lights at night (Black Marble)",
  },
];

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

function download(url, dest, description) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest + ".tmp");
    const proto = url.startsWith("https") ? https : http;

    const req = proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest + ".tmp", () => {});
        download(res.headers.location, dest, description)
          .then(resolve)
          .catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest + ".tmp", () => {});
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;
      let lastPct = -1;

      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = Math.floor((downloaded / total) * 100);
          if (pct !== lastPct && pct % 10 === 0) {
            process.stdout.write(`\r  ${description}: ${pct}%`);
            lastPct = pct;
          }
        }
      });

      res.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          fs.renameSync(dest + ".tmp", dest);
          process.stdout.write(`\r  ${description}: done ✓\n`);
          resolve();
        });
      });
    });

    req.on("error", (err) => {
      file.close();
      fs.unlink(dest + ".tmp", () => {});
      reject(err);
    });

    req.setTimeout(120_000, () => {
      req.destroy();
      file.close();
      fs.unlink(dest + ".tmp", () => {});
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

async function downloadWithFallbacks(tex) {
  const dest = path.join(DEST, tex.filename);

  if (fs.existsSync(dest)) {
    const stat = fs.statSync(dest);
    // skip only if file looks valid (> 2 MB — prevents keeping badly-compressed files)
    if (stat.size > 2_000_000) {
      console.log(
        `  ${tex.filename}: already exists (${(stat.size / 1_048_576).toFixed(1)} MB) — skip`,
      );
      return;
    }
    console.log(
      `  ${tex.filename}: exists but only ${(stat.size / 1_048_576).toFixed(1)} MB — re-downloading for better quality`,
    );
  }

  console.log(`\nDownloading ${tex.filename} — ${tex.description}`);
  const minBytes = (tex.minSizeMB ?? 0.5) * 1_048_576;

  for (const url of tex.urls) {
    try {
      await download(url, dest, tex.filename);
      const size = fs.statSync(dest).size;
      if (size < minBytes) {
        console.warn(
          `  ⚠ Downloaded only ${(size / 1_048_576).toFixed(1)} MB (< ${tex.minSizeMB ?? 0.5} MB min) — trying next URL…`,
        );
        continue;
      }
      console.log(`  ✓ ${(size / 1_048_576).toFixed(1)} MB`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Failed (${err.message}), trying next URL…`);
    }
  }

  console.error(`  ✗ All URLs failed or all too small for ${tex.filename}`);
  console.error(
    `    Using whatever was downloaded last — quality may be poor.`,
  );
}

console.log("SessionMap — texture downloader");
console.log(`Destination: ${DEST}\n`);

for (const tex of TEXTURES) {
  await downloadWithFallbacks(tex);
}

console.log("\nDone. Restart the dev server to see the new textures.");
