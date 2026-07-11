#!/usr/bin/env node
/*
Download Natural Earth roads GeoJSON and simplify it to produce a smaller preprocessed file
Usage: node scripts/download-roads.mjs [targetPerLine]
Example: node scripts/download-roads.mjs 40
*/
import fs from "fs";
import https from "https";
import path from "path";

const outDir = path.resolve(process.cwd(), "apps/web/public/data");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const urls = [
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_roads.geojson",
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_roads.geojson",
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_roads.geojson",
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200)
          return reject(new Error(`Status ${res.statusCode}`));
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function simplifyGeoJSON(geojson, targetPerLine = 50) {
  // Very simple coordinate decimation: keep every Nth point on each LineString
  const out = { ...geojson };
  out.features = (geojson.features || []).map((f) => {
    if (!f.geometry) return f;
    const geom = { ...f.geometry };
    if (geom.type === "LineString") {
      const coords = geom.coordinates || [];
      const step = Math.max(1, Math.floor(coords.length / targetPerLine));
      geom.coordinates = coords.filter((_, i) => i % step === 0);
    } else if (geom.type === "MultiLineString") {
      geom.coordinates = (geom.coordinates || []).map((line) => {
        const step = Math.max(1, Math.floor(line.length / targetPerLine));
        return line.filter((_, i) => i % step === 0);
      });
    }
    return { ...f, geometry: geom };
  });
  return out;
}

(async function main() {
  const arg = process.argv[2];
  const targetPerLine = arg ? parseInt(arg, 10) : 50;
  for (const url of urls) {
    try {
      console.log("Fetching", url);
      const body = await fetchUrl(url);
      const geo = JSON.parse(body);
      console.log("Original features:", geo.features?.length || 0);
      const simplified = simplifyGeoJSON(geo, targetPerLine);
      const outPath = path.join(outDir, "ne_roads_simplified.geojson");
      fs.writeFileSync(outPath, JSON.stringify(simplified));
      const stat = fs.statSync(outPath);
      console.log(
        "Wrote simplified roads:",
        outPath,
        `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
      );
      return;
    } catch (e) {
      console.warn("Failed to fetch", url, e.message);
      continue;
    }
  }
  console.error("All downloads failed");
  process.exit(1);
})();
