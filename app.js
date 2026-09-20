(async function init() {

  /* ---------------- Step 1: Base Map Setup ---------------- */
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    minZoom: 10,
    maxZoom: 16,
    maxBounds: MAP_BOUNDS,
    maxBoundsViscosity: 0.9
  }).setView(COUNTY_CENTER, 11);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
  }).addTo(map);

  const grid = buildGrid();

  /* ---------------- Step 2: Parallel Live Data Retrieval ---------------- */
  const [globeRes, weatherRes, waterRes] = await Promise.all([
    fetchGlobeSites(),
    fetchWeatherGrid(grid),
    fetchWaterBodies()
  ]);

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';

  /* ---------------- Step 3: Status Badges ---------------- */
  updateStatusBadge('status-globe', 'GLOBE Observer', globeRes.live);
  updateStatusBadge('status-rain', 'Open-Meteo Weather', weatherRes.live);
  updateStatusBadge('status-water', 'OSM Water Bodies', waterRes.live);

  function updateStatusBadge(elementId, label, isLive) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const badgeClass = isLive ? 'src-live' : 'src-fallback';
    const badgeText = isLive ? 'LIVE' : 'FALLBACK';
    el.innerHTML = `<span class="src-badge ${badgeClass}">${badgeText}</span> ${label}`;
  }

  /* ---------------- Step 4: Calculate Base Risk Scores ---------------- */
  const gridRisk = computeGridRisk(grid, weatherRes.data, waterRes.data, globeRes.data);
  const dailyAvgRain = citywideDailyAverage(weatherRes.data.rain);
  const rain7dTotal = dailyAvgRain.reduce((a, b) => a + b, 0);

  /* ---------------- Step 5: Smooth Non-Clipping Heatmap Surface ---------------- */
  let heatLayer = null;

  // Moderate radius range prevents tile-edge clipping while high grid density maintains continuous flow
  function getRadiusForZoom(zoom) {
    if (zoom <= 11) return 22;
    if (zoom === 12) return 28;
    if (zoom === 13) return 34;
    if (zoom === 14) return 40;
    return 45; // Zoom 15+
  }

  function getBlurForZoom(zoom) {
    if (zoom <= 11) return 15;
    if (zoom === 12) return 20;
    if (zoom === 13) return 25;
    if (zoom === 14) return 30;
    return 32; // Zoom 15+
  }

  function renderBlendedHeatmap() {
    const currentZoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Evaluate visible area points
    const visiblePoints = gridRisk.filter(pt => bounds.contains([pt.lat, pt.lng]));
    const targetPoints = visiblePoints.length > 5 ? visiblePoints : gridRisk;

    const rawScores = targetPoints.map(p => p.rawScore);
    const minRaw = Math.min(...rawScores);
    const maxRaw = Math.max(...rawScores);
    const range = Math.max(maxRaw - minRaw, 0.0001);

    // Apply elevation power curve transformation
    const blendedHeatPoints = gridRisk.map(pt => {
      const norm = Math.max(0, Math.min(1, (pt.rawScore - minRaw) / range));
      const curvedIntensity = Math.pow(norm, 1.8);
      return [pt.lat, pt.lng, Math.max(0.15, curvedIntensity)];
    });

    if (heatLayer) {
      map.removeLayer(heatLayer);
    }

    heatLayer = L.heatLayer(blendedHeatPoints, {
      radius: getRadiusForZoom(currentZoom),
      blur: getBlurForZoom(currentZoom),
      maxZoom: 16,
      max: 1.0,
      minOpacity: 0.35,
      gradient: RISK_GRADIENT
    }).addTo(map);
  }

  renderBlendedHeatmap();
  map.on('zoomend moveend', renderBlendedHeatmap);

  /* ---------------- Step 6: Interactive Point Assessment ---------------- */
  let clickMarker = null;

  map.on('click', (e) => {
    const { lat, lng } = e.latlng;

    let nearestIdx = 0, minDist = Infinity;
    grid.forEach((pt, i) => {
      const d = distanceKm(lat, lng, pt.lat, pt.lng);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });

    const rainData = weatherRes.data.rain[nearestIdx] || FALLBACK_RAIN7;
    const tempData = weatherRes.data.temp[nearestIdx] || FALLBACK_TEMP7;
    
    const rainScore = rainfallSubscore(rainData);
    const tempScore = temperatureSubscore(tempData);
    const waterScore = waterProximitySubscore(lat, lng, waterRes.data);
    const reportScore = reportSubscore(lat, lng, globeRes.data);

    const rawScore = (rainScore * RISK_WEIGHTS.rain) * (tempScore * RISK_WEIGHTS.temp) +
                     (waterScore * RISK_WEIGHTS.water) + (reportScore * RISK_WEIGHTS.report);

    const maxScore = Math.max(...gridRisk.map(r => r.rawScore), 0.001);
    const minScore = Math.min(...gridRisk.map(r => r.rawScore), 0);
    const intensity = Math.max(0, Math.min(1, (rawScore - minScore) / Math.max(maxScore - minScore, 0.001)));
    const tier = intensity >= 0.70 ? 'high' : intensity >= 0.35 ? 'medium' : 'low';

    const local7dRain = rainData.reduce((a, b) => a + b, 0);
    const avgTempF = Math.round(tempData.reduce((a, b) => a + b, 0) / tempData.length);

    if (clickMarker) map.removeLayer(clickMarker);

    clickMarker = L.popup()
      .setLatLng([lat, lng])
      .setContent(`
        <div class="popup">
          <div class="pop-title">Location Risk Assessment</div>
          <div class="pop-tier" style="background:${tierBg(tier)};color:${tierColor(tier)}">${tierLabel(tier)}</div>
          <div class="pop-row"><b>Coordinates:</b> ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          <div class="pop-row"><b>7-Day Rainfall:</b> ${local7dRain.toFixed(2)}"</div>
          <div class="pop-row"><b>Avg Temp:</b> ${avgTempF}°F</div>
          <div class="pop-row"><b>Water Body Risk Factor:</b> ${(waterScore * 100).toFixed(0)}%</div>
        </div>
      `)
      .openOn(map);
  });

  /* ---------------- Step 7: Map Markers ---------------- */
  waterRes.data.forEach(w => {
    L.circleMarker([w.lat, w.lng], {
      radius: 4,
      color: '#2D7D9A',
      weight: 1,
      fillColor: '#DDEEF3',
      fillOpacity: 0.85
    }).bindPopup(`<b>${w.name}</b><br>Standing water feature`).addTo(map);
  });

  const markers = {};
  globeRes.data.forEach(site => {
    let nearestIdx = 0, minDist = Infinity;
    grid.forEach((pt, i) => {
      const d = distanceKm(site.lat, site.lng, pt.lat, pt.lng);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });
    const siteRisk = gridRisk[nearestIdx];

    const marker = L.circleMarker([site.lat, site.lng], {
      radius: 6,
      color: '#ffffff',
      weight: 1.5,
      fillColor: tierColor(siteRisk.tier),
      fillOpacity: 0.95,
    }).addTo(map);

    marker.bindPopup(`
      <div class="popup">
        <div class="pop-title">${site.name}</div>
        <div class="pop-tier" style="background:${tierBg(siteRisk.tier)};color:${tierColor(siteRisk.tier)}">${tierLabel(siteRisk.tier)}</div>
        <div class="pop-row">${site.larvaeCount > 0 ? `Confirmed larvae (${site.larvaeCount})` : 'No larvae recorded'}</div>
        <div class="pop-row"><b>Water Source:</b> ${site.waterSource}</div>
      </div>
    `);
    markers[site.name] = marker;
  });

  /* ---------------- Step 8: Sidebar Summary Metrics ---------------- */
  document.getElementById('stat-sites').textContent = globeRes.data.length;
  document.getElementById('stat-hot').textContent = gridRisk.filter(s => s.tier === 'high').length;
  document.getElementById('stat-rain').textContent = rain7dTotal.toFixed(1) + '"';

  (function renderRainChart() {
    const chart = document.getElementById('rain-chart');
    const labels = document.getElementById('rain-labels');
    if (!chart || !labels) return;
    chart.innerHTML = '';
    labels.innerHTML = '';

    const max = Math.max(...dailyAvgRain, 0.3);
    dailyAvgRain.forEach((v, i) => {
      const col = document.createElement('div');
      col.className = 'rain-bar-col';
      const bar = document.createElement('div');
      bar.className = 'rain-bar';
      bar.style.height = Math.max(3, Math.round((v / max) * 56)) + 'px';
      col.appendChild(bar);
      chart.appendChild(col);

      const lab = document.createElement('span');
      lab.textContent = RAIN_DAY_LABELS_7[i];
      labels.appendChild(lab);
    });
  })();

  (function renderSiteList() {
    const list = document.getElementById('site-list');
    if (!list) return;
    list.innerHTML = '';

    globeRes.data.forEach(site => {
      const btn = document.createElement('button');
      btn.className = 'site-item';
      btn.innerHTML = `
        <span class="site-dot" style="background:${site.larvaeCount > 0 ? '#EF4444' : '#10B981'}"></span>
        <span class="site-info">
          <div class="site-name">${site.name}</div>
          <div class="site-meta">${site.waterSource} · ${site.larvaeCount} larvae</div>
        </span> 
      `;
      btn.addEventListener('click', () => {
        map.flyTo([site.lat, site.lng], 14, { duration: 0.6 });
        if (markers[site.name]) markers[site.name].openPopup();
      });
      list.appendChild(btn);
    });
  })();

})();