import { writeFile } from 'fs/promises';

const OUT = './apps/web/public/data';

// ── Submarine cables ──────────────────────────────────────────────────────────
async function buildCables() {
  // Source: tbotnz/submarine-cables-geojson (GeoJSON FeatureCollection)
  // Each feature has MultiLineString geometry with [lng, lat] coords (GeoJSON standard)
  // and properties: id, name, color
  const res = await fetch(
    'https://raw.githubusercontent.com/tbotnz/submarine-cables-geojson/main/cables.json',
    { headers: { 'User-Agent': 'ipmap-etl/1.0' } }
  );
  const data = await res.json();
  const cables = [];

  for (const feature of data.features) {
    if (!feature.geometry) continue;
    const props = feature.properties ?? {};
    const geom = feature.geometry;
    const coordArrays = geom.type === 'MultiLineString'
      ? geom.coordinates : [geom.coordinates];

    const segments = [];
    for (const coords of coordArrays) {
      // subsample: keep every Nth point to limit file size
      const step = coords.length > 200 ? 8 : coords.length > 80 ? 4 : coords.length > 30 ? 2 : 1;
      const seg = [];
      for (let i = 0; i < coords.length; i += step) {
        const [lng, lat] = coords[i]; // GeoJSON is [lng, lat]
        if (isFinite(lat) && isFinite(lng)) seg.push([lat, lng]); // store [lat, lng]
      }
      if (seg.length >= 2) segments.push(seg);
    }
    if (segments.length) {
      cables.push({
        id: props.id || props.feature_id || String(cables.length),
        name: props.name || 'Unknown',
        color: props.color || '#22d3ee',
        segments,
      });
    }
  }

  await writeFile(`${OUT}/submarine-cables.json`, JSON.stringify(cables));
  console.log(`cables: ${cables.length}`);
}

// ── Data centers (static curated list) ───────────────────────────────────────
async function buildDataCenters() {
  const dcs = [
    // AWS
    { id:'aws-us-east-1',      name:'AWS US East (N. Virginia)',   provider:'aws',     lat:38.9,   lng:-77.5,   city:'Ashburn',       country:'US' },
    { id:'aws-us-east-2',      name:'AWS US East (Ohio)',          provider:'aws',     lat:39.96,  lng:-82.99,  city:'Columbus',      country:'US' },
    { id:'aws-us-west-1',      name:'AWS US West (N. California)', provider:'aws',     lat:37.33,  lng:-121.89, city:'San Jose',      country:'US' },
    { id:'aws-us-west-2',      name:'AWS US West (Oregon)',        provider:'aws',     lat:45.87,  lng:-119.7,  city:'Boardman',      country:'US' },
    { id:'aws-eu-west-1',      name:'AWS EU West (Ireland)',       provider:'aws',     lat:53.3,   lng:-6.2,    city:'Dublin',        country:'IE' },
    { id:'aws-eu-west-2',      name:'AWS EU West (London)',        provider:'aws',     lat:51.5,   lng:-0.1,    city:'London',        country:'GB' },
    { id:'aws-eu-west-3',      name:'AWS EU West (Paris)',         provider:'aws',     lat:48.86,  lng:2.35,    city:'Paris',         country:'FR' },
    { id:'aws-eu-central-1',   name:'AWS EU Central (Frankfurt)',  provider:'aws',     lat:50.11,  lng:8.68,    city:'Frankfurt',     country:'DE' },
    { id:'aws-eu-north-1',     name:'AWS EU North (Stockholm)',    provider:'aws',     lat:59.33,  lng:18.07,   city:'Stockholm',     country:'SE' },
    { id:'aws-eu-south-1',     name:'AWS EU South (Milan)',        provider:'aws',     lat:45.47,  lng:9.19,    city:'Milan',         country:'IT' },
    { id:'aws-ap-northeast-1', name:'AWS AP Northeast (Tokyo)',    provider:'aws',     lat:35.69,  lng:139.69,  city:'Tokyo',         country:'JP' },
    { id:'aws-ap-northeast-2', name:'AWS AP Northeast (Seoul)',    provider:'aws',     lat:37.57,  lng:126.98,  city:'Seoul',         country:'KR' },
    { id:'aws-ap-northeast-3', name:'AWS AP Northeast (Osaka)',    provider:'aws',     lat:34.69,  lng:135.5,   city:'Osaka',         country:'JP' },
    { id:'aws-ap-southeast-1', name:'AWS AP Southeast (Singapore)',provider:'aws',     lat:1.35,   lng:103.82,  city:'Singapore',     country:'SG' },
    { id:'aws-ap-southeast-2', name:'AWS AP Southeast (Sydney)',   provider:'aws',     lat:-33.87, lng:151.21,  city:'Sydney',        country:'AU' },
    { id:'aws-ap-southeast-3', name:'AWS AP Southeast (Jakarta)',  provider:'aws',     lat:-6.21,  lng:106.85,  city:'Jakarta',       country:'ID' },
    { id:'aws-ap-south-1',     name:'AWS AP South (Mumbai)',       provider:'aws',     lat:19.08,  lng:72.88,   city:'Mumbai',        country:'IN' },
    { id:'aws-ap-south-2',     name:'AWS AP South (Hyderabad)',    provider:'aws',     lat:17.38,  lng:78.49,   city:'Hyderabad',     country:'IN' },
    { id:'aws-ap-east-1',      name:'AWS AP East (Hong Kong)',     provider:'aws',     lat:22.32,  lng:114.17,  city:'Hong Kong',     country:'HK' },
    { id:'aws-sa-east-1',      name:'AWS SA East (São Paulo)',     provider:'aws',     lat:-23.55, lng:-46.63,  city:'São Paulo',     country:'BR' },
    { id:'aws-ca-central-1',   name:'AWS Canada (Central)',        provider:'aws',     lat:45.5,   lng:-73.57,  city:'Montréal',      country:'CA' },
    { id:'aws-ca-west-1',      name:'AWS Canada (West)',           provider:'aws',     lat:51.04,  lng:-114.07, city:'Calgary',       country:'CA' },
    { id:'aws-me-south-1',     name:'AWS ME South (Bahrain)',      provider:'aws',     lat:26.07,  lng:50.55,   city:'Manama',        country:'BH' },
    { id:'aws-me-central-1',   name:'AWS ME Central (UAE)',        provider:'aws',     lat:25.2,   lng:55.27,   city:'Dubai',         country:'AE' },
    { id:'aws-af-south-1',     name:'AWS Africa (Cape Town)',      provider:'aws',     lat:-33.93, lng:18.42,   city:'Cape Town',     country:'ZA' },
    { id:'aws-il-central-1',   name:'AWS Israel (Tel Aviv)',       provider:'aws',     lat:32.07,  lng:34.79,   city:'Tel Aviv',      country:'IL' },
    // GCP
    { id:'gcp-us-central1',    name:'GCP US Central (Iowa)',       provider:'gcp',     lat:41.59,  lng:-93.62,  city:'Council Bluffs',country:'US' },
    { id:'gcp-us-east1',       name:'GCP US East (S. Carolina)',   provider:'gcp',     lat:33.2,   lng:-80.0,   city:'Moncks Corner', country:'US' },
    { id:'gcp-us-east4',       name:'GCP US East (N. Virginia)',   provider:'gcp',     lat:38.96,  lng:-77.42,  city:'Ashburn',       country:'US' },
    { id:'gcp-us-west1',       name:'GCP US West (Oregon)',        provider:'gcp',     lat:45.6,   lng:-122.9,  city:'The Dalles',    country:'US' },
    { id:'gcp-us-west2',       name:'GCP US West (Los Angeles)',   provider:'gcp',     lat:34.05,  lng:-118.24, city:'Los Angeles',   country:'US' },
    { id:'gcp-us-west3',       name:'GCP US West (Salt Lake)',     provider:'gcp',     lat:40.76,  lng:-111.89, city:'Salt Lake City',country:'US' },
    { id:'gcp-us-west4',       name:'GCP US West (Las Vegas)',     provider:'gcp',     lat:36.18,  lng:-115.14, city:'Las Vegas',     country:'US' },
    { id:'gcp-northamerica-northeast1', name:'GCP Montréal',       provider:'gcp',     lat:45.5,   lng:-73.57,  city:'Montréal',      country:'CA' },
    { id:'gcp-northamerica-northeast2', name:'GCP Toronto',        provider:'gcp',     lat:43.65,  lng:-79.38,  city:'Toronto',       country:'CA' },
    { id:'gcp-southamerica-east1',      name:'GCP São Paulo',      provider:'gcp',     lat:-23.55, lng:-46.63,  city:'São Paulo',     country:'BR' },
    { id:'gcp-southamerica-west1',      name:'GCP Santiago',       provider:'gcp',     lat:-33.45, lng:-70.67,  city:'Santiago',      country:'CL' },
    { id:'gcp-europe-west1',   name:'GCP EU West (Belgium)',       provider:'gcp',     lat:50.45,  lng:3.82,    city:'St. Ghislain',  country:'BE' },
    { id:'gcp-europe-west2',   name:'GCP EU West (London)',        provider:'gcp',     lat:51.5,   lng:-0.13,   city:'London',        country:'GB' },
    { id:'gcp-europe-west3',   name:'GCP EU West (Frankfurt)',     provider:'gcp',     lat:50.11,  lng:8.68,    city:'Frankfurt',     country:'DE' },
    { id:'gcp-europe-west4',   name:'GCP EU West (Netherlands)',   provider:'gcp',     lat:53.45,  lng:6.84,    city:'Eemshaven',     country:'NL' },
    { id:'gcp-europe-west6',   name:'GCP EU West (Zürich)',        provider:'gcp',     lat:47.38,  lng:8.54,    city:'Zürich',        country:'CH' },
    { id:'gcp-europe-north1',  name:'GCP EU North (Finland)',      provider:'gcp',     lat:60.56,  lng:27.19,   city:'Hamina',        country:'FI' },
    { id:'gcp-europe-central2',name:'GCP EU Central (Warsaw)',     provider:'gcp',     lat:52.23,  lng:21.01,   city:'Warsaw',        country:'PL' },
    { id:'gcp-asia-east1',     name:'GCP Asia East (Taiwan)',      provider:'gcp',     lat:24.05,  lng:120.55,  city:'Changhua',      country:'TW' },
    { id:'gcp-asia-east2',     name:'GCP Asia East (Hong Kong)',   provider:'gcp',     lat:22.32,  lng:114.17,  city:'Hong Kong',     country:'HK' },
    { id:'gcp-asia-northeast1',name:'GCP Asia NE (Tokyo)',         provider:'gcp',     lat:35.69,  lng:139.69,  city:'Tokyo',         country:'JP' },
    { id:'gcp-asia-northeast2',name:'GCP Asia NE (Osaka)',         provider:'gcp',     lat:34.69,  lng:135.5,   city:'Osaka',         country:'JP' },
    { id:'gcp-asia-northeast3',name:'GCP Asia NE (Seoul)',         provider:'gcp',     lat:37.57,  lng:126.98,  city:'Seoul',         country:'KR' },
    { id:'gcp-asia-south1',    name:'GCP Asia South (Mumbai)',     provider:'gcp',     lat:19.08,  lng:72.88,   city:'Mumbai',        country:'IN' },
    { id:'gcp-asia-south2',    name:'GCP Asia South (Delhi)',      provider:'gcp',     lat:28.63,  lng:77.22,   city:'Delhi',         country:'IN' },
    { id:'gcp-asia-southeast1',name:'GCP Asia SE (Singapore)',     provider:'gcp',     lat:1.35,   lng:103.82,  city:'Singapore',     country:'SG' },
    { id:'gcp-asia-southeast2',name:'GCP Asia SE (Jakarta)',       provider:'gcp',     lat:-6.21,  lng:106.85,  city:'Jakarta',       country:'ID' },
    { id:'gcp-australia-southeast1',name:'GCP Australia (Sydney)', provider:'gcp',     lat:-33.87, lng:151.21,  city:'Sydney',        country:'AU' },
    { id:'gcp-australia-southeast2',name:'GCP Australia (Melbourne)',provider:'gcp',   lat:-37.81, lng:144.96,  city:'Melbourne',     country:'AU' },
    { id:'gcp-me-west1',       name:'GCP ME West (Tel Aviv)',      provider:'gcp',     lat:32.07,  lng:34.79,   city:'Tel Aviv',      country:'IL' },
    { id:'gcp-me-central1',    name:'GCP ME Central (Doha)',       provider:'gcp',     lat:25.28,  lng:51.53,   city:'Doha',          country:'QA' },
    { id:'gcp-africa-south1',  name:'GCP Africa South (Johannesburg)',provider:'gcp',  lat:-26.2,  lng:28.04,   city:'Johannesburg',  country:'ZA' },
    // Azure (selected regions)
    { id:'az-eastus',          name:'Azure East US',               provider:'azure',   lat:37.36,  lng:-79.02,  city:'Virginia',      country:'US' },
    { id:'az-eastus2',         name:'Azure East US 2',             provider:'azure',   lat:36.67,  lng:-78.37,  city:'Virginia',      country:'US' },
    { id:'az-westus',          name:'Azure West US',               provider:'azure',   lat:37.78,  lng:-122.42, city:'San Francisco', country:'US' },
    { id:'az-westus2',         name:'Azure West US 2',             provider:'azure',   lat:47.23,  lng:-119.85, city:'Washington',    country:'US' },
    { id:'az-centralus',       name:'Azure Central US',            provider:'azure',   lat:41.87,  lng:-93.1,   city:'Iowa',          country:'US' },
    { id:'az-northeurope',     name:'Azure North Europe',          provider:'azure',   lat:53.33,  lng:-6.25,   city:'Dublin',        country:'IE' },
    { id:'az-westeurope',      name:'Azure West Europe',           provider:'azure',   lat:52.37,  lng:4.9,     city:'Amsterdam',     country:'NL' },
    { id:'az-uksouth',         name:'Azure UK South',              provider:'azure',   lat:51.5,   lng:-0.1,    city:'London',        country:'GB' },
    { id:'az-francecentral',   name:'Azure France Central',        provider:'azure',   lat:46.8,   lng:2.35,    city:'Paris',         country:'FR' },
    { id:'az-germanywestcentral',name:'Azure Germany West Central',provider:'azure',   lat:50.11,  lng:8.68,    city:'Frankfurt',     country:'DE' },
    { id:'az-switzerlandnorth',name:'Azure Switzerland North',     provider:'azure',   lat:47.45,  lng:8.56,    city:'Zürich',        country:'CH' },
    { id:'az-swedencentral',   name:'Azure Sweden Central',        provider:'azure',   lat:60.67,  lng:17.14,   city:'Gävle',         country:'SE' },
    { id:'az-norwayeast',      name:'Azure Norway East',           provider:'azure',   lat:59.91,  lng:10.75,   city:'Oslo',          country:'NO' },
    { id:'az-polandcentral',   name:'Azure Poland Central',        provider:'azure',   lat:52.23,  lng:21.01,   city:'Warsaw',        country:'PL' },
    { id:'az-italynorth',      name:'Azure Italy North',           provider:'azure',   lat:45.47,  lng:9.19,    city:'Milan',         country:'IT' },
    { id:'az-spaincentral',    name:'Azure Spain Central',         provider:'azure',   lat:40.42,  lng:-3.7,    city:'Madrid',        country:'ES' },
    { id:'az-eastasia',        name:'Azure East Asia',             provider:'azure',   lat:22.32,  lng:114.17,  city:'Hong Kong',     country:'HK' },
    { id:'az-southeastasia',   name:'Azure Southeast Asia',        provider:'azure',   lat:1.35,   lng:103.82,  city:'Singapore',     country:'SG' },
    { id:'az-japaneast',       name:'Azure Japan East',            provider:'azure',   lat:35.69,  lng:139.69,  city:'Tokyo',         country:'JP' },
    { id:'az-koreacentral',    name:'Azure Korea Central',         provider:'azure',   lat:37.57,  lng:126.98,  city:'Seoul',         country:'KR' },
    { id:'az-australiaeast',   name:'Azure Australia East',        provider:'azure',   lat:-33.87, lng:151.21,  city:'Sydney',        country:'AU' },
    { id:'az-centralindia',    name:'Azure Central India',         provider:'azure',   lat:18.52,  lng:73.86,   city:'Pune',          country:'IN' },
    { id:'az-brazilsouth',     name:'Azure Brazil South',          provider:'azure',   lat:-23.55, lng:-46.63,  city:'São Paulo',     country:'BR' },
    { id:'az-canadacentral',   name:'Azure Canada Central',        provider:'azure',   lat:43.65,  lng:-79.38,  city:'Toronto',       country:'CA' },
    { id:'az-southafricanorth',name:'Azure South Africa North',    provider:'azure',   lat:-26.2,  lng:28.04,   city:'Johannesburg',  country:'ZA' },
    { id:'az-uaenorth',        name:'Azure UAE North',             provider:'azure',   lat:25.2,   lng:55.27,   city:'Dubai',         country:'AE' },
    { id:'az-israelcentral',   name:'Azure Israel Central',        provider:'azure',   lat:32.07,  lng:34.79,   city:'Tel Aviv',      country:'IL' },
    { id:'az-qatarcentral',    name:'Azure Qatar Central',         provider:'azure',   lat:25.28,  lng:51.53,   city:'Doha',          country:'QA' },
    { id:'az-mexicocentral',   name:'Azure Mexico Central',        provider:'azure',   lat:20.97,  lng:-101.92, city:'Querétaro',     country:'MX' },
    // Equinix flagship campuses
    { id:'eq-ny',              name:'Equinix NY (New York)',       provider:'equinix', lat:40.85,  lng:-74.15,  city:'Secaucus',      country:'US' },
    { id:'eq-sv',              name:'Equinix SV (Silicon Valley)', provider:'equinix', lat:37.39,  lng:-121.96, city:'San Jose',      country:'US' },
    { id:'eq-la',              name:'Equinix LA (Los Angeles)',    provider:'equinix', lat:33.98,  lng:-118.18, city:'El Segundo',    country:'US' },
    { id:'eq-ch',              name:'Equinix CH (Chicago)',        provider:'equinix', lat:41.85,  lng:-87.65,  city:'Chicago',       country:'US' },
    { id:'eq-da',              name:'Equinix DA (Dallas)',         provider:'equinix', lat:32.77,  lng:-96.79,  city:'Dallas',        country:'US' },
    { id:'eq-dc',              name:'Equinix DC (Washington DC)',  provider:'equinix', lat:38.9,   lng:-77.04,  city:'Washington DC', country:'US' },
    { id:'eq-se',              name:'Equinix SE (Seattle)',        provider:'equinix', lat:47.6,   lng:-122.33, city:'Seattle',       country:'US' },
    { id:'eq-am',              name:'Equinix AM (Amsterdam)',      provider:'equinix', lat:52.37,  lng:4.9,     city:'Amsterdam',     country:'NL' },
    { id:'eq-fr',              name:'Equinix FR (Frankfurt)',      provider:'equinix', lat:50.11,  lng:8.7,     city:'Frankfurt',     country:'DE' },
    { id:'eq-ld',              name:'Equinix LD (London)',         provider:'equinix', lat:51.5,   lng:-0.1,    city:'London',        country:'GB' },
    { id:'eq-pa',              name:'Equinix PA (Paris)',          provider:'equinix', lat:48.86,  lng:2.35,    city:'Paris',         country:'FR' },
    { id:'eq-zu',              name:'Equinix ZU (Zürich)',         provider:'equinix', lat:47.38,  lng:8.56,    city:'Zürich',        country:'CH' },
    { id:'eq-si',              name:'Equinix SI (Singapore)',      provider:'equinix', lat:1.35,   lng:103.82,  city:'Singapore',     country:'SG' },
    { id:'eq-ty',              name:'Equinix TY (Tokyo)',          provider:'equinix', lat:35.68,  lng:139.77,  city:'Tokyo',         country:'JP' },
    { id:'eq-sy',              name:'Equinix SY (Sydney)',         provider:'equinix', lat:-33.87, lng:151.21,  city:'Sydney',        country:'AU' },
    { id:'eq-hk',              name:'Equinix HK (Hong Kong)',      provider:'equinix', lat:22.32,  lng:114.17,  city:'Hong Kong',     country:'HK' },
    { id:'eq-sp',              name:'Equinix SP (São Paulo)',      provider:'equinix', lat:-23.55, lng:-46.63,  city:'São Paulo',     country:'BR' },
    { id:'eq-jh',              name:'Equinix JH (Johannesburg)',   provider:'equinix', lat:-26.2,  lng:28.04,   city:'Johannesburg',  country:'ZA' },
    { id:'eq-md',              name:'Equinix MD (Madrid)',         provider:'equinix', lat:40.42,  lng:-3.7,    city:'Madrid',        country:'ES' },
    { id:'eq-ml',              name:'Equinix ML (Milan)',          provider:'equinix', lat:45.47,  lng:9.19,    city:'Milan',         country:'IT' },
    { id:'eq-os',              name:'Equinix OS (Osaka)',          provider:'equinix', lat:34.69,  lng:135.5,   city:'Osaka',         country:'JP' },
    { id:'eq-se2',             name:'Equinix SE (Seoul)',          provider:'equinix', lat:37.57,  lng:126.98,  city:'Seoul',         country:'KR' },
  ];

  await writeFile(`${OUT}/datacenters.json`, JSON.stringify(dcs));
  console.log(`datacenters: ${dcs.length}`);
}

// ── IXPs via PeeringDB facilities ─────────────────────────────────────────────
async function buildIxps() {
  // PeeringDB /api/fac has lat/lng for each facility; filter those hosting IXPs
  const res = await fetch(
    'https://www.peeringdb.com/api/fac?ix_count__gt=0&depth=0&limit=1000',
    { headers: { 'User-Agent': 'ipmap-etl/1.0' } }
  );
  const json = await res.json();
  const ixps = (json.data ?? [])
    .filter(f => f.latitude && f.longitude && f.status === 'ok')
    .map(f => ({
      id: f.id,
      name: f.name,
      lat: parseFloat(f.latitude),
      lng: parseFloat(f.longitude),
      city: f.city,
      country: f.country,
      netCount: f.net_count ?? 0,
    }));
  await writeFile(`${OUT}/ixps.json`, JSON.stringify(ixps));
  console.log(`ixps: ${ixps.length}`);
}

(async () => {
  await buildCables();
  await buildDataCenters();
  await buildIxps();
  console.log('done');
})();
