/**
 * download-railroads.mjs
 * Downloads the high-resolution Natural Earth 10m railroads GeoJSON
 * and writes a simplified (decimated) version to apps/web/public/data/
 *
 * Usage:
 *   node scripts/download-railroads.mjs
 *   pnpm dl-railroads
 */

import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_DIR = path.join(__dirname, "../apps/web/public/data");
const RAW_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_railroads.geojson";
const OUT_FILE = path.join(DEST_DIR, "ne_railroads_simplified.geojson");

if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest + ".tmp");
    const proto = url.startsWith("https") ? https : http;
    const req = proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest + ".tmp", () => {});
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest + ".tmp", () => {});
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          fs.renameSync(dest + ".tmp", dest);
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

function decimateCoordinates(coords, step) {
  const out = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  // ensure last point preserved
  if (coords.length > 0) {
    const last = coords[coords.length - 1];
    const pen = out[out.length - 1];
    if (!pen || pen[0] !== last[0] || pen[1] !== last[1]) out.push(last);
  }
  return out;
}

function simplifyGeoJSON(inPath, outPath, targetPerLine = 800) {
  const raw = fs.readFileSync(inPath, "utf8");
  const geo = JSON.parse(raw);
  if (!geo.features) throw new Error("invalid geojson");

  const simplified = { ...geo, features: [] };
  for (const feat of geo.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const type = geom.type;
    if (type === "LineString") {
      const line = geom.coordinates;
      const step = Math.max(1, Math.ceil(line.length / targetPerLine));
      const coords = decimateCoordinates(line, step);
      simplified.features.push({
        ...feat,
        geometry: { type: "LineString", coordinates: coords },
      });
    } else if (type === "MultiLineString") {
      const parts = [];
      for (const line of geom.coordinates) {
        const step = Math.max(1, Math.ceil(line.length / targetPerLine));
        parts.push(decimateCoordinates(line, step));
      }
      simplified.features.push({
        ...feat,
        geometry: { type: "MultiLineString", coordinates: parts },
      });
    } else {
      // skip other geometry types
      simplified.features.push(feat);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(simplified));
}

async function main() {
  const tmp = path.join(DEST_DIR, "ne_10m_railroads.geojson");
  console.log(
    "Downloading Natural Earth 10m railroads (raw GitHub) — this may be large (~40MB)",
  );
  try {
    await download(RAW_URL, tmp);
    const stat = fs.statSync(tmp);
    console.log(`Downloaded ${(stat.size / 1_048_576).toFixed(1)} MB`);

    const arg = parseInt(process.argv[2] || "", 10);
    const target = Number.isFinite(arg) && arg > 10 ? arg : 700;
    console.log(
      `Simplifying / decimating coordinates (targetPerLine=${target})`,
    );
    simplifyGeoJSON(tmp, OUT_FILE, target);
    const outStat = fs.statSync(OUT_FILE);
    console.log(
      `Written simplified GeoJSON: ${(outStat.size / 1_048_576).toFixed(1)} MB -> ${OUT_FILE}`,
    );

    // keep a copy of the original for reference (optional)
    try {
      const origDest = path.join(DEST_DIR, "ne_10m_railroads.original.geojson");
      if (!fs.existsSync(origDest)) fs.renameSync(tmp, origDest);
    } catch (e) {
      // ignore
    }

    console.log(
      "Done. Restart dev server to pick up the new local rail dataset.",
    );
  } catch (err) {
    console.error("Failed to download or simplify railroads:", err.message);
  }
}

main();
