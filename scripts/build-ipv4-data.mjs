#!/usr/bin/env node
// ETL: завантажує 5 RIR delegated files → ipv4-by-country.json + centroids.json

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '../apps/web/public/data')

const RIR_URLS = [
  'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest',
  'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest',
  'https://ftp.apnic.net/pub/stats/apnic/delegated-apnic-latest',
  'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest',
  'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest',
]

const CENTROIDS_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson'

// ── RIR parsing ───────────────────────────────────────────────────────────────

function parseRIR(text) {
  /** @type {Record<string,number>} */
  const byCountry = {}
  /** @type {Record<string,Array<{start:string,size:number}>>} */
  const blocksByCountry = {}

  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const parts = line.split('|')
    if (parts.length < 7) continue
    const [, cc, type, start, value, , status] = parts
    if (type !== 'ipv4') continue
    if (!cc || cc === '*') continue
    if (status !== 'allocated' && status !== 'assigned') continue
    const size = parseInt(value, 10)
    if (!size || isNaN(size)) continue

    byCountry[cc] = (byCountry[cc] ?? 0) + size
    if (!blocksByCountry[cc]) blocksByCountry[cc] = []
    blocksByCountry[cc].push({ start, size })
  }

  return { byCountry, blocksByCountry }
}

// ── IP to BigInt (для сортування блоків) ─────────────────────────────────────

function ipToBigInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8n) | BigInt(octet), 0n)
}

// ── Centroids з Natural Earth ─────────────────────────────────────────────────

async function buildCentroids() {
  console.log('  Fetching centroids from Natural Earth...')
  const res = await fetch(CENTROIDS_URL)
  if (!res.ok) throw new Error(`Centroids fetch failed: ${res.status}`)
  const geo = await res.json()
  /** @type {Record<string,{lat:number,lng:number,name:string}>} */
  const centroids = {}
  for (const feature of geo.features) {
    const p = feature.properties
    const cc = p.ISO_A2
    if (!cc || cc === '-1' || cc === '') continue
    centroids[cc] = {
      lat: p.LABEL_Y ?? p.LAT ?? 0,
      lng: p.LABEL_X ?? p.LON ?? 0,
      name: p.NAME_EN ?? p.NAME ?? cc,
    }
  }
  return centroids
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  /** @type {Record<string,number>} */
  const byCountry = {}
  /** @type {Record<string,Array<{start:string,size:number}>>} */
  const blocksByCountry = {}

  console.log('Fetching RIR data...')
  for (const url of RIR_URLS) {
    const label = url.split('/').at(-1)
    process.stdout.write(`  ${label}... `)
    try {
      const res = await fetch(url)
      if (!res.ok) { console.log(`SKIP (${res.status})`); continue }
      const text = await res.text()
      const { byCountry: bc, blocksByCountry: bbc } = parseRIR(text)

      for (const [cc, count] of Object.entries(bc)) {
        byCountry[cc] = (byCountry[cc] ?? 0) + count
      }
      for (const [cc, blocks] of Object.entries(bbc)) {
        if (!blocksByCountry[cc]) blocksByCountry[cc] = []
        blocksByCountry[cc].push(...blocks)
      }
      const total = Object.values(bc).reduce((a, b) => a + b, 0)
      console.log(`OK (${Object.keys(bc).length} countries, ${(total / 1e6).toFixed(1)}M IPs)`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }
  }

  // Сортуємо блоки кожної країни за стартовою IP (BigInt)
  for (const cc of Object.keys(blocksByCountry)) {
    blocksByCountry[cc].sort((a, b) => {
      const ai = ipToBigInt(a.start)
      const bi = ipToBigInt(b.start)
      return ai < bi ? -1 : ai > bi ? 1 : 0
    })
  }

  const ipv4Path = path.join(OUT_DIR, 'ipv4-by-country.json')
  await writeFile(ipv4Path, JSON.stringify({ byCountry, blocksByCountry }))
  const totalIPs = Object.values(byCountry).reduce((a, b) => a + b, 0)
  console.log(
    `\nWritten: ${ipv4Path}` +
    `\n  ${Object.keys(byCountry).length} countries, ${(totalIPs / 1e9).toFixed(2)}B IPs total`
  )

  const centroids = await buildCentroids()
  const centroidsPath = path.join(OUT_DIR, 'centroids.json')
  await writeFile(centroidsPath, JSON.stringify(centroids))
  console.log(`Written: ${centroidsPath} (${Object.keys(centroids).length} entries)`)
}

main().catch(err => { console.error(err); process.exit(1) })
