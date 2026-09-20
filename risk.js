/**
 * Biological Mosquito Risk Model & Elevation Gradient Configuration.
 */

function rainfallSubscore(rain7) {
  let score = 0;
  for (let i = 0; i < rain7.length && i < RAIN_DAY_WEIGHTS.length; i++) {
    score += (rain7[i] || 0) * RAIN_DAY_WEIGHTS[i];
  }
  return score;
}

function temperatureSubscore(temp7) {
  const avgTemp = temp7.reduce((a, b) => a + b, 0) / (temp7.length || 1);
  if (avgTemp < 55) return 0.1;
  if (avgTemp > 95) return 0.4;
  return Math.min(1.0, (avgTemp - 55) / 30);
}

function waterProximitySubscore(lat, lng, waterBodies) {
  if (!waterBodies.length) return 0;
  let maxInfluence = 0;
  for (const w of waterBodies) {
    const d = distanceKm(lat, lng, w.lat, w.lng);
    if (d < WATER_INFLUENCE_KM) {
      const proximityFactor = (1 - d / WATER_INFLUENCE_KM);
      const weightedScore = proximityFactor * (w.weight || 1.0);
      if (weightedScore > maxInfluence) maxInfluence = weightedScore;
    }
  }
  return maxInfluence;
}

function reportSubscore(lat, lng, sites) {
  let best = 0;
  for (const s of sites) {
    if (!s.larvaeCount || s.eliminated) continue;
    const d = distanceKm(lat, lng, s.lat, s.lng);
    const contribution = Math.max(0, 1 - d / REPORT_INFLUENCE_KM);
    if (contribution > best) best = contribution;
  }
  return best;
}

function computeGridRisk(grid, weatherByGrid, waterBodies, sites) {
  const raw = grid.map((pt, i) => {
    const rain = rainfallSubscore((weatherByGrid.rain && weatherByGrid.rain[i]) || FALLBACK_RAIN7);
    const temp = temperatureSubscore((weatherByGrid.temp && weatherByGrid.temp[i]) || FALLBACK_TEMP7);
    const water = waterProximitySubscore(pt.lat, pt.lng, waterBodies);
    const report = reportSubscore(pt.lat, pt.lng, sites);

    const rawScore =
      (rain * RISK_WEIGHTS.rain) * (temp * RISK_WEIGHTS.temp) +
      (water * RISK_WEIGHTS.water) +
      (report * RISK_WEIGHTS.report);

    return { ...pt, rain, temp, water, report, rawScore };
  });

  const max = Math.max(...raw.map(r => r.rawScore), 0.001);
  const min = Math.min(...raw.map(r => r.rawScore), 0);
  const range = Math.max(max - min, 0.001);

  return raw.map(r => {
    const intensity = Math.max(0, Math.min(1, (r.rawScore - min) / range));
    const tier = intensity >= 0.70 ? 'high' : intensity >= 0.35 ? 'medium' : 'low';
    return { ...r, intensity, tier };
  });
}

// Topographic Elevation-Style Gradient: Low (Green) -> Moderate (Yellow/Orange) -> High (Deep Red)
const RISK_GRADIENT = {
  0.0:  '#10B981', // Low risk: Emerald Green
  0.25: '#84CC16', // Low-Medium: Lime Green
  0.50: '#FACE15', // Medium: Yellow
  0.72: '#F97316', // Medium-High: Orange
  1.0:  '#EF4444'  // High risk: Crimson Red
};

function tierColor(tier) {
  return tier === 'high' ? '#EF4444' : tier === 'medium' ? '#F97316' : '#10B981';
}
function tierBg(tier) {
  return tier === 'high' ? '#FEE2E2' : tier === 'medium' ? '#FFEDD5' : '#D1FAE5';
}
function tierLabel(tier) {
  return tier === 'high' ? 'High risk' : tier === 'medium' ? 'Medium risk' : 'Low risk';
}

function citywideDailyAverage(rainByGrid) {
  const days = 7;
  const avg = [];
  for (let d = 0; d < days; d++) {
    let sum = 0, n = 0;
    rainByGrid.forEach(arr => {
      if (arr && arr[d] != null) { sum += arr[d]; n++; }
    });
    avg.push(n ? sum / n : 0);
  }
  return avg;
}