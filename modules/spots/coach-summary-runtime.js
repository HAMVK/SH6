export function createSpotsCoachSummaryRuntime(deps = {}) {
  const {
    lookupPrefix,
    normalizeBandToken,
    bandOrderIndex,
    escapeHtml,
    escapeAttr,
    formatBandLabel,
    formatNumberSh6,
    coachSeverityLabel
  } = deps;

  function lookupPrefixSafe(value) {
    if (typeof lookupPrefix === 'function') return lookupPrefix(value);
    return null;
  }

  function normalizeBandTokenSafe(value) {
    if (typeof normalizeBandToken === 'function') return normalizeBandToken(value);
    return String(value || '').trim().toUpperCase();
  }

  function bandOrderIndexSafe(value) {
    if (typeof bandOrderIndex === 'function') return bandOrderIndex(value);
    return 99;
  }

  function escapeHtmlSafe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value == null ? '' : value);
  }

  function escapeAttrSafe(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value);
    return String(value == null ? '' : value);
  }

  function formatBandLabelSafe(value) {
    if (typeof formatBandLabel === 'function') return formatBandLabel(value);
    return String(value || '').trim().toUpperCase();
  }

  function formatNumberSafe(value) {
    if (typeof formatNumberSh6 === 'function') return formatNumberSh6(value);
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString('en-US') : '0';
  }

  function coachSeverityLabelSafe(value) {
    if (typeof coachSeverityLabel === 'function') return coachSeverityLabel(value);
    return String(value || '').trim();
  }

  function computeSpotterReliabilityEntries(spots, minSpots = 3) {
    if (!spots || !spots.length) return [];
    const map = new Map();
    spots.forEach((spot) => {
      if (!map.has(spot.spotter)) map.set(spot.spotter, { spotter: spot.spotter, spots: 0, matched: 0 });
      const entry = map.get(spot.spotter);
      entry.spots += 1;
      if (spot.matched) entry.matched += 1;
    });
    return Array.from(map.values())
      .filter((entry) => entry.spots >= minSpots)
      .map((entry) => ({ ...entry, pct: entry.spots ? (entry.matched / entry.spots) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct || b.spots - a.spots);
  }

  function buildMissedMultEntries(spots, analysis) {
    if (!spots || !spots.length) return [];
    const missed = [];
    spots.forEach((spot) => {
      if (spot.matchedDx) return;
      const prefix = lookupPrefixSafe(spot.dxCall || '');
      const country = prefix?.country || '';
      if (!country) return;
      const first = analysis?.firstCountryTime?.get?.(country);
      if (first != null && first < spot.ts) return;
      missed.push({
        ts: spot.ts,
        band: spot.band,
        dx: spot.dxCall,
        country
      });
    });
    return missed;
  }

  function buildBestBandHourWindows(spots, limit = 3) {
    if (!spots || !spots.length) return [];
    const map = new Map();
    spots.forEach((spot) => {
      if (!Number.isFinite(spot.ts)) return;
      const band = normalizeBandTokenSafe(spot.band || '') || 'unknown';
      const hour = new Date(spot.ts).getUTCHours();
      const key = `${band}|${hour}`;
      if (!map.has(key)) map.set(key, { band, hour, spots: 0, matched: 0 });
      const entry = map.get(key);
      entry.spots += 1;
      if (spot.matched) entry.matched += 1;
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        conv: entry.spots ? (entry.matched / entry.spots) * 100 : 0
      }))
      .filter((entry) => entry.spots >= 3)
      .sort((a, b) => {
        if (b.matched !== a.matched) return b.matched - a.matched;
        if (b.conv !== a.conv) return b.conv - a.conv;
        if (b.spots !== a.spots) return b.spots - a.spots;
        return bandOrderIndexSafe(a.band) - bandOrderIndexSafe(b.band);
      })
      .slice(0, Math.max(1, Math.min(5, Number(limit) || 3)));
  }

  function estimateWindowConfidence(spots) {
    if (spots >= 30) return 'high';
    if (spots >= 12) return 'medium';
    return 'low';
  }

  function renderSpotsCoachCards(context = {}) {
    const {
      statsData,
      analysis,
      sourceAttr = 'spots',
      slotAttr = 'A',
      sectionIds = {}
    } = context;
    if (!statsData || !analysis) return '';

    const bestWindows = buildBestBandHourWindows(statsData.ofUsSpots || [], 3);
    const bestWindowRows = bestWindows.length
      ? bestWindows.map((entry) => {
        const hour = String(entry.hour).padStart(2, '0');
        const conv = Number.isFinite(entry.conv) ? `${entry.conv.toFixed(1)}%` : 'N/A';
        return `<li><b>${escapeHtmlSafe(formatBandLabelSafe(entry.band || ''))} ${hour}:00Z</b> · ${formatNumberSafe(entry.matched)}/${formatNumberSafe(entry.spots)} matched (${conv})</li>`;
      }).join('')
      : '<li>No strong hour/band window found yet. Try broader band filters.</li>';
    const confidenceSpots = bestWindows.reduce((sum, entry) => sum + (Number(entry.spots) || 0), 0);
    const confidenceLabel = estimateWindowConfidence(confidenceSpots);
    const confidenceText = confidenceLabel === 'high'
      ? 'high confidence'
      : (confidenceLabel === 'medium' ? 'medium confidence' : 'low confidence');
    const windowSeverity = confidenceLabel === 'low'
      ? 'high'
      : (confidenceLabel === 'medium' ? 'medium' : 'opportunity');

    const reliableSpotters = computeSpotterReliabilityEntries(statsData.ofUsSpots || [], 4).slice(0, 3);
    const reliableRows = reliableSpotters.length
      ? reliableSpotters.map((entry) => `<li><b>${escapeHtmlSafe(entry.spotter || '')}</b> · ${entry.pct.toFixed(1)}% conversion (${formatNumberSafe(entry.matched)}/${formatNumberSafe(entry.spots)})</li>`).join('')
      : '<li>No spotter with enough sample size yet (need at least 4 spots).</li>';
    const topReliabilityPct = Number(reliableSpotters?.[0]?.pct || 0);
    const reliabilitySeverity = !reliableSpotters.length
      ? 'medium'
      : (topReliabilityPct < 35 ? 'medium' : 'opportunity');

    const missedMults = buildMissedMultEntries(statsData.byUsSpots || [], analysis);
    const topMissedCountries = Array.from(missedMults.reduce((map, entry) => {
      const key = String(entry.country || '').trim();
      if (!key) return map;
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map()).entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const missedRows = topMissedCountries.length
      ? topMissedCountries.map(([country, count]) => `<li><b>${escapeHtmlSafe(country)}</b> · ${formatNumberSafe(count)} potential mult misses</li>`).join('')
      : '<li>No clear missed multiplier concentration detected.</li>';
    const missedTotalText = missedMults.length ? formatNumberSafe(missedMults.length) : '0';
    const missedSeverity = missedMults.length >= 25
      ? 'high'
      : (missedMults.length >= 10 ? 'medium' : (missedMults.length > 0 ? 'opportunity' : 'info'));

    return `
      <div class="spots-coach-grid">
        <article class="spots-coach-card">
          <div class="spots-coach-head">
            <h4>Best hour/band windows</h4>
            <span class="coach-severity-badge coach-severity-${windowSeverity}">${coachSeverityLabelSafe(windowSeverity)}</span>
          </div>
          <p class="spots-coach-note">Top match windows from your current band filter (${confidenceText}; ${formatNumberSafe(confidenceSpots)} spots sampled).</p>
          <ul class="spots-coach-list">${bestWindowRows}</ul>
          <button type="button" class="spots-coach-action" data-source="${sourceAttr}" data-slot="${slotAttr}" data-target="${escapeAttrSafe(sectionIds.bandHour)}">Jump to band/hour table</button>
        </article>
        <article class="spots-coach-card">
          <div class="spots-coach-head">
            <h4>Spotter reliability leaders</h4>
            <span class="coach-severity-badge coach-severity-${reliabilitySeverity}">${coachSeverityLabelSafe(reliabilitySeverity)}</span>
          </div>
          <p class="spots-coach-note">Spotters with the best QSO conversion for your station.</p>
          <ul class="spots-coach-list">${reliableRows}</ul>
          <button type="button" class="spots-coach-action" data-source="${sourceAttr}" data-slot="${slotAttr}" data-target="${escapeAttrSafe(sectionIds.topSpotters)}">Jump to top spotters</button>
        </article>
        <article class="spots-coach-card">
          <div class="spots-coach-head">
            <h4>Missed multiplier opportunities</h4>
            <span class="coach-severity-badge coach-severity-${missedSeverity}">${coachSeverityLabelSafe(missedSeverity)}</span>
          </div>
          <p class="spots-coach-note">Raw candidates: ${missedTotalText}. Focus first on these repeat countries.</p>
          <ul class="spots-coach-list">${missedRows}</ul>
          <button type="button" class="spots-coach-action" data-source="${sourceAttr}" data-slot="${slotAttr}" data-target="${escapeAttrSafe(sectionIds.missedMults)}">Jump to missed mult table</button>
        </article>
      </div>
    `;
  }

  return {
    computeSpotterReliabilityEntries,
    buildMissedMultEntries,
    buildBestBandHourWindows,
    estimateWindowConfidence,
    renderSpotsCoachCards
  };
}
