/**
 * Configuration, fallback data, and high-density analysis grid.
 */

// Gainesville / Alachua County bounding box: [south, west, north, east].
const COUNTY_BBOX = { south: 29.45, west: -82.65, north: 29.90, east: -82.05 };
const COUNTY_CENTER = [29.66, -82.35];

// Map bounds constraint: locked focus on Alachua County
const MAP_BOUNDS = L.latLngBounds(
  L.latLng(29.35, -82.75),
  L.latLng(30.00, -81.95)
);

// GLOBE Observer Florida feature layer (UF GeoPlan / GeoDI).
const GLOBE_QUERY_URL = "https://callisto.at.geoplan.ufl.edu/arcgis/rest/services/fgdl/GLOBE_MHM/MapServer/0/query";

// Open-Meteo weather API.
const WEATHER_BASE_URL = "https://api.open-meteo.com/v1/forecast";

// OpenStreetMap Overpass API for ponds/lakes.
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// High-density grid (75x75 = 5,625 nodes) for smooth surface coverage without tile clipping
const GRID_SIZE = 75;

// Mosquito emergence lag weights
const RAIN_DAY_WEIGHTS = [1.4, 1.3, 1.1, 0.8, 0.5, 0.3, 0.2];

// Subscore weights
const RISK_WEIGHTS = { rain: 1.2, temp: 0.8, water: 1.0, report: 1.6 };

// Distance thresholds in kilometers
const WATER_INFLUENCE_KM = 3.0;
const REPORT_INFLUENCE_KM = 2.5;

/* ---------------- Fallback Data ---------------- */

const FALLBACK_SITES = [
  { name: "Duckpond area",      lat: 29.6580, lng: -82.3197, date: "2026-09-12", larvaeCount: 1, waterSource: "Container", eliminated: false },
  { name: "Springhill area",    lat: 29.6115, lng: -82.3660, date: "2026-09-15", larvaeCount: 1, waterSource: "Drainage", eliminated: false },
  { name: "Kanapaha area",      lat: 29.6135, lng: -82.4030, date: "2026-09-10", larvaeCount: 0, waterSource: "Tire",     eliminated: true  },
];

const FALLBACK_WATER_BODIES = [
  { name: "Lake Alice",              lat: 29.6395, lng: -82.3660, weight: 0.6 },
  { name: "Bivens Arm Lake",         lat: 29.6215, lng: -82.3400, weight: 0.7 },
  { name: "Lake Kanapaha",           lat: 29.6089, lng: -82.4234, weight: 0.6 },
  { name: "Newnans Lake",            lat: 29.6470, lng: -82.2350, weight: 0.5 },
  { name: "Lake Wauburg",            lat: 29.5810, lng: -82.3540, weight: 0.5 },
  { name: "Sweetwater Wetlands Park",lat: 29.6117, lng: -82.3010, weight: 1.2 },
  { name: "Loblolly Woods Pond",     lat: 29.6800, lng: -82.3450, weight: 1.0 },
  { name: "Possum Creek Park Pond",  lat: 29.6890, lng: -82.3800, weight: 1.0 },
];

const FALLBACK_RAIN7 = [0.05, 0.1, 0.4, 0.6, 0.2, 0.5, 0.3];
const FALLBACK_TEMP7 = [78, 80, 82, 81, 79, 83, 84];

const RAIN_DAY_LABELS_7 = ['7d ago', '6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Today'];

/* ---------------- Grid Generation & Distance Functions ---------------- */

function buildGrid() {
  const points = [];
  const latStep = (COUNTY_BBOX.north - COUNTY_BBOX.south) / (GRID_SIZE - 1);
  const lngStep = (COUNTY_BBOX.east - COUNTY_BBOX.west) / (GRID_SIZE - 1);
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      points.push({
        lat: COUNTY_BBOX.south + i * latStep,
        lng: COUNTY_BBOX.west + j * lngStep,
      });
    }
  }
  return points;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}