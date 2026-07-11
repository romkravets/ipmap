export type EconomicType =
  | "port" | "airport" | "industrial"
  | "oil" | "gas" | "gold" | "diamond"
  | "copper" | "iron" | "coal" | "bauxite" | "uranium";

export interface EconomicPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: EconomicType;
  country: string;
  detail: string;
  tier: 1 | 2 | 3;
}

export const ECONOMIC_COLORS: Record<EconomicType, string> = {
  port:       "#06b6d4",
  airport:    "#94a3b8",
  industrial: "#f59e0b",
  oil:        "#ea580c",
  gas:        "#7dd3fc",
  gold:       "#fbbf24",
  diamond:    "#e0f2fe",
  copper:     "#b45309",
  iron:       "#ef4444",
  coal:       "#6b7280",
  bauxite:    "#a16207",
  uranium:    "#84cc16",
};

export const ECONOMIC_LABELS: Record<EconomicType, string> = {
  port:       "PORT",
  airport:    "AIRPORT",
  industrial: "INDUSTRIAL",
  oil:        "OIL",
  gas:        "GAS",
  gold:       "GOLD",
  diamond:    "DIAMOND",
  copper:     "COPPER",
  iron:       "IRON ORE",
  coal:       "COAL",
  bauxite:    "BAUXITE",
  uranium:    "URANIUM",
};

export const ECONOMIC_POINTS: EconomicPoint[] = [
  // ── PORTS ────────────────────────────────────────────────────────────────────
  { id: "port-shanghai",      name: "Shanghai Port",           lat: 31.23,  lng: 121.47,  type: "port", country: "China",       detail: "World's busiest container port by volume",          tier: 1 },
  { id: "port-rotterdam",     name: "Rotterdam",               lat: 51.90,  lng: 4.48,    type: "port", country: "Netherlands", detail: "Largest port in Europe, gateway to the continent",  tier: 1 },
  { id: "port-singapore",     name: "Singapore Port",          lat: 1.27,   lng: 103.82,  type: "port", country: "Singapore",   detail: "World's second busiest port, key transshipment hub", tier: 1 },
  { id: "port-busan",         name: "Busan Port",              lat: 35.10,  lng: 129.04,  type: "port", country: "South Korea", detail: "Northeast Asia's largest transshipment port",        tier: 1 },
  { id: "port-ningbo",        name: "Ningbo-Zhoushan",         lat: 29.87,  lng: 121.55,  type: "port", country: "China",       detail: "World's third busiest port, major bulk cargo hub",  tier: 1 },
  { id: "port-guangzhou",     name: "Guangzhou/Nansha",        lat: 22.75,  lng: 113.62,  type: "port", country: "China",       detail: "Pearl River Delta gateway, major auto export port",  tier: 1 },
  { id: "port-qingdao",       name: "Qingdao Port",            lat: 36.07,  lng: 120.32,  type: "port", country: "China",       detail: "Major Chinese port for iron ore and crude oil",      tier: 1 },
  { id: "port-tianjin",       name: "Tianjin Port",            lat: 38.98,  lng: 117.74,  type: "port", country: "China",       detail: "Northern China's largest port, serves Beijing area", tier: 1 },
  { id: "port-hongkong",      name: "Hong Kong Port",          lat: 22.31,  lng: 114.17,  type: "port", country: "China/HK",   detail: "Major transshipment and container port in Asia",     tier: 1 },
  { id: "port-la-lb",         name: "Los Angeles/Long Beach",  lat: 33.74,  lng: -118.27, type: "port", country: "USA",         detail: "Largest port complex in the Western Hemisphere",     tier: 1 },
  { id: "port-hamburg",       name: "Hamburg Port",            lat: 53.54,  lng: 9.97,    type: "port", country: "Germany",     detail: "Germany's largest port, European trade gateway",     tier: 2 },
  { id: "port-antwerp",       name: "Antwerp Port",            lat: 51.23,  lng: 4.42,    type: "port", country: "Belgium",     detail: "Europe's second busiest port, chemical hub",         tier: 2 },
  { id: "port-jebel-ali",     name: "Dubai Jebel Ali",         lat: 24.99,  lng: 55.06,   type: "port", country: "UAE",         detail: "World's largest man-made harbor, MENA hub",          tier: 2 },
  { id: "port-klang",         name: "Port Klang",              lat: 3.00,   lng: 101.35,  type: "port", country: "Malaysia",    detail: "Malaysia's primary port and ASEAN trade gateway",    tier: 2 },
  { id: "port-kaohsiung",     name: "Kaohsiung Port",          lat: 22.62,  lng: 120.27,  type: "port", country: "Taiwan",      detail: "Taiwan's largest port and container terminal",       tier: 2 },

  // ── AIRPORTS ─────────────────────────────────────────────────────────────────
  { id: "air-dubai",          name: "Dubai International",     lat: 25.25,  lng: 55.36,   type: "airport", country: "UAE",         detail: "World's busiest airport by international passengers", tier: 1 },
  { id: "air-atlanta",        name: "Hartsfield-Jackson Atlanta", lat: 33.64, lng: -84.43, type: "airport", country: "USA",        detail: "World's busiest airport by total passengers",         tier: 1 },
  { id: "air-heathrow",       name: "London Heathrow",         lat: 51.48,  lng: -0.45,   type: "airport", country: "UK",          detail: "Europe's busiest airport, global aviation hub",       tier: 1 },
  { id: "air-haneda",         name: "Tokyo Haneda",            lat: 35.55,  lng: 139.78,  type: "airport", country: "Japan",       detail: "Asia's busiest airport, serves greater Tokyo area",   tier: 1 },
  { id: "air-ohare",          name: "Chicago O'Hare",          lat: 41.98,  lng: -87.90,  type: "airport", country: "USA",         detail: "Major US hub, world's second busiest by operations",  tier: 1 },
  { id: "air-lax",            name: "Los Angeles LAX",         lat: 33.94,  lng: -118.40, type: "airport", country: "USA",         detail: "Primary gateway for trans-Pacific air travel",        tier: 1 },
  { id: "air-cdg",            name: "Paris CDG",               lat: 49.01,  lng: 2.55,    type: "airport", country: "France",      detail: "Europe's second busiest, major Air France hub",        tier: 1 },
  { id: "air-pudong",         name: "Shanghai Pudong",         lat: 31.14,  lng: 121.80,  type: "airport", country: "China",       detail: "China's busiest international cargo airport",         tier: 1 },
  { id: "air-beijing",        name: "Beijing Capital",         lat: 40.07,  lng: 116.60,  type: "airport", country: "China",       detail: "China's primary international gateway airport",       tier: 1 },
  { id: "air-changi",         name: "Singapore Changi",        lat: 1.36,   lng: 103.99,  type: "airport", country: "Singapore",   detail: "Repeatedly rated world's best airport",               tier: 1 },
  { id: "air-frankfurt",      name: "Frankfurt Airport",       lat: 50.03,  lng: 8.57,    type: "airport", country: "Germany",     detail: "Germany's main hub, Europe's third busiest airport",  tier: 1 },
  { id: "air-incheon",        name: "Incheon Seoul",           lat: 37.46,  lng: 126.44,  type: "airport", country: "South Korea", detail: "Northeast Asia's premier hub airport",                tier: 1 },
  { id: "air-schiphol",       name: "Amsterdam Schiphol",      lat: 52.31,  lng: 4.77,    type: "airport", country: "Netherlands", detail: "Europe's fourth busiest airport, KLM home base",      tier: 1 },
  { id: "air-hkia",           name: "Hong Kong International", lat: 22.31,  lng: 113.91,  type: "airport", country: "China/HK",   detail: "World's busiest cargo airport by freight volume",     tier: 1 },

  // ── INDUSTRIAL ───────────────────────────────────────────────────────────────
  { id: "ind-houston",        name: "Houston",                 lat: 29.76,  lng: -95.37,  type: "industrial", country: "USA",         detail: "Energy capital of the world",                         tier: 1 },
  { id: "ind-detroit",        name: "Detroit",                 lat: 42.33,  lng: -83.05,  type: "industrial", country: "USA",         detail: "Automotive hub, Motor City",                          tier: 2 },
  { id: "ind-pittsburgh",     name: "Pittsburgh",              lat: 40.44,  lng: -79.99,  type: "industrial", country: "USA",         detail: "Steel legacy city turned tech hub",                   tier: 2 },
  { id: "ind-shenzhen",       name: "Shenzhen",                lat: 22.54,  lng: 114.06,  type: "industrial", country: "China",       detail: "Global electronics manufacturing capital",            tier: 1 },
  { id: "ind-dongguan",       name: "Dongguan",                lat: 23.02,  lng: 113.74,  type: "industrial", country: "China",       detail: "World factory, dense manufacturing hub",              tier: 2 },
  { id: "ind-saopaulo",       name: "São Paulo",               lat: -23.55, lng: -46.63,  type: "industrial", country: "Brazil",      detail: "Largest industrial city in the Americas",             tier: 1 },
  { id: "ind-mumbai",         name: "Mumbai",                  lat: 19.08,  lng: 72.88,   type: "industrial", country: "India",       detail: "Financial and industrial capital of India",            tier: 1 },
  { id: "ind-osaka",          name: "Osaka",                   lat: 34.69,  lng: 135.50,  type: "industrial", country: "Japan",       detail: "Japan's second industrial and commercial center",     tier: 1 },
  { id: "ind-ruhr",           name: "Ruhr Valley",             lat: 51.50,  lng: 7.50,    type: "industrial", country: "Germany",     detail: "Europe's largest industrial heartland",               tier: 1 },
  { id: "ind-magnitogorsk",   name: "Magnitogorsk",            lat: 53.41,  lng: 59.06,   type: "industrial", country: "Russia",      detail: "Russia's steel capital on the Ural River",            tier: 2 },
  { id: "ind-anshan",         name: "Anshan",                  lat: 41.12,  lng: 122.99,  type: "industrial", country: "China",       detail: "China's traditional steel city",                      tier: 2 },
  { id: "ind-jamshedpur",     name: "Jamshedpur",              lat: 22.80,  lng: 86.20,   type: "industrial", country: "India",       detail: "Tata Steel city, India's steel capital",              tier: 2 },
  { id: "ind-jubail",         name: "Jubail",                  lat: 27.00,  lng: 49.66,   type: "industrial", country: "Saudi Arabia", detail: "World's largest industrial city, petrochemicals",    tier: 1 },
  { id: "ind-ulsan",          name: "Ulsan",                   lat: 35.54,  lng: 129.31,  type: "industrial", country: "South Korea", detail: "Hyundai shipbuilding and automotive powerhouse",       tier: 1 },

  // ── OIL FIELDS ───────────────────────────────────────────────────────────────
  { id: "oil-ghawar",         name: "Ghawar Field",            lat: 25.15,  lng: 49.50,   type: "oil", country: "Saudi Arabia", detail: "World's largest conventional oil field",              tier: 1 },
  { id: "oil-burgan",         name: "Burgan Field",            lat: 28.95,  lng: 47.97,   type: "oil", country: "Kuwait",      detail: "World's second largest oil field",                    tier: 1 },
  { id: "oil-safaniya",       name: "Safaniya Field",          lat: 27.99,  lng: 48.78,   type: "oil", country: "Saudi Arabia", detail: "World's largest offshore oil field",                 tier: 1 },
  { id: "oil-rumaila",        name: "Rumaila Field",           lat: 30.30,  lng: 47.53,   type: "oil", country: "Iraq",        detail: "Iraq's largest oil field, produces ~1.4M bpd",        tier: 1 },
  { id: "oil-west-qurna",     name: "West Qurna",              lat: 30.47,  lng: 47.54,   type: "oil", country: "Iraq",        detail: "Giant oil field, developed by ExxonMobil/Shell",      tier: 1 },
  { id: "oil-kirkuk",         name: "Kirkuk Field",            lat: 35.47,  lng: 44.39,   type: "oil", country: "Iraq",        detail: "Iraq's oldest major oil field, disputed territory",   tier: 2 },
  { id: "oil-kashagan",       name: "Kashagan Field",          lat: 46.00,  lng: 51.65,   type: "oil", country: "Kazakhstan",  detail: "World's largest discovered field since 1968",         tier: 1 },
  { id: "oil-tengiz",         name: "Tengiz Field",            lat: 45.44,  lng: 53.10,   type: "oil", country: "Kazakhstan",  detail: "Giant oil field operated by Chevron-led consortium",  tier: 1 },
  { id: "oil-samotlor",       name: "Samotlor Field",          lat: 61.02,  lng: 76.70,   type: "oil", country: "Russia",      detail: "Russia's largest oil field, West Siberia",            tier: 1 },
  { id: "oil-romashkino",     name: "Romashkino Field",        lat: 54.56,  lng: 52.35,   type: "oil", country: "Russia",      detail: "One of world's largest oil fields, Volga-Ural basin", tier: 2 },
  { id: "oil-prudhoe-bay",    name: "Prudhoe Bay",             lat: 70.25,  lng: -148.70, type: "oil", country: "USA",         detail: "North America's largest oil field, Arctic Alaska",    tier: 1 },
  { id: "oil-athabasca",      name: "Athabasca Oil Sands",     lat: 57.00,  lng: -111.50, type: "oil", country: "Canada",      detail: "World's third largest proven oil reserves",           tier: 1 },
  { id: "oil-permian",        name: "Permian Basin",           lat: 31.83,  lng: -102.37, type: "oil", country: "USA",         detail: "USA's most prolific oil-producing region",            tier: 1 },
  { id: "oil-bakken",         name: "Bakken Shale",            lat: 47.80,  lng: -103.30, type: "oil", country: "USA",         detail: "Major shale oil formation, North Dakota",             tier: 2 },
  { id: "oil-niger-delta",    name: "Niger Delta",             lat: 4.80,   lng: 6.40,    type: "oil", country: "Nigeria",     detail: "Africa's largest oil-producing region",               tier: 1 },
  { id: "oil-maracaibo",      name: "Maracaibo Basin",         lat: 10.67,  lng: -71.61,  type: "oil", country: "Venezuela",   detail: "Venezuela's primary oil-producing basin",             tier: 1 },
  { id: "oil-cantarell",      name: "Cantarell Field",         lat: 19.85,  lng: -91.67,  type: "oil", country: "Mexico",      detail: "Mexico's supergiant offshore oil field",              tier: 2 },
  { id: "oil-ekofisk",        name: "Ekofisk",                 lat: 56.53,  lng: 3.21,    type: "oil", country: "Norway",      detail: "First major North Sea oil discovery",                 tier: 2 },
  { id: "oil-buzzard",        name: "Buzzard Field",           lat: 57.85,  lng: 0.42,    type: "oil", country: "UK",          detail: "UK's largest producing North Sea oil field",          tier: 2 },
  { id: "oil-johan-sverdrup",  name: "Johan Sverdrup",         lat: 58.84,  lng: 2.46,    type: "oil", country: "Norway",      detail: "Norway's largest oil discovery in 30 years",          tier: 2 },

  // ── GAS FIELDS ───────────────────────────────────────────────────────────────
  { id: "gas-south-pars",     name: "South Pars/North Dome",   lat: 26.90,  lng: 52.80,   type: "gas", country: "Qatar/Iran",  detail: "World's largest natural gas field",                   tier: 1 },
  { id: "gas-urengoy",        name: "Urengoy Field",           lat: 65.97,  lng: 78.38,   type: "gas", country: "Russia",      detail: "World's second largest gas field, West Siberia",      tier: 1 },
  { id: "gas-yamburg",        name: "Yamburg Field",           lat: 68.23,  lng: 75.88,   type: "gas", country: "Russia",      detail: "Russia's third largest gas field",                    tier: 1 },
  { id: "gas-bovanenkovo",    name: "Bovanenkovo Field",       lat: 70.34,  lng: 68.06,   type: "gas", country: "Russia",      detail: "Giant Arctic gas field on Yamal Peninsula",           tier: 1 },
  { id: "gas-shtokman",       name: "Shtokman Field",          lat: 72.37,  lng: 43.26,   type: "gas", country: "Russia",      detail: "Massive undeveloped Arctic offshore gas field",        tier: 2 },
  { id: "gas-marcellus",      name: "Marcellus Shale",         lat: 41.80,  lng: -77.20,  type: "gas", country: "USA",         detail: "Largest natural gas field in North America",          tier: 1 },
  { id: "gas-haynesville",    name: "Haynesville Shale",       lat: 32.20,  lng: -93.50,  type: "gas", country: "USA",         detail: "Major dry gas shale play, Louisiana/Texas",           tier: 2 },
  { id: "gas-groningen",      name: "Groningen Field",         lat: 53.25,  lng: 6.80,    type: "gas", country: "Netherlands", detail: "Europe's largest gas field, now being wound down",    tier: 2 },
  { id: "gas-galkynysh",      name: "Galkynysh Field",         lat: 37.73,  lng: 62.80,   type: "gas", country: "Turkmenistan", detail: "World's second largest gas field by reserves",       tier: 1 },
  { id: "gas-hugoton",        name: "Hugoton Field",           lat: 37.50,  lng: -101.00, type: "gas", country: "USA",         detail: "One of world's largest natural gas fields, US Plains", tier: 2 },
  { id: "gas-ras-laffan",     name: "Ras Laffan LNG",          lat: 25.90,  lng: 51.55,   type: "gas", country: "Qatar",       detail: "World's largest LNG export facility",                 tier: 1 },
  { id: "gas-bass-strait",    name: "Bass Strait",             lat: -38.50, lng: 148.00,  type: "gas", country: "Australia",   detail: "Major gas production zone for southern Australia",    tier: 2 },
  { id: "gas-gorgon",         name: "Gorgon LNG",              lat: -21.58, lng: 114.20,  type: "gas", country: "Australia",   detail: "Australia's largest resource project, offshore LNG",  tier: 1 },

  // ── GOLD MINES ───────────────────────────────────────────────────────────────
  { id: "gold-muruntau",      name: "Muruntau Mine",           lat: 41.58,  lng: 64.47,   type: "gold", country: "Uzbekistan",  detail: "World's largest open-pit gold mine",                  tier: 1 },
  { id: "gold-carlin-trend",  name: "Carlin Trend",            lat: 40.70,  lng: -116.40, type: "gold", country: "USA",         detail: "USA's most productive gold mining district",           tier: 1 },
  { id: "gold-yanacocha",     name: "Yanacocha Mine",          lat: -6.93,  lng: -78.60,  type: "gold", country: "Peru",        detail: "South America's largest gold mine",                   tier: 1 },
  { id: "gold-grasberg",      name: "Grasberg Mine",           lat: -4.05,  lng: 137.12,  type: "gold", country: "Indonesia",   detail: "World's largest gold mine and second largest copper",  tier: 1 },
  { id: "gold-olimpiada",     name: "Olimpiada Mine",          lat: 59.50,  lng: 97.87,   type: "gold", country: "Russia",      detail: "Russia's largest gold mine, Polyus-operated",         tier: 1 },
  { id: "gold-superpit",      name: "Super Pit Kalgoorlie",    lat: -30.78, lng: 121.50,  type: "gold", country: "Australia",   detail: "Australia's largest open-pit gold mine",              tier: 1 },
  { id: "gold-boddington",    name: "Boddington Mine",         lat: -32.79, lng: 116.37,  type: "gold", country: "Australia",   detail: "Australia's largest gold producer",                   tier: 2 },
  { id: "gold-lihir",         name: "Lihir Gold Mine",         lat: -3.12,  lng: 152.64,  type: "gold", country: "Papua New Guinea", detail: "One of world's largest gold deposits",            tier: 2 },
  { id: "gold-kibali",        name: "Kibali Gold Mine",        lat: 3.57,   lng: 29.58,   type: "gold", country: "DR Congo",    detail: "Africa's largest gold mine by production",            tier: 1 },
  { id: "gold-loulo",         name: "Loulo-Gounkoto",          lat: 14.12,  lng: -11.31,  type: "gold", country: "Mali",        detail: "West Africa's largest gold complex",                  tier: 2 },
  { id: "gold-goldstrike",    name: "Nevada Goldstrike",       lat: 41.04,  lng: -116.40, type: "gold", country: "USA",         detail: "Major Nevada gold mine, Barrick operated",            tier: 2 },
  { id: "gold-pueblo-viejo",  name: "Pueblo Viejo Mine",       lat: 19.00,  lng: -70.55,  type: "gold", country: "Dom. Republic", detail: "Caribbean's largest gold mine",                    tier: 2 },
  { id: "gold-mponeng",       name: "Mponeng Mine",            lat: -26.48, lng: 27.57,   type: "gold", country: "South Africa", detail: "World's deepest gold mine, 4km underground",         tier: 1 },
  { id: "gold-obuasi",        name: "Obuasi Mine",             lat: 6.20,   lng: -1.67,   type: "gold", country: "Ghana",       detail: "Ghana's largest and oldest gold mine",                tier: 2 },
  { id: "gold-ahafo",         name: "Ahafo Mine",              lat: 7.45,   lng: -2.33,   type: "gold", country: "Ghana",       detail: "Newmont's major gold operation in Ghana",             tier: 2 },

  // ── DIAMOND MINES ────────────────────────────────────────────────────────────
  { id: "dia-jwaneng",        name: "Jwaneng Mine",            lat: -24.60, lng: 24.73,   type: "diamond", country: "Botswana",    detail: "World's richest diamond mine by value",             tier: 1 },
  { id: "dia-orapa",          name: "Orapa Mine",              lat: -21.30, lng: 25.37,   type: "diamond", country: "Botswana",    detail: "World's largest diamond mine by area",              tier: 1 },
  { id: "dia-jubilee",        name: "Jubilee Mine (Nyurba)",   lat: 66.43,  lng: 123.72,  type: "diamond", country: "Russia",      detail: "Major Yakutian diamond mine, ALROSA-operated",      tier: 2 },
  { id: "dia-udachnaya",      name: "Udachnaya Mine",          lat: 66.42,  lng: 112.30,  type: "diamond", country: "Russia",      detail: "One of world's largest diamond pipes, Yakutia",     tier: 1 },
  { id: "dia-mir",            name: "Mir Mine",                lat: 62.53,  lng: 113.98,  type: "diamond", country: "Russia",      detail: "Former world's largest diamond mine, now flooded",  tier: 2 },
  { id: "dia-venetia",        name: "Venetia Mine",            lat: -22.38, lng: 29.34,   type: "diamond", country: "South Africa", detail: "South Africa's largest diamond producer",          tier: 1 },
  { id: "dia-cullinan",       name: "Premier/Cullinan Mine",   lat: -25.68, lng: 28.52,   type: "diamond", country: "South Africa", detail: "Source of the Cullinan diamond, world's largest",  tier: 2 },
  { id: "dia-ekati",          name: "Ekati Mine",              lat: 64.72,  lng: -110.61, type: "diamond", country: "Canada",      detail: "Canada's first diamond mine, Northwest Territories", tier: 2 },
  { id: "dia-diavik",         name: "Diavik Mine",             lat: 64.51,  lng: -110.18, type: "diamond", country: "Canada",      detail: "Major Canadian Arctic diamond mine",                tier: 2 },
  { id: "dia-argyle",         name: "Argyle Mine",             lat: -16.72, lng: 128.39,  type: "diamond", country: "Australia",   detail: "World's largest diamond mine by volume (closed 2020)", tier: 2 },
  { id: "dia-williamson",     name: "Williamson Mine",         lat: -3.51,  lng: 33.60,   type: "diamond", country: "Tanzania",    detail: "Africa's only significant diamond mine outside SA",  tier: 3 },
  { id: "dia-luele",          name: "Luele Mine",              lat: -9.00,  lng: 20.70,   type: "diamond", country: "Angola",      detail: "Angola's major diamond producing area",             tier: 3 },

  // ── COPPER MINES ─────────────────────────────────────────────────────────────
  { id: "cu-escondida",       name: "Escondida Mine",          lat: -24.27, lng: -69.07,  type: "copper", country: "Chile",       detail: "World's largest copper mine, BHP operated",          tier: 1 },
  { id: "cu-chuquicamata",    name: "Chuquicamata Mine",       lat: -22.31, lng: -68.90,  type: "copper", country: "Chile",       detail: "World's largest open-pit copper mine by volume",     tier: 1 },
  { id: "cu-cerro-verde",     name: "Cerro Verde Mine",        lat: -16.55, lng: -71.57,  type: "copper", country: "Peru",        detail: "Peru's largest copper mine, Freeport-operated",      tier: 1 },
  { id: "cu-antamina",        name: "Antamina Mine",           lat: -9.53,  lng: -77.05,  type: "copper", country: "Peru",        detail: "World-class copper-zinc mine in the Andes",          tier: 1 },
  { id: "cu-collahuasi",      name: "Collahuasi Mine",         lat: -20.98, lng: -68.63,  type: "copper", country: "Chile",       detail: "One of world's largest copper deposits at 4,500m",   tier: 1 },
  { id: "cu-bingham",         name: "Bingham Canyon",          lat: 40.52,  lng: -112.15, type: "copper", country: "USA",         detail: "World's deepest open-pit mine",                      tier: 1 },
  { id: "cu-norilsk",         name: "Norilsk",                 lat: 69.34,  lng: 88.20,   type: "copper", country: "Russia",      detail: "World's largest nickel and palladium producer",      tier: 1 },
  { id: "cu-konkola",         name: "Konkola Mine",            lat: -12.76, lng: 27.78,   type: "copper", country: "Zambia",      detail: "Zambia's largest underground copper mine",           tier: 2 },
  { id: "cu-kansanshi",       name: "Kansanshi Mine",          lat: -12.10, lng: 25.85,   type: "copper", country: "Zambia",      detail: "Africa's largest copper mine",                       tier: 1 },
  { id: "cu-olympic-dam",     name: "Olympic Dam",             lat: -30.44, lng: 136.89,  type: "copper", country: "Australia",   detail: "World's largest known uranium-copper-gold deposit",  tier: 1 },
  { id: "cu-el-teniente",     name: "El Teniente Mine",        lat: -34.09, lng: -70.56,  type: "copper", country: "Chile",       detail: "World's largest underground copper mine",            tier: 1 },

  // ── IRON ORE ─────────────────────────────────────────────────────────────────
  { id: "fe-carajas",         name: "Carajás Mine",            lat: -6.10,  lng: -50.18,  type: "iron", country: "Brazil",      detail: "World's largest iron ore mine, Vale-operated",        tier: 1 },
  { id: "fe-pilbara",         name: "Hamersley/Pilbara",       lat: -22.40, lng: 118.30,  type: "iron", country: "Australia",   detail: "Australia's iron ore heartland, ~800Mt/yr exported",  tier: 1 },
  { id: "fe-simandou",        name: "Simandou",                lat: 8.50,   lng: -9.00,   type: "iron", country: "Guinea",      detail: "World's largest untapped iron ore deposit",           tier: 2 },
  { id: "fe-kiruna",          name: "Kiruna Mine",             lat: 67.85,  lng: 20.23,   type: "iron", country: "Sweden",      detail: "Europe's largest iron ore mine",                      tier: 2 },
  { id: "fe-lebedinsky",      name: "Lebedinsky GOK",          lat: 51.06,  lng: 37.57,   type: "iron", country: "Russia",      detail: "Russia's largest iron ore deposit",                   tier: 2 },
  { id: "fe-sishen",          name: "Sishen Mine",             lat: -27.81, lng: 23.00,   type: "iron", country: "South Africa", detail: "Africa's largest iron ore mine",                     tier: 2 },
  { id: "fe-samarco",         name: "Samarco Mine",            lat: -20.16, lng: -43.40,  type: "iron", country: "Brazil",      detail: "Major iron ore pellet producer, Vale/BHP JV",        tier: 2 },
  { id: "fe-ioc",             name: "Iron Ore Company Canada", lat: 52.93,  lng: -66.85,  type: "iron", country: "Canada",      detail: "Canada's largest iron ore mine, Labrador",            tier: 2 },
  { id: "fe-labrador-trough", name: "Labrador Trough",         lat: 53.00,  lng: -65.50,  type: "iron", country: "Canada",      detail: "Major iron ore region, Quebec-Labrador border",       tier: 2 },
  { id: "fe-chichester",      name: "Chichester Range",        lat: -22.00, lng: 118.90,  type: "iron", country: "Australia",   detail: "Fortescue Metals Group iron ore operations",          tier: 2 },

  // ── COAL ─────────────────────────────────────────────────────────────────────
  { id: "coal-powder-river",  name: "Powder River Basin",      lat: 43.80,  lng: -105.60, type: "coal", country: "USA",         detail: "USA's largest coal-producing region",                 tier: 1 },
  { id: "coal-appalachian",   name: "Appalachian Coal",        lat: 37.50,  lng: -82.00,  type: "coal", country: "USA",         detail: "Historic US coal mining region",                      tier: 2 },
  { id: "coal-ruhr",          name: "Ruhr Coalfield",          lat: 51.50,  lng: 7.10,    type: "coal", country: "Germany",     detail: "Historic European coal heartland, mostly closed",     tier: 2 },
  { id: "coal-donbas",        name: "Donbas Basin",            lat: 48.00,  lng: 38.00,   type: "coal", country: "Ukraine",     detail: "Europe's largest coal basin",                         tier: 1 },
  { id: "coal-kuznetsk",      name: "Kuznetsk Basin",          lat: 53.75,  lng: 86.10,   type: "coal", country: "Russia",      detail: "Russia's largest coal basin, Siberia",                tier: 1 },
  { id: "coal-ekibastuz",     name: "Ekibastuz Basin",         lat: 51.73,  lng: 75.32,   type: "coal", country: "Kazakhstan",  detail: "Central Asia's largest open-pit coal mine",           tier: 2 },
  { id: "coal-shanxi",        name: "Shanxi Province",         lat: 37.50,  lng: 112.00,  type: "coal", country: "China",       detail: "China's coal heartland, largest provincial producer",  tier: 1 },
  { id: "coal-inner-mongolia", name: "Inner Mongolia Coal",    lat: 39.80,  lng: 111.70,  type: "coal", country: "China",       detail: "China's fastest growing coal production region",      tier: 1 },
  { id: "coal-bowen",         name: "Bowen Basin",             lat: -22.50, lng: 148.20,  type: "coal", country: "Australia",   detail: "World's largest coking coal reserve",                 tier: 1 },
  { id: "coal-witbank",       name: "Witbank Coalfield",       lat: -25.87, lng: 29.23,   type: "coal", country: "South Africa", detail: "South Africa's primary coal producing region",       tier: 2 },
  { id: "coal-thar",          name: "Thar Desert Coal",        lat: 24.50,  lng: 69.80,   type: "coal", country: "Pakistan",    detail: "World's sixth largest lignite coal deposit",          tier: 2 },

  // ── BAUXITE / ALUMINA ────────────────────────────────────────────────────────
  { id: "bau-boke",           name: "Boké Region",             lat: 11.00,  lng: -14.30,  type: "bauxite", country: "Guinea",     detail: "World's largest bauxite deposits",                  tier: 1 },
  { id: "bau-weipa",          name: "Weipa Mine",              lat: -12.67, lng: 141.88,  type: "bauxite", country: "Australia",  detail: "World's largest open-cut bauxite mine",             tier: 1 },
  { id: "bau-sangaredi",      name: "Sangaredi Mine",          lat: 11.73,  lng: -13.64,  type: "bauxite", country: "Guinea",     detail: "One of world's highest grade bauxite deposits",     tier: 1 },
  { id: "bau-trombetas",      name: "Trombetas Mine",          lat: -1.46,  lng: -56.38,  type: "bauxite", country: "Brazil",     detail: "Brazil's largest bauxite mine, Amazon region",      tier: 2 },
  { id: "bau-para",           name: "Pará Bauxite",            lat: -5.00,  lng: -48.00,  type: "bauxite", country: "Brazil",     detail: "Major Amazonian bauxite production zone",           tier: 2 },
  { id: "bau-odisha",         name: "Odisha Bauxite",          lat: 20.90,  lng: 85.00,   type: "bauxite", country: "India",      detail: "India's largest bauxite reserve state",             tier: 2 },
  { id: "bau-renukoot",       name: "Renukoot Alumina",        lat: 24.21,  lng: 82.83,   type: "bauxite", country: "India",      detail: "Major Indian aluminum smelter complex",             tier: 2 },
  { id: "bau-fria",           name: "Fria Complex",            lat: 10.37,  lng: -13.55,  type: "bauxite", country: "Guinea",     detail: "Guinea's first bauxite and alumina complex",        tier: 3 },
  { id: "bau-kamsar",         name: "Kamsar Port/Mines",       lat: 10.65,  lng: -14.60,  type: "bauxite", country: "Guinea",     detail: "Guinea's main bauxite export terminal",             tier: 2 },
  { id: "bau-jamaica",        name: "Jamaica Bauxite",         lat: 18.00,  lng: -77.50,  type: "bauxite", country: "Jamaica",    detail: "Caribbean bauxite deposits, historically significant", tier: 3 },

  // ── URANIUM ──────────────────────────────────────────────────────────────────
  { id: "u-athabasca",        name: "Athabasca Basin",         lat: 58.60,  lng: -109.00, type: "uranium", country: "Canada",     detail: "World's highest-grade uranium deposits",            tier: 1 },
  { id: "u-cigar-lake",       name: "Cigar Lake Mine",         lat: 58.68,  lng: -104.90, type: "uranium", country: "Canada",     detail: "World's highest-grade uranium mine in production",  tier: 1 },
  { id: "u-mcarthur-river",   name: "McArthur River Mine",     lat: 57.77,  lng: -105.60, type: "uranium", country: "Canada",     detail: "World's largest high-grade uranium mine",           tier: 1 },
  { id: "u-rossing",          name: "Rössing Mine",            lat: -22.47, lng: 15.04,   type: "uranium", country: "Namibia",    detail: "World's largest open-pit uranium mine (historic)",  tier: 1 },
  { id: "u-husab",            name: "Husab Mine",              lat: -22.86, lng: 14.95,   type: "uranium", country: "Namibia",    detail: "One of world's largest uranium mines",              tier: 1 },
  { id: "u-olympic-dam",      name: "Olympic Dam Uranium",     lat: -30.44, lng: 136.89,  type: "uranium", country: "Australia",  detail: "World's largest uranium deposit by volume",         tier: 1 },
  { id: "u-ranger",           name: "Ranger Mine",             lat: -12.68, lng: 132.92,  type: "uranium", country: "Australia",  detail: "Major Australian uranium mine, now rehabilitating",  tier: 2 },
  { id: "u-arlit",            name: "Arlit Mines",             lat: 18.74,  lng: 7.39,    type: "uranium", country: "Niger",      detail: "Niger's uranium mines, operated by Orano",          tier: 1 },
  { id: "u-priargunsk",       name: "Priargunsk PGKHK",        lat: 51.38,  lng: 119.00,  type: "uranium", country: "Russia",     detail: "Russia's largest uranium mining company",           tier: 2 },
  { id: "u-tortkuduk",        name: "Tortkuduk Mine",          lat: 43.50,  lng: 65.50,   type: "uranium", country: "Kazakhstan", detail: "Major Kazakh uranium ISR operation",                tier: 2 },
  { id: "u-kaz-isr",          name: "Kazakhstan ISR Fields",   lat: 43.00,  lng: 69.00,   type: "uranium", country: "Kazakhstan", detail: "World's largest uranium producer via ISR mining",   tier: 1 },
];
