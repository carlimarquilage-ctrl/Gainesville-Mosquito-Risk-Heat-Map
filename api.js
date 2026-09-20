/**
 * Live data fetching API handlers.
 */

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { promise: promise(controller.signal), clear: () => clearTimeout(timer) };
}

/* ---------------- GLOBE Observer Reports ---------------- */

async function fetchGlobeSites() {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    geometry: `${COUNTY_BBOX.west},${COUNTY_BBOX.south},${COUNTY_BBOX.east},${COUNTY_BBOX.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outSR: "4326",
    f: "geojson",
  });

  try {
    const { promise, clear } = withTimeout(
      (signal) => fetch(`${GLOBE_QUERY_URL}?${params.toString()}`, { signal }),
      9000
    );
    const res = await promise;
    clear();
    if (!res.ok) throw new Error("GLOBE query failed: " + res.status);
    const geojson = await res.json();

    const sites = (geojson.features || []).map((f, i) => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry.coordinates;
      return {
        name: p.SITENAME || p.WATERSOURCETYPE || `Report ${i + 1}`,
        lat, lng,
        date: p.MEASUREDAT || null,
        larvaeCount: parseInt(p.LARVAECOUNT, 10) || 0,
        waterSource: p.WATERSOURCETYPE || "Unknown",
        eliminated: (p.BREEDINGGROUNDELIMINATED || "").toLowerCase() === "true",
      };
    }).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));

    return { data: sites, live: true };
  } catch (err) {
    console.warn("GLOBE Observer fetch failed, using fallback sites:", err);
    return { data: FALLBACK_SITES, live: false };
  }
}

/* ---------------- Weather (Rainfall & Temp via Open-Meteo) ---------------- */

async function fetchWeatherGrid(points) {
  const lat = points.map(p => p.lat.toFixed(4)).join(",");
  const lng = points.map(p => p.lng.toFixed(4)).join(",");
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: "precipitation_sum,temperature_2m_mean",
    past_days: "7",
    forecast_days: "1",
    precipitation_unit: "inch",
    temperature_unit: "fahrenheit",
    timezone: "America/New_York",
  });

  try {
    const { promise, clear } = withTimeout(
      (signal) => fetch(`${WEATHER_BASE_URL}?${params.toString()}`, { signal }),
      9000
    );
    const res = await promise;
    clear();
    if (!res.ok) throw new Error("Weather query failed: " + res.status);
    const json = await res.json();

    const results = Array.isArray(json) ? json : [json];
    const rainPerPoint = [];
    const tempPerPoint = [];

    results.forEach(r => {
      const rainVals = (r.daily && r.daily.precipitation_sum) || [];
      const tempVals = (r.daily && r.daily.temperature_2m_mean) || [];
      rainPerPoint.push(rainVals.slice(0, 7));
      tempPerPoint.push(tempVals.slice(0, 7));
    });

    return { 
      data: { rain: rainPerPoint, temp: tempPerPoint }, 
      live: true, 
      asOf: new Date().toISOString() 
    };
  } catch (err) {
    console.warn("Open-Meteo fetch failed, using fallback weather:", err);
    return { 
      data: { 
        rain: points.map(() => FALLBACK_RAIN7), 
        temp: points.map(() => FALLBACK_TEMP7) 
      }, 
      live: false, 
      asOf: null 
    };
  }
}

/* ---------------- Ponds, Lakes & Basins (Overpass API) ---------------- */

async function fetchWaterBodies() {
  const bbox = `${COUNTY_BBOX.south},${COUNTY_BBOX.west},${COUNTY_BBOX.north},${COUNTY_BBOX.east}`;
  const query = `
    [out:json][timeout:20];
    (
      way["natural"="water"](${bbox});
      relation["natural"="water"](${bbox});
      way["water"="pond"](${bbox});
      way["landuse"="reservoir"](${bbox});
      way["landuse"="basin"](${bbox});
      way["natural"="wetland"](${bbox});
    );
    out center tags 60;
  `;

  try {
    const { promise, clear } = withTimeout(
      (signal) => fetch(OVERPASS_URL, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal,
      }),
      12000
    );
    const res = await promise;
    clear();
    if (!res.ok) throw new Error("Overpass query failed: " + res.status);
    const json = await res.json();

    const bodies = (json.elements || [])
      .map(el => {
        const center = el.center || { lat: el.lat, lon: el.lon };
        if (!center || !Number.isFinite(center.lat)) return null;
        
        const tags = el.tags || {};
        let weight = 0.8; 
        if (tags.water === 'pond' || tags.landuse === 'basin' || tags.natural === 'wetland') {
          weight = 1.3;
        } else if (tags.natural === 'water' && !tags.water) {
          weight = 0.6;
        }

        return {
          name: tags.name || "Unnamed pond/basin",
          lat: center.lat,
          lng: center.lon,
          weight: weight
        };
      })
      .filter(Boolean);

    if (bodies.length === 0) throw new Error("Overpass returned no water bodies");
    return { data: bodies, live: true };
  } catch (err) {
    console.warn("Overpass fetch failed, using fallback water bodies:", err);
    return { data: FALLBACK_WATER_BODIES, live: false };
  }
}