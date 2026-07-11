"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useLayer } from "@/hooks/useLayers";

// Subscribes to window.globeCamDist updated every animation frame
function useCamDist(): number {
  const distRef = useRef<number>(2.5);
  const [dist, setDist] = useState(2.5);

  useEffect(() => {
    let raf: number;
    const poll = () => {
      const d = window.globeCamDist ?? 2.5;
      if (Math.abs(d - distRef.current) > 0.02) {
        distRef.current = d;
        setDist(d);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  return dist;
}

interface Position { x: number; y: number; visible: boolean; }

interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  tier: 1 | 2 | 3;
  detail: string;
}

// tier 1 = globally critical (G20 capital / top financial / tech megahub)
// tier 2 = major regional hub
// tier 3 = significant secondary city
const CITIES: City[] = [
  // ── North America ──────────────────────────────────────────────────────────
  { id: "washington",   name: "Washington D.C.", country: "USA",        lat: 38.90,  lng: -77.04,  tier: 1, detail: "US federal capital and center of global political power." },
  { id: "newyork",      name: "New York",        country: "USA",        lat: 40.71,  lng: -74.01,  tier: 1, detail: "World's leading financial center; home to NYSE and Wall Street." },
  { id: "losangeles",   name: "Los Angeles",     country: "USA",        lat: 34.05,  lng: -118.24, tier: 1, detail: "Entertainment capital and largest Pacific trade gateway of the Americas." },
  { id: "chicago",      name: "Chicago",         country: "USA",        lat: 41.88,  lng: -87.63,  tier: 1, detail: "Home to CME Group — world's largest derivatives exchange." },
  { id: "sanfrancisco", name: "San Francisco",   country: "USA",        lat: 37.77,  lng: -122.42, tier: 1, detail: "Global capital of tech venture capital and startup culture." },
  { id: "seattle",      name: "Seattle",         country: "USA",        lat: 47.61,  lng: -122.33, tier: 2, detail: "HQ of Amazon, Boeing, and Microsoft — aerospace and cloud computing." },
  { id: "boston",       name: "Boston",          country: "USA",        lat: 42.36,  lng: -71.06,  tier: 2, detail: "Global biotech hub and Ivy League research capital." },
  { id: "dallas",       name: "Dallas",          country: "USA",        lat: 32.78,  lng: -96.80,  tier: 2, detail: "Energy trading, telecom, and financial services mega-center." },
  { id: "miami",        name: "Miami",           country: "USA",        lat: 25.77,  lng: -80.19,  tier: 2, detail: "Gateway to Latin America; finance and crypto hub of the South." },
  { id: "toronto",      name: "Toronto",         country: "Canada",     lat: 43.65,  lng: -79.38,  tier: 1, detail: "Canada's financial capital with the fifth-largest stock exchange in North America." },
  { id: "vancouver",    name: "Vancouver",       country: "Canada",     lat: 49.28,  lng: -123.12, tier: 2, detail: "Canada's Pacific gateway; mining finance and film production hub." },
  { id: "montreal",     name: "Montréal",        country: "Canada",     lat: 45.50,  lng: -73.57,  tier: 2, detail: "Aerospace capital of Canada; home to Bombardier and CAE." },
  { id: "ottawa",       name: "Ottawa",          country: "Canada",     lat: 45.42,  lng: -75.69,  tier: 2, detail: "Canadian federal capital and high-tech government IT corridor." },
  { id: "mexicocity",   name: "Mexico City",     country: "Mexico",     lat: 19.43,  lng: -99.13,  tier: 1, detail: "Latin America's second-largest economy capital and NAFTA trade nexus." },
  { id: "guadalajara",  name: "Guadalajara",     country: "Mexico",     lat: 20.66,  lng: -103.35, tier: 3, detail: "Mexico's Silicon Valley; major electronics manufacturing corridor." },
  { id: "monterrey",   name: "Monterrey",        country: "Mexico",     lat: 25.67,  lng: -100.31, tier: 3, detail: "Mexico's industrial capital; steel, glass, cement and auto manufacturing hub." },
  { id: "houston",     name: "Houston",          country: "USA",        lat: 29.76,  lng: -95.37,  tier: 2, detail: "Global oil & gas capital; home to NASA Johnson Space Center and the Port of Houston." },
  { id: "atlanta",     name: "Atlanta",          country: "USA",        lat: 33.75,  lng: -84.39,  tier: 3, detail: "Home of Coca-Cola, Delta Air Lines HQ, and world's busiest passenger airport." },
  { id: "havana",      name: "Havana",           country: "Cuba",       lat: 23.14,  lng: -82.36,  tier: 3, detail: "Caribbean island capital; major historical port at the entrance to the Gulf of Mexico." },
  { id: "panamaCity",  name: "Panama City",      country: "Panama",     lat: 8.99,   lng: -79.52,  tier: 3, detail: "Capital controlling the Panama Canal — gateway between Atlantic and Pacific." },
  // ── South America ─────────────────────────────────────────────────────────
  { id: "saopablo",     name: "São Paulo",       country: "Brazil",     lat: -23.55, lng: -46.63,  tier: 1, detail: "Latin America's largest financial center and industrial powerhouse." },
  { id: "brasilia",     name: "Brasília",        country: "Brazil",     lat: -15.79, lng: -47.88,  tier: 2, detail: "Brazilian capital planned from scratch; administrative and political center." },
  { id: "rio",          name: "Rio de Janeiro",  country: "Brazil",     lat: -22.91, lng: -43.17,  tier: 2, detail: "Brazil's oil and gas capital; home of Petrobras headquarters." },
  { id: "buenosaires",  name: "Buenos Aires",    country: "Argentina",  lat: -34.60, lng: -58.38,  tier: 1, detail: "South America's second largest economy and Mercosur financial hub." },
  { id: "santiago",     name: "Santiago",        country: "Chile",      lat: -33.46, lng: -70.65,  tier: 2, detail: "Chile's capital; South America's most stable financial market." },
  { id: "lima",         name: "Lima",            country: "Peru",       lat: -12.05, lng: -77.04,  tier: 2, detail: "Andean trade capital and gateway to Peru's vast mineral exports." },
  { id: "bogota",       name: "Bogotá",          country: "Colombia",   lat: 4.71,   lng: -74.07,  tier: 2, detail: "Colombia's capital; South America's fastest-growing financial tech scene." },
  { id: "caracas",      name: "Caracas",         country: "Venezuela",  lat: 10.48,  lng: -66.88,  tier: 3, detail: "Capital of the world's largest proven oil reserves country." },
  { id: "montevideo",  name: "Montevideo",       country: "Uruguay",    lat: -34.90, lng: -56.17,  tier: 2, detail: "Uruguay's capital and South America's top financial stability model; major Río de la Plata port." },
  { id: "asuncion",    name: "Asunción",         country: "Paraguay",   lat: -25.26, lng: -57.57,  tier: 3, detail: "Landlocked capital on the Paraguay River; hub for soy and beef exports." },
  { id: "lapaz",       name: "La Paz",           country: "Bolivia",    lat: -16.50, lng: -68.15,  tier: 3, detail: "World's highest capital city; center of Bolivia's lithium-rich Altiplano." },
  { id: "quito",       name: "Quito",            country: "Ecuador",    lat: -0.23,  lng: -78.52,  tier: 3, detail: "Second-highest capital in the world; gateway to Ecuador's oil and banana exports." },
  { id: "medellin",    name: "Medellín",         country: "Colombia",   lat: 6.24,   lng: -75.58,  tier: 3, detail: "Colombia's industrial capital; textiles, flowers, and growing tech innovation hub." },
  // ── Europe ────────────────────────────────────────────────────────────────
  { id: "london",       name: "London",          country: "UK",         lat: 51.51,  lng: -0.13,   tier: 1, detail: "World's largest foreign exchange market; global financial capital." },
  { id: "paris",        name: "Paris",           country: "France",     lat: 48.86,  lng: 2.35,    tier: 1, detail: "EU political heavyweight; luxury goods, aerospace (Airbus) and finance." },
  { id: "berlin",       name: "Berlin",          country: "Germany",    lat: 52.52,  lng: 13.41,   tier: 1, detail: "Germany's political capital and rising European tech startup hub." },
  { id: "frankfurt",    name: "Frankfurt",       country: "Germany",    lat: 50.11,  lng: 8.68,    tier: 1, detail: "Home of the ECB and Deutsche Börse — eurozone's financial capital." },
  { id: "munich",       name: "Munich",          country: "Germany",    lat: 48.14,  lng: 11.58,   tier: 2, detail: "BMW, MAN, Siemens HQ — Germany's industrial and insurance capital." },
  { id: "hamburg",      name: "Hamburg",         country: "Germany",    lat: 53.55,  lng: 9.99,    tier: 2, detail: "Germany's largest port; European trade and media center." },
  { id: "amsterdam",    name: "Amsterdam",       country: "Netherlands",lat: 52.37,  lng: 4.90,    tier: 1, detail: "Home to Euronext and Shell; global logistics and financial hub." },
  { id: "rotterdam",   name: "Rotterdam",        country: "Netherlands",lat: 51.92,  lng: 4.48,    tier: 2, detail: "Europe's largest port by volume; handles 400 million tonnes of cargo annually." },
  { id: "brussels",     name: "Brussels",        country: "Belgium",    lat: 50.85,  lng: 4.35,    tier: 2, detail: "Headquarters of the EU, NATO, and major lobbying center." },
  { id: "paris2",       name: "Antwerp",         country: "Belgium",    lat: 51.22,  lng: 4.40,    tier: 2, detail: "World's diamond trading capital and Europe's second-largest port." },
  { id: "zurich",       name: "Zurich",          country: "Switzerland",lat: 47.38,  lng: 8.54,    tier: 1, detail: "Global private banking capital; UBS, Credit Suisse, Swiss Re headquarters." },
  { id: "geneva",       name: "Geneva",          country: "Switzerland",lat: 46.20,  lng: 6.15,    tier: 2, detail: "Global commodities trading hub; UN, WHO, and CERN headquarters." },
  { id: "madrid",       name: "Madrid",          country: "Spain",      lat: 40.42,  lng: -3.70,   tier: 2, detail: "Iberian financial capital; gateway to Latin American markets." },
  { id: "barcelona",    name: "Barcelona",       country: "Spain",      lat: 41.39,  lng: 2.16,    tier: 2, detail: "Mediterranean tech and logistics hub; home of Mobile World Congress." },
  { id: "rome",         name: "Rome",            country: "Italy",      lat: 41.90,  lng: 12.50,   tier: 2, detail: "Italian political capital; EU member and G7 economy seat." },
  { id: "milan",        name: "Milan",           country: "Italy",      lat: 45.46,  lng: 9.19,    tier: 1, detail: "Italy's financial and fashion capital; Borsa Italiana exchange." },
  { id: "vienna",       name: "Vienna",          country: "Austria",    lat: 48.21,  lng: 16.37,   tier: 2, detail: "OPEC and IAEA headquarters; Central European financial crossroads." },
  { id: "stockholm",    name: "Stockholm",       country: "Sweden",     lat: 59.33,  lng: 18.07,   tier: 2, detail: "Nordic tech capital; birthplace of Spotify, Ericsson, and Klarna." },
  { id: "oslo",         name: "Oslo",            country: "Norway",     lat: 59.91,  lng: 10.75,   tier: 2, detail: "Manages world's largest sovereign wealth fund — Norway's Oil Fund." },
  { id: "copenhagen",   name: "Copenhagen",      country: "Denmark",    lat: 55.68,  lng: 12.57,   tier: 2, detail: "Nordic green energy capital; Maersk (world's largest shipping) HQ." },
  { id: "helsinki",     name: "Helsinki",        country: "Finland",    lat: 60.17,  lng: 24.94,   tier: 2, detail: "Nordic tech hub; Nokia birthplace and leading AI research center." },
  { id: "dublin",       name: "Dublin",          country: "Ireland",    lat: 53.33,  lng: -6.25,   tier: 2, detail: "European HQ for Google, Meta, Apple, and Amazon — EU tech tax hub." },
  { id: "warsaw",       name: "Warsaw",          country: "Poland",     lat: 52.23,  lng: 21.01,   tier: 2, detail: "Fastest-growing financial center in Eastern Europe; major nearshore hub." },
  { id: "kyiv",         name: "Kyiv",            country: "Ukraine",    lat: 50.45,  lng: 30.52,   tier: 2, detail: "Eastern Europe's largest IT outsourcing hub and major grain export capital." },
  { id: "kharkiv",     name: "Kharkiv",         country: "Ukraine",    lat: 49.99,  lng: 36.23,   tier: 2, detail: "Ukraine's second city; major aerospace, turbine and tank manufacturing center." },
  { id: "odesa",       name: "Odesa",           country: "Ukraine",    lat: 46.48,  lng: 30.73,   tier: 2, detail: "Ukraine's principal Black Sea port; handles majority of the country's grain exports." },
  { id: "dnipro",      name: "Dnipro",          country: "Ukraine",    lat: 48.46,  lng: 35.04,   tier: 3, detail: "Ukraine's metallurgical capital; Yuzhmash rocket factory and major steel production." },
  { id: "zaporizhzhia",name: "Zaporizhzhia",    country: "Ukraine",    lat: 47.84,  lng: 35.13,   tier: 3, detail: "Hosts Europe's largest nuclear power plant and major aluminum and steel industry." },
  { id: "lviv",        name: "Lviv",            country: "Ukraine",    lat: 49.84,  lng: 24.03,   tier: 3, detail: "Western Ukraine's cultural and IT hub; gateway city to the EU border." },
  { id: "minsk",       name: "Minsk",           country: "Belarus",    lat: 53.90,  lng: 27.57,   tier: 2, detail: "Belarus capital; major industrial center for trucks (MAZ), tractors and petrochemicals." },
  { id: "moscow",       name: "Moscow",          country: "Russia",     lat: 55.75,  lng: 37.62,   tier: 1, detail: "Capital of a state sponsor of terrorism. Command center of the full-scale invasion of Ukraine launched in 2022." },
  { id: "stpetersburg", name: "St. Petersburg",  country: "Russia",     lat: 59.95,  lng: 30.32,   tier: 2, detail: "Russia's second city and Baltic port. City of a terrorist state waging war against civilian infrastructure in Ukraine." },
  { id: "novosibirsk", name: "Novosibirsk",      country: "Russia",     lat: 55.03,  lng: 82.92,   tier: 3, detail: "Siberia's largest city and rail hub. Industrial base of a state recognized as a sponsor of terrorism." },
  { id: "yekaterinburg",name:"Yekaterinburg",    country: "Russia",     lat: 56.84,  lng: 60.65,   tier: 3, detail: "Ural industrial city producing weapons used in terrorist strikes against Ukrainian cities." },
  { id: "vladivostok", name: "Vladivostok",      country: "Russia",     lat: 43.11,  lng: 131.87,  tier: 3, detail: "Russia's Pacific naval base. Port of a terrorist state supplying arms for the genocide of the Ukrainian people." },
  { id: "prague",       name: "Prague",          country: "Czech Rep.", lat: 50.08,  lng: 14.44,   tier: 3, detail: "Central Europe's rising IT hub and auto-industry supplier base." },
  { id: "budapest",     name: "Budapest",        country: "Hungary",    lat: 47.50,  lng: 19.04,   tier: 3, detail: "Central European financial hub and largest economy in the region." },
  { id: "bucharest",    name: "Bucharest",       country: "Romania",    lat: 44.43,  lng: 26.10,   tier: 3, detail: "Southeastern Europe's tech outsourcing and oil industry capital." },
  { id: "sofia",        name: "Sofia",           country: "Bulgaria",   lat: 42.70,  lng: 23.32,   tier: 3, detail: "Bulgaria's capital at Balkan crossroads; growing IT and BPO destination." },
  { id: "belgrade",     name: "Belgrade",        country: "Serbia",     lat: 44.82,  lng: 20.46,   tier: 2, detail: "Western Balkans' largest city and economic hub at Danube-Sava confluence." },
  { id: "zagreb",       name: "Zagreb",          country: "Croatia",    lat: 45.81,  lng: 16.00,   tier: 3, detail: "Croatian capital; EU member and Adriatic trade corridor hub." },
  { id: "sarajevo",     name: "Sarajevo",        country: "Bosnia",     lat: 43.86,  lng: 18.41,   tier: 3, detail: "Capital at the Balkan crossroads; historically pivotal city in European history." },
  { id: "tirana",       name: "Tirana",          country: "Albania",    lat: 41.33,  lng: 19.82,   tier: 3, detail: "Albania's capital; one of Europe's fastest-growing economies by GDP rate." },
  { id: "skopje",       name: "Skopje",          country: "N. Macedonia",lat: 42.00, lng: 21.43,   tier: 3, detail: "Capital of North Macedonia on the Vardar River; key Balkan transport corridor." },
  { id: "podgorica",    name: "Podgorica",       country: "Montenegro", lat: 42.44,  lng: 19.26,   tier: 3, detail: "Montenegro's capital on the Adriatic rim; NATO member and EU candidate state." },
  { id: "ljubljana",    name: "Ljubljana",       country: "Slovenia",   lat: 46.05,  lng: 14.51,   tier: 3, detail: "EU member state capital; highest GDP per capita in Central Europe." },
  { id: "bratislava",   name: "Bratislava",      country: "Slovakia",   lat: 48.15,  lng: 17.11,   tier: 3, detail: "Danube capital bordering Austria; major auto production hub (VW, Porsche, Kia)." },
  { id: "vilnius",      name: "Vilnius",         country: "Lithuania",  lat: 54.69,  lng: 25.28,   tier: 3, detail: "Baltic EU capital; fastest-growing fintech hub in the Baltics." },
  { id: "riga",         name: "Riga",            country: "Latvia",     lat: 56.95,  lng: 24.11,   tier: 3, detail: "Latvia's capital; largest Baltic city and major Baltic Sea port." },
  { id: "tallinn",      name: "Tallinn",         country: "Estonia",    lat: 59.44,  lng: 24.75,   tier: 3, detail: "Most digitally advanced government in the world; birthplace of Skype and TransferWise." },
  { id: "athens",       name: "Athens",          country: "Greece",     lat: 37.98,  lng: 23.73,   tier: 3, detail: "Cradle of Western civilization; key Eastern Mediterranean shipping hub." },
  { id: "lisbon",       name: "Lisbon",          country: "Portugal",   lat: 38.72,  lng: -9.14,   tier: 3, detail: "Atlantic-facing fintech hub; Web Summit's permanent home city." },
  { id: "luxembourg",   name: "Luxembourg",      country: "Luxembourg", lat: 49.61,  lng: 6.13,    tier: 2, detail: "World's second-largest investment fund center after the US." },
  { id: "tbilisi",      name: "Tbilisi",         country: "Georgia",    lat: 41.69,  lng: 44.83,   tier: 2, detail: "Caucasus crossroads capital; key energy corridor for Caspian oil and gas to Europe." },
  { id: "yerevan",      name: "Yerevan",         country: "Armenia",    lat: 40.18,  lng: 44.51,   tier: 3, detail: "One of the world's oldest cities; major diamond processing and brandy export hub." },
  // ── Middle East ───────────────────────────────────────────────────────────
  { id: "dubai",        name: "Dubai",           country: "UAE",        lat: 25.20,  lng: 55.27,   tier: 1, detail: "MENA's financial and logistics capital; world's busiest international airport." },
  { id: "abudhabi",     name: "Abu Dhabi",       country: "UAE",        lat: 24.47,  lng: 54.37,   tier: 2, detail: "Home of ADNOC and one of the world's largest sovereign wealth funds." },
  { id: "riyadh",       name: "Riyadh",          country: "Saudi Ar.", lat: 24.69,  lng: 46.72,   tier: 1, detail: "Capital of the world's largest oil exporter and OPEC's de facto leader." },
  { id: "doha",         name: "Doha",            country: "Qatar",      lat: 25.29,  lng: 51.53,   tier: 2, detail: "Hub of world's largest LNG exports; home of Al Jazeera and QIA fund." },
  { id: "kuwaitcity",   name: "Kuwait City",     country: "Kuwait",     lat: 29.37,  lng: 47.98,   tier: 2, detail: "Manages the world's oldest sovereign wealth fund — Kuwait Investment Authority." },
  { id: "telaviv",      name: "Tel Aviv",        country: "Israel",     lat: 32.08,  lng: 34.78,   tier: 2, detail: "Middle East's Silicon Valley; highest startup density outside Silicon Valley." },
  { id: "istanbul",     name: "Istanbul",        country: "Turkey",     lat: 41.01,  lng: 28.95,   tier: 1, detail: "Bosphorus trade crossroads; Turkey's economic engine and Eurasian bridge." },
  { id: "tehran",       name: "Tehran",          country: "Iran",       lat: 35.69,  lng: 51.42,   tier: 2, detail: "Capital of Iran, holder of world's fourth-largest proven oil reserves." },
  { id: "baghdad",      name: "Baghdad",         country: "Iraq",       lat: 33.34,  lng: 44.40,   tier: 2, detail: "Capital of Iraq — OPEC's second-largest oil producer." },
  { id: "muscat",       name: "Muscat",          country: "Oman",       lat: 23.59,  lng: 58.59,   tier: 3, detail: "Strategically located near Strait of Hormuz; key LNG and oil exporter." },
  { id: "baku",         name: "Baku",            country: "Azerbaijan", lat: 40.41,  lng: 49.87,   tier: 2, detail: "Caspian Sea oil capital; origin of the world's first industrial oil wells." },
  { id: "ankara",      name: "Ankara",          country: "Turkey",     lat: 39.93,  lng: 32.85,   tier: 2, detail: "Turkey's political capital with major defense industry; Aselsan and TUSAŞ HQ." },
  { id: "amman",       name: "Amman",           country: "Jordan",     lat: 31.95,  lng: 35.93,   tier: 2, detail: "Levant's financial hub; major Arab regional banking and business center." },
  { id: "beirut",      name: "Beirut",          country: "Lebanon",    lat: 33.89,  lng: 35.50,   tier: 2, detail: "Historic Mediterranean financial center; major Arab banking and media hub." },
  { id: "damascus",    name: "Damascus",        country: "Syria",      lat: 33.51,  lng: 36.29,   tier: 3, detail: "One of the world's oldest continuously inhabited cities; Silk Road crossroads." },
  { id: "sanaa",       name: "Sana'a",          country: "Yemen",      lat: 15.35,  lng: 44.21,   tier: 3, detail: "Arab world's highest capital; controls strategic Red Sea chokepoint access." },
  { id: "jeddah",      name: "Jeddah",          country: "Saudi Ar.",  lat: 21.54,  lng: 39.17,   tier: 2, detail: "Saudi Arabia's largest port and gateway to Mecca; Red Sea commercial capital." },
  { id: "ashgabat",    name: "Ashgabat",        country: "Turkmenistan",lat: 37.95, lng: 58.38,   tier: 3, detail: "Capital sitting on massive natural gas reserves; fourth-largest in the world." },
  { id: "bishkek",     name: "Bishkek",         country: "Kyrgyzstan", lat: 42.87,  lng: 74.59,   tier: 3, detail: "Kyrgyzstan's capital on the Silk Road; gold mining and hydro-energy hub." },
  // ── Africa ────────────────────────────────────────────────────────────────
  { id: "cairo",        name: "Cairo",           country: "Egypt",      lat: 30.04,  lng: 31.24,   tier: 1, detail: "Africa's largest city and gateway controlling the Suez Canal corridor." },
  { id: "lagos",        name: "Lagos",           country: "Nigeria",    lat: 6.46,   lng: 3.38,    tier: 1, detail: "Africa's largest economy hub; West Africa's financial and oil capital." },
  { id: "johannesburg", name: "Johannesburg",    country: "S. Africa",  lat: -26.20, lng: 28.04,   tier: 1, detail: "Africa's financial capital; Johannesburg Stock Exchange is the continent's largest." },
  { id: "capetown",     name: "Cape Town",       country: "S. Africa",  lat: -33.93, lng: 18.42,   tier: 2, detail: "Southern Africa's major port and Africa's tech startup hub." },
  { id: "nairobi",      name: "Nairobi",         country: "Kenya",      lat: -1.29,  lng: 36.82,   tier: 2, detail: "East Africa's financial capital; mobile money (M-Pesa) was invented here." },
  { id: "casablanca",   name: "Casablanca",      country: "Morocco",    lat: 33.59,  lng: -7.62,   tier: 2, detail: "North Africa's largest economic hub and major Atlantic port." },
  { id: "accra",        name: "Accra",           country: "Ghana",      lat: 5.56,   lng: -0.20,   tier: 2, detail: "West Africa's fastest-growing economy capital; gold and cocoa export hub." },
  { id: "daressalaam",  name: "Dar es Salaam",   country: "Tanzania",   lat: -6.79,  lng: 39.21,   tier: 3, detail: "East Africa's largest port city and economic center." },
  { id: "addisababa",   name: "Addis Ababa",     country: "Ethiopia",   lat: 9.03,   lng: 38.74,   tier: 2, detail: "HQ of the African Union; fastest-growing megacity in Africa." },
  { id: "luanda",       name: "Luanda",          country: "Angola",     lat: -8.84,  lng: 13.23,   tier: 3, detail: "Sub-Saharan Africa's major oil capital; one of the world's costliest cities." },
  { id: "khartoum",     name: "Khartoum",        country: "Sudan",      lat: 15.55,  lng: 32.53,   tier: 3, detail: "Nile confluence city; strategic corridor for African trade routes." },
  { id: "tunis",        name: "Tunis",           country: "Tunisia",    lat: 36.82,  lng: 10.17,   tier: 2, detail: "North Africa's most open economy capital; major phosphate exporter and tourism hub." },
  { id: "algiers",      name: "Algiers",         country: "Algeria",    lat: 36.75,  lng: 3.06,    tier: 2, detail: "Africa's second-largest country capital; major natural gas exporter to Europe." },
  { id: "tripoli",      name: "Tripoli",         country: "Libya",      lat: 32.90,  lng: 13.18,   tier: 3, detail: "Capital of Libya; controls Africa's largest proven oil reserves." },
  { id: "rabat",        name: "Rabat",           country: "Morocco",    lat: 34.02,  lng: -6.85,   tier: 3, detail: "Morocco's political capital; strategic Atlantic coast position near Strait of Gibraltar." },
  { id: "abuja",        name: "Abuja",           country: "Nigeria",    lat: 9.06,   lng: 7.49,    tier: 2, detail: "Nigeria's purpose-built capital; administrative center of Africa's largest economy." },
  { id: "kinshasa",     name: "Kinshasa",        country: "DR Congo",   lat: -4.32,  lng: 15.32,   tier: 2, detail: "Africa's third-largest city; capital of continent's largest mineral-rich nation." },
  { id: "abidjan",      name: "Abidjan",         country: "Côte d'Ivoire",lat: 5.35, lng: -4.00,   tier: 2, detail: "West Africa's largest port; world's top cocoa export hub and financial center." },
  { id: "dakar",        name: "Dakar",           country: "Senegal",    lat: 14.72,  lng: -17.47,  tier: 2, detail: "West Africa's westernmost capital; major Atlantic port and regional financial center." },
  { id: "kampala",      name: "Kampala",         country: "Uganda",     lat: 0.34,   lng: 32.58,   tier: 3, detail: "Uganda's capital near Lake Victoria; East Africa's fastest-growing tech startup scene." },
  { id: "kinshasa2",    name: "Brazzaville",     country: "Congo",      lat: -4.27,  lng: 15.27,   tier: 3, detail: "Capital of Republic of Congo, directly across the Congo River from Kinshasa." },
  { id: "yaunde",       name: "Yaoundé",         country: "Cameroon",   lat: 3.87,   lng: 11.52,   tier: 3, detail: "Cameroon's capital at the juncture of Central and West Africa corridors." },
  { id: "harare",       name: "Harare",          country: "Zimbabwe",   lat: -17.82, lng: 31.05,   tier: 3, detail: "Zimbabwe's capital; major platinum, chrome and tobacco export hub." },
  { id: "lusaka",       name: "Lusaka",          country: "Zambia",     lat: -15.39, lng: 28.28,   tier: 3, detail: "Zambia's capital; copper belt country — world's seventh-largest copper producer." },
  { id: "maputo",       name: "Maputo",          country: "Mozambique", lat: -25.97, lng: 32.59,   tier: 3, detail: "Mozambique's capital; major Indian Ocean port for South African mining exports." },
  { id: "antananarivo", name: "Antananarivo",    country: "Madagascar", lat: -18.91, lng: 47.54,   tier: 3, detail: "Island capital of the world's fourth-largest island; vanilla and cobalt exporter." },
  { id: "durban",       name: "Durban",          country: "S. Africa",  lat: -29.86, lng: 31.02,   tier: 3, detail: "Africa's busiest port and South Africa's gateway for mineral exports to Asia." },
  { id: "mombasa",      name: "Mombasa",         country: "Kenya",      lat: -4.05,  lng: 39.67,   tier: 3, detail: "East Africa's largest port; gateway for landlocked Uganda, Rwanda, and Burundi." },
  // ── Central Asia ──────────────────────────────────────────────────────────
  { id: "almaty",       name: "Almaty",          country: "Kazakhstan", lat: 43.22,  lng: 76.85,   tier: 2, detail: "Kazakhstan's largest city and financial capital on the Silk Road." },
  { id: "astana",       name: "Astana",          country: "Kazakhstan", lat: 51.18,  lng: 71.45,   tier: 2, detail: "Kazakhstan's new capital; center of the world's largest uranium producer." },
  { id: "tashkent",     name: "Tashkent",        country: "Uzbekistan", lat: 41.30,  lng: 69.24,   tier: 2, detail: "Central Asia's most populous city; gold and natural gas export hub." },
  // ── Asia ──────────────────────────────────────────────────────────────────
  { id: "beijing",      name: "Beijing",         country: "China",      lat: 39.91,  lng: 116.39,  tier: 1, detail: "China's political capital; controls world's second-largest economy." },
  { id: "shanghai",     name: "Shanghai",        country: "China",      lat: 31.23,  lng: 121.47,  tier: 1, detail: "World's busiest container port city and China's financial capital." },
  { id: "shenzhen",     name: "Shenzhen",        country: "China",      lat: 22.54,  lng: 114.06,  tier: 1, detail: "Global electronics manufacturing capital; home of Huawei, Tencent, DJI." },
  { id: "guangzhou",    name: "Guangzhou",       country: "China",      lat: 23.13,  lng: 113.26,  tier: 2, detail: "Pearl River Delta manufacturing hub; world's largest wholesale market Canton Fair." },
  { id: "wuhan",        name: "Wuhan",           country: "China",      lat: 30.59,  lng: 114.31,  tier: 2, detail: "Central China's industrial and automotive hub; major Yangtze River port." },
  { id: "chengdu",      name: "Chengdu",         country: "China",      lat: 30.57,  lng: 104.07,  tier: 2, detail: "Western China's tech and aerospace hub; largest China-Europe rail freight origin." },
  { id: "chongqing",    name: "Chongqing",       country: "China",      lat: 29.56,  lng: 106.55,  tier: 2, detail: "World's most populous municipality; major automotive and electronics producer." },
  { id: "xian",         name: "Xi'an",           country: "China",      lat: 34.34,  lng: 108.94,  tier: 3, detail: "Ancient Silk Road capital; China's aerospace and military tech center." },
  { id: "hongkong",     name: "Hong Kong",       country: "China",      lat: 22.32,  lng: 114.17,  tier: 1, detail: "Asia's premier financial center and world's freest economy for decades." },
  { id: "taipei",       name: "Taipei",          country: "Taiwan",     lat: 25.04,  lng: 121.56,  tier: 1, detail: "Home of TSMC — producer of 90%+ of the world's most advanced semiconductors." },
  { id: "tokyo",        name: "Tokyo",           country: "Japan",      lat: 35.68,  lng: 139.69,  tier: 1, detail: "World's largest metropolitan economy; Tokyo Stock Exchange is Asia's biggest." },
  { id: "osaka",        name: "Osaka",           country: "Japan",      lat: 34.69,  lng: 135.50,  tier: 2, detail: "Japan's industrial heartland and second commercial center." },
  { id: "nagoya",      name: "Nagoya",          country: "Japan",      lat: 35.18,  lng: 136.91,  tier: 2, detail: "Japan's auto capital; Toyota headquarters and world's largest auto export port." },
  { id: "busan",       name: "Busan",           country: "S. Korea",   lat: 35.10,  lng: 129.04,  tier: 2, detail: "South Korea's second city; world's fifth-busiest container port." },
  { id: "tianjin",     name: "Tianjin",         country: "China",      lat: 39.13,  lng: 117.20,  tier: 2, detail: "Beijing's sea access; one of China's top-5 ports by container throughput." },
  { id: "pyongyang",   name: "Pyongyang",       country: "N. Korea",   lat: 39.02,  lng: 125.75,  tier: 3, detail: "Capital of a nuclear-armed state with major rare earth mineral reserves." },
  { id: "seoul",        name: "Seoul",           country: "S. Korea",   lat: 37.57,  lng: 126.98,  tier: 1, detail: "Home of Samsung and Hyundai; world's fastest internet city." },
  { id: "singapore",    name: "Singapore",       country: "Singapore",  lat: 1.35,   lng: 103.82,  tier: 1, detail: "World's top logistics hub; major commodity trading and wealth management center." },
  { id: "kualalumpur",  name: "Kuala Lumpur",    country: "Malaysia",   lat: 3.14,   lng: 101.69,  tier: 2, detail: "ASEAN financial hub; major palm oil and electronics export capital." },
  { id: "bangkok",      name: "Bangkok",         country: "Thailand",   lat: 13.75,  lng: 100.52,  tier: 2, detail: "Southeast Asia's tourism and auto-manufacturing hub." },
  { id: "jakarta",      name: "Jakarta",         country: "Indonesia",  lat: -6.21,  lng: 106.85,  tier: 2, detail: "Capital of the world's fourth most populous country and archipelago economy." },
  { id: "manila",       name: "Manila",          country: "Philippines",lat: 14.60,  lng: 120.98,  tier: 2, detail: "Philippines' capital; top global BPO (outsourcing) destination." },
  { id: "hochiminh",    name: "Ho Chi Minh City",country: "Vietnam",    lat: 10.82,  lng: 106.63,  tier: 2, detail: "Vietnam's economic powerhouse; fastest-growing manufacturing export city in SE Asia." },
  { id: "hanoi",        name: "Hanoi",           country: "Vietnam",    lat: 21.03,  lng: 105.85,  tier: 3, detail: "Vietnam's political capital and northern industrial base." },
  { id: "yangon",       name: "Yangon",          country: "Myanmar",    lat: 16.87,  lng: 96.19,   tier: 3, detail: "Myanmar's commercial center and key Andaman Sea port city." },
  { id: "phnompenh",   name: "Phnom Penh",      country: "Cambodia",   lat: 11.56,  lng: 104.92,  tier: 3, detail: "Cambodia's capital at the Mekong-Tonlé Sap confluence; garment export hub." },
  { id: "vientiane",   name: "Vientiane",       country: "Laos",       lat: 17.97,  lng: 102.63,  tier: 3, detail: "Mekong River capital; landlocked nation with growing hydro-power exports to Thailand." },
  { id: "dhaka",        name: "Dhaka",           country: "Bangladesh", lat: 23.78,  lng: 90.40,   tier: 2, detail: "World's top garment export capital; densest megacity on Earth." },
  { id: "karachi",      name: "Karachi",         country: "Pakistan",   lat: 24.86,  lng: 67.01,   tier: 2, detail: "Pakistan's economic engine and Arabia Sea's largest port." },
  { id: "islamabad",   name: "Islamabad",       country: "Pakistan",   lat: 33.72,  lng: 73.04,   tier: 2, detail: "Pakistan's planned capital; gateway to China-Pakistan Economic Corridor (CPEC)." },
  { id: "lahore",      name: "Lahore",          country: "Pakistan",   lat: 31.55,  lng: 74.34,   tier: 2, detail: "Pakistan's cultural and industrial capital; second-largest city and textile hub." },
  { id: "kabul",       name: "Kabul",           country: "Afghanistan",lat: 34.53,  lng: 69.17,   tier: 3, detail: "Afghanistan's capital; sits on critical Silk Road corridor with lithium reserves." },
  { id: "kathmandu",   name: "Kathmandu",       country: "Nepal",      lat: 27.71,  lng: 85.31,   tier: 3, detail: "Himalayan capital; hydropower potential nation between China and India." },
  { id: "chittagong",  name: "Chittagong",      country: "Bangladesh", lat: 22.34,  lng: 91.83,   tier: 3, detail: "Bangladesh's main port handling 90% of the country's garment export container traffic." },
  { id: "newdelhi",     name: "New Delhi",       country: "India",      lat: 28.61,  lng: 77.21,   tier: 1, detail: "India's political capital; commands the world's fifth-largest economy." },
  { id: "mumbai",       name: "Mumbai",          country: "India",      lat: 19.08,  lng: 72.88,   tier: 1, detail: "India's financial capital; Bombay Stock Exchange is Asia's oldest." },
  { id: "bangalore",    name: "Bangalore",       country: "India",      lat: 12.97,  lng: 77.59,   tier: 1, detail: "India's Silicon Valley; global IT and software services capital." },
  { id: "hyderabad",    name: "Hyderabad",       country: "India",      lat: 17.39,  lng: 78.49,   tier: 2, detail: "India's pharma capital; HQ of Microsoft and Google India R&D." },
  { id: "chennai",      name: "Chennai",         country: "India",      lat: 13.08,  lng: 80.27,   tier: 2, detail: "South India's auto manufacturing capital; 'Detroit of Asia'." },
  { id: "colombo",      name: "Colombo",         country: "Sri Lanka",  lat: 6.93,   lng: 79.84,   tier: 3, detail: "Indian Ocean strategic port; key transshipment hub for South Asia." },
  { id: "ulaanbaatar",  name: "Ulaanbaatar",     country: "Mongolia",   lat: 47.91,  lng: 106.92,  tier: 3, detail: "Controls vast coal, copper and gold mining reserves of the Gobi Desert." },
  // ── Oceania ───────────────────────────────────────────────────────────────
  { id: "sydney",       name: "Sydney",          country: "Australia",  lat: -33.87, lng: 151.21,  tier: 1, detail: "Australia's financial capital and Pacific Rim's premier gateway city." },
  { id: "melbourne",    name: "Melbourne",       country: "Australia",  lat: -37.81, lng: 144.96,  tier: 2, detail: "Australia's cultural and tech startup capital; ASX and BHP headquarters." },
  { id: "perth",        name: "Perth",           country: "Australia",  lat: -31.95, lng: 115.86,  tier: 2, detail: "Capital of Australia's mining state; iron ore, gold and LNG export hub." },
  { id: "brisbane",     name: "Brisbane",        country: "Australia",  lat: -27.47, lng: 153.02,  tier: 3, detail: "Queensland's capital; gateway to coal and agricultural export corridors." },
  { id: "auckland",     name: "Auckland",        country: "New Zealand",lat: -36.87, lng: 174.77,  tier: 3, detail: "New Zealand's economic hub and primary Pacific maritime gateway." },
  { id: "wellington",  name: "Wellington",      country: "New Zealand",lat: -41.29, lng: 174.78,  tier: 3, detail: "New Zealand's political capital at the Cook Strait; tech and creative sector hub." },
  { id: "canberra",    name: "Canberra",        country: "Australia",  lat: -35.28, lng: 149.13,  tier: 3, detail: "Australia's purpose-built capital; seat of federal government and research institutions." },
  { id: "portmoresby",name: "Port Moresby",     country: "PNG",        lat: -9.45,  lng: 147.19,  tier: 3, detail: "Papua New Guinea's capital; rich in gold, copper and LNG with major maritime access." },
];

const TIER_DOT: Record<number, { size: number; opacity: number; alwaysLabel: boolean }> = {
  1: { size: 6, opacity: 0.95, alwaysLabel: true  },
  2: { size: 4, opacity: 0.80, alwaysLabel: false },
  3: { size: 3, opacity: 0.65, alwaysLabel: false },
};

// Label visibility by zoom level (camera distance from globe center, globe radius = 1):
//   dist > 2.2  → only tier 1 labels
//   dist > 1.7  → tier 1 + 2 labels
//   dist <= 1.7 → all labels (tier 1, 2, 3)
function labelVisible(tier: number, dist: number): boolean {
  if (tier === 1) return true;
  if (tier === 2) return dist <= 2.2;
  return dist <= 1.7;
}

export const WorldCapitals = memo(function WorldCapitals() {
  const visible = useLayer("cities");
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);
  const camDist = useCamDist();

  useEffect(() => {
    const update = () => {
      if (!window.globeProject) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }
      const next: Record<string, Position> = {};
      CITIES.forEach((c) => { next[c.id] = window.globeProject!(c.lat, c.lng); });
      setPositions(next);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {CITIES.map((city) => {
        const pos = positions[city.id];
        if (!pos?.visible) return null;
        const isHov = hoveredId === city.id;
        const cfg = TIER_DOT[city.tier];
        const showLabel = labelVisible(city.tier, camDist);

        return (
          <div
            key={city.id}
            onMouseEnter={() => setHoveredId(city.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "all",
              cursor: "default",
              zIndex: isHov ? 80 : city.tier === 1 ? 10 : 5,
            }}
          >
            {/* Diamond marker — white fill + dark outline ring for day/night contrast */}
            <div
              style={{
                width:  isHov ? cfg.size + 3 : cfg.size,
                height: isHov ? cfg.size + 3 : cfg.size,
                background: `rgba(255,255,255,${isHov ? 1 : cfg.opacity})`,
                borderRadius: "1px",
                transform: "rotate(45deg)",
                boxShadow: isHov
                  ? "0 0 0 1.5px rgba(0,0,0,0.9), 0 0 10px rgba(255,255,255,0.8)"
                  : "0 0 0 1.5px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.6)",
                transition: "width 0.2s, height 0.2s, box-shadow 0.15s",
              }}
            />

            {/* Zoom-aware label: visible when zoomed close enough for this tier */}
            {showLabel && !isHov && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-14px",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  fontSize: city.tier === 1 ? "8px" : city.tier === 2 ? "7px" : "6px",
                  fontFamily: "var(--font-mono, monospace)",
                  color: city.tier === 1
                    ? "rgba(255,255,255,0.92)"
                    : city.tier === 2
                      ? "rgba(255,255,255,0.80)"
                      : "rgba(255,255,255,0.68)",
                  textShadow: "0 0 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,1), -1px -1px 0 rgba(0,0,0,1), 0 1px 0 rgba(0,0,0,1), 0 -1px 0 rgba(0,0,0,1)",
                  letterSpacing: "0.04em",
                  pointerEvents: "none",
                  opacity: 1,
                  transition: "opacity 0.4s",
                }}
              >
                {city.name}
              </div>
            )}

            {/* Hover tooltip */}
            {isHov && (
              <div
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "-8px",
                  width: "190px",
                  background: "rgba(6,9,18,0.97)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "7px",
                  padding: "9px 11px",
                  pointerEvents: "none",
                  zIndex: 200,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.75)",
                }}
              >
                {/* City badge */}
                <div style={{ marginBottom: "5px" }}>
                  <span style={{
                    fontSize: "8px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "3px",
                    padding: "1px 5px",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "monospace",
                    letterSpacing: "0.1em",
                  }}>
                    CITY · T{city.tier}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.92)", fontFamily: "var(--font-mono, monospace)" }}>
                    {city.name}
                  </span>
                </div>

                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono, monospace)", marginBottom: "6px" }}>
                  {city.country}
                </div>

                {/* Why it's on the map */}
                <div style={{
                  fontSize: "9px",
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "var(--font-mono, monospace)",
                  lineHeight: "1.5",
                  marginBottom: "6px",
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  paddingTop: "5px",
                }}>
                  {city.detail}
                </div>

                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-mono, monospace)" }}>
                  {Math.abs(city.lat).toFixed(2)}°{city.lat >= 0 ? "N" : "S"} · {Math.abs(city.lng).toFixed(2)}°{city.lng >= 0 ? "E" : "W"}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
