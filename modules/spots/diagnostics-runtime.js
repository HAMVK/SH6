export function createSpotsDiagnosticsRuntime(deps = {}) {
  const {
    normalizeBandToken,
    normalizeCall,
    lookupPrefix,
    bandOrderIndex,
    formatBandLabel,
    formatDateSh6,
    formatNumberSh6,
    escapeHtml,
    bandClass,
    computeSpotterReliabilityEntries,
    buildMissedMultEntries
  } = deps;

  function normalizeBandTokenSafe(value) {
    if (typeof normalizeBandToken === 'function') return normalizeBandToken(value);
    return String(value || '').trim().toUpperCase();
  }

  function normalizeCallSafe(value) {
    if (typeof normalizeCall === 'function') return normalizeCall(value);
    return String(value || '').trim().toUpperCase();
  }

  function lookupPrefixSafe(value) {
    if (typeof lookupPrefix === 'function') return lookupPrefix(value);
    return null;
  }

  function bandOrderIndexSafe(value) {
    if (typeof bandOrderIndex === 'function') return bandOrderIndex(value);
    return 99;
  }

  function formatBandLabelSafe(value) {
    if (typeof formatBandLabel === 'function') return formatBandLabel(value);
    return String(value || '').trim().toUpperCase();
  }

  function formatDateSafe(value) {
    if (typeof formatDateSh6 === 'function') return formatDateSh6(value);
    return String(value == null ? '' : value);
  }

  function formatNumberSafe(value) {
    if (typeof formatNumberSh6 === 'function') return formatNumberSh6(value);
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString('en-US') : '0';
  }

  function escapeHtmlSafe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value == null ? '' : value);
  }

  function bandClassSafe(value) {
    if (typeof bandClass === 'function') return bandClass(value);
    return '';
  }

  function computeSpotterReliabilityEntriesSafe(spots, minSpots) {
    if (typeof computeSpotterReliabilityEntries === 'function') {
      return computeSpotterReliabilityEntries(spots, minSpots);
    }
    return [];
  }

  function buildMissedMultEntriesSafe(spots, analysis) {
    if (typeof buildMissedMultEntries === 'function') {
      return buildMissedMultEntries(spots, analysis);
    }
    return [];
  }

  function medianValue(list) {
    if (!list || !list.length) return null;
    const sorted = list.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function lowerBound(list, target) {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (list[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function countInRange(list, start, end) {
    if (!list || !list.length) return 0;
    const left = lowerBound(list, start);
    const right = lowerBound(list, end);
    return Math.max(0, right - left);
  }

  function findAfterRecord(list, ts) {
    if (!list || !list.length) return null;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (list[mid].ts < ts) lo = mid + 1;
      else hi = mid;
    }
    return list[lo] || null;
  }

  function findBeforeRecord(list, ts) {
    if (!list || !list.length) return null;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (list[mid].ts <= ts) lo = mid + 1;
      else hi = mid;
    }
    return list[lo - 1] || null;
  }

  function formatUtcDate(ts) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatUtcTime(ts) {
    const d = new Date(ts);
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function buildAnalysisContext(context = {}) {
    const qsos = Array.isArray(context.qsos) ? context.qsos : [];
    const bandFilter = Array.isArray(context.bandFilter) ? context.bandFilter : [];
    const bandSet = new Set(bandFilter);
    const bandAllowed = (band) => {
      if (!bandSet.size) return true;
      return bandSet.has(band || 'unknown');
    };
    const allQsos = qsos.filter((q) => Number.isFinite(q?.ts));
    const filteredQsos = allQsos.filter((q) => bandAllowed(normalizeBandTokenSafe(q.band || '') || 'unknown'));
    const filteredSorted = filteredQsos.slice().sort((a, b) => a.ts - b.ts);
    const allTimes = filteredSorted.map((q) => q.ts);
    const qsoTimesByBand = new Map();
    const qsoRecordsByBand = new Map();
    filteredSorted.forEach((q) => {
      const band = normalizeBandTokenSafe(q.band || '') || 'unknown';
      if (!qsoTimesByBand.has(band)) {
        qsoTimesByBand.set(band, []);
        qsoRecordsByBand.set(band, []);
      }
      qsoTimesByBand.get(band).push(q.ts);
      qsoRecordsByBand.get(band).push({ ts: q.ts, freq: q.freq, call: q.call || '', country: q.country || '', band });
    });
    const allSorted = allQsos.slice().sort((a, b) => a.ts - b.ts);
    const firstCallTime = new Map();
    const firstCallBandTime = new Map();
    const firstCountryTime = new Map();
    allSorted.forEach((q) => {
      const callKey = normalizeCallSafe(q.call || '');
      if (callKey && !firstCallTime.has(callKey)) firstCallTime.set(callKey, q.ts);
      const bandKey = normalizeBandTokenSafe(q.band || '') || 'unknown';
      if (callKey) {
        const key = `${bandKey}|${callKey}`;
        if (!firstCallBandTime.has(key)) firstCallBandTime.set(key, q.ts);
      }
      const country = q.country || '';
      if (country && !firstCountryTime.has(country)) firstCountryTime.set(country, q.ts);
    });
    return {
      bandSet,
      bandAllowed,
      filteredSorted,
      allTimes,
      qsoTimesByBand,
      qsoRecordsByBand,
      firstCallTime,
      firstCallBandTime,
      firstCountryTime
    };
  }

  function renderUnworkedRateTable(spots) {
    if (!spots || !spots.length) return '<p>No data.</p>';
    const map = new Map();
    spots.forEach((spot) => {
      const band = spot.band || 'unknown';
      const hour = new Date(spot.ts).getUTCHours();
      const key = `${band}|${hour}`;
      if (!map.has(key)) map.set(key, { band, hour, total: 0, unanswered: 0 });
      const entry = map.get(key);
      entry.total += 1;
      if (!spot.matched) entry.unanswered += 1;
    });
    const entries = Array.from(map.values())
      .filter((entry) => entry.total >= 3)
      .map((entry) => ({
        ...entry,
        pct: entry.total ? (entry.unanswered / entry.total) * 100 : 0
      }));
    if (!entries.length) return '<p>No band/hour buckets with at least 3 spots.</p>';
    entries.sort((a, b) => b.pct - a.pct || b.total - a.total);
    const rows = entries.slice(0, 20).map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      return `
        <tr class="${cls}">
          <td class="${bandClassSafe(entry.band)}">${escapeHtmlSafe(formatBandLabelSafe(entry.band || ''))}</td>
          <td>${String(entry.hour).padStart(2, '0')}</td>
          <td>${formatNumberSafe(entry.total)}</td>
          <td>${formatNumberSafe(entry.unanswered)}</td>
          <td>${entry.pct.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Band</th><th>Hour</th><th>Spots</th><th>Unanswered</th><th>%</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderTimeToFirstQsoTable(spots, analysis) {
    if (!spots || !spots.length) return '<p>No data.</p>';
    const byBand = new Map();
    spots.forEach((spot) => {
      const band = spot.band || 'unknown';
      if (!byBand.has(band)) byBand.set(band, []);
      byBand.get(band).push(spot.ts);
    });
    const gapMs = 30 * 60000;
    const rows = Array.from(byBand.entries()).map(([band, list]) => {
      const times = list.slice().sort((a, b) => a - b);
      const clusterStarts = [];
      let start = times[0];
      let prev = times[0];
      for (let i = 1; i < times.length; i += 1) {
        const ts = times[i];
        if (ts - prev > gapMs) {
          clusterStarts.push(start);
          start = ts;
        }
        prev = ts;
      }
      clusterStarts.push(start);
      const qsoList = analysis?.qsoRecordsByBand?.get?.(band) || [];
      const deltas = [];
      clusterStarts.forEach((ts) => {
        const next = findAfterRecord(qsoList, ts);
        if (next) deltas.push((next.ts - ts) / 60000);
      });
      return {
        band,
        clusters: clusterStarts.length,
        found: deltas.length,
        avg: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null,
        median: medianValue(deltas)
      };
    }).sort((a, b) => b.clusters - a.clusters);
    if (!rows.length) return '<p>No data.</p>';
    const body = rows.map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      return `
        <tr class="${cls}">
          <td class="${bandClassSafe(entry.band)}">${escapeHtmlSafe(formatBandLabelSafe(entry.band || ''))}</td>
          <td>${formatNumberSafe(entry.clusters)}</td>
          <td>${formatNumberSafe(entry.found)}</td>
          <td>${entry.avg != null ? entry.avg.toFixed(1) : 'N/A'}</td>
          <td>${entry.median != null ? entry.median.toFixed(1) : 'N/A'}</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Band</th><th>Spot clusters</th><th>With QSO</th><th>Avg min</th><th>Median min</th></tr>
        ${body}
      </table>
    `;
  }

  function renderSpotUpliftTable(spots, analysis) {
    if (!spots || !spots.length) return '<p>No data.</p>';
    const windowMs = 10 * 60000;
    const map = new Map();
    spots.forEach((spot) => {
      const band = spot.band || 'unknown';
      const list = analysis?.qsoTimesByBand?.get?.(band) || [];
      const before = countInRange(list, spot.ts - windowMs, spot.ts);
      const after = countInRange(list, spot.ts, spot.ts + windowMs);
      if (!map.has(band)) map.set(band, { band, spots: 0, beforeSum: 0, afterSum: 0, upliftSum: 0, positive: 0 });
      const entry = map.get(band);
      entry.spots += 1;
      entry.beforeSum += before;
      entry.afterSum += after;
      entry.upliftSum += (after - before);
      if (after > before) entry.positive += 1;
    });
    const rows = Array.from(map.values()).sort((a, b) => b.spots - a.spots).map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      const avgBefore = entry.spots ? entry.beforeSum / entry.spots : 0;
      const avgAfter = entry.spots ? entry.afterSum / entry.spots : 0;
      const avgUplift = entry.spots ? entry.upliftSum / entry.spots : 0;
      const pct = entry.spots ? (entry.positive / entry.spots) * 100 : 0;
      return `
        <tr class="${cls}">
          <td class="${bandClassSafe(entry.band)}">${escapeHtmlSafe(formatBandLabelSafe(entry.band || ''))}</td>
          <td>${avgBefore.toFixed(2)}</td>
          <td>${avgAfter.toFixed(2)}</td>
          <td>${avgUplift.toFixed(2)}</td>
          <td>${pct.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Band</th><th>Avg 10m before</th><th>Avg 10m after</th><th>Avg uplift</th><th>% positive</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderSpottingFunnelTable(spots, analysis) {
    const total = spots.length;
    if (!total) return '<p>No data.</p>';
    let matchedBand = 0;
    let matchedDx = 0;
    let newCall = 0;
    let newBand = 0;
    let newCountry = 0;
    spots.forEach((spot) => {
      if (spot.matched) matchedBand += 1;
      if (spot.matchedDx) {
        matchedDx += 1;
        const callKey = normalizeCallSafe(spot.dxCall || '');
        if (callKey) {
          const firstCall = analysis?.firstCallTime?.get?.(callKey);
          if (firstCall == null || firstCall >= spot.ts) newCall += 1;
          const bandKey = spot.band || 'unknown';
          const bandCallKey = `${bandKey}|${callKey}`;
          const firstBand = analysis?.firstCallBandTime?.get?.(bandCallKey);
          if (firstBand == null || firstBand >= spot.ts) newBand += 1;
        }
        const prefix = lookupPrefixSafe(spot.dxCall || '');
        const country = prefix?.country || '';
        if (country) {
          const firstCountry = analysis?.firstCountryTime?.get?.(country);
          if (firstCountry == null || firstCountry >= spot.ts) newCountry += 1;
        }
      }
    });
    const rows = [
      { label: 'Spots by you (total)', count: total },
      { label: 'Matched on band', count: matchedBand },
      { label: 'Worked DX (call)', count: matchedDx },
      { label: 'New DX call', count: newCall },
      { label: 'New band for call', count: newBand },
      { label: 'New country (cty)', count: newCountry }
    ].map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      const pct = total ? (entry.count / total) * 100 : 0;
      return `
        <tr class="${cls}">
          <td class="tl">${escapeHtmlSafe(entry.label)}</td>
          <td>${formatNumberSafe(entry.count)}</td>
          <td>${pct.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Stage</th><th>Count</th><th>% of total</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderBandChangeEfficiencyTable(analysis) {
    const qsos = analysis?.filteredSorted;
    if (!qsos || qsos.length < 2) return '<p>No data.</p>';
    const windowMs = 10 * 60000;
    const map = new Map();
    for (let i = 1; i < qsos.length; i += 1) {
      const prev = qsos[i - 1];
      const curr = qsos[i];
      const prevBand = normalizeBandTokenSafe(prev.band || '') || 'unknown';
      const currBand = normalizeBandTokenSafe(curr.band || '') || 'unknown';
      if (prevBand === currBand) continue;
      const before = countInRange(analysis.allTimes, curr.ts - windowMs, curr.ts);
      const after = countInRange(analysis.allTimes, curr.ts, curr.ts + windowMs);
      if (!map.has(currBand)) map.set(currBand, { band: currBand, switches: 0, improved: 0, upliftSum: 0 });
      const entry = map.get(currBand);
      entry.switches += 1;
      const uplift = after - before;
      entry.upliftSum += uplift;
      if (uplift > 0) entry.improved += 1;
    }
    const rows = Array.from(map.values()).sort((a, b) => b.switches - a.switches).map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      const pct = entry.switches ? (entry.improved / entry.switches) * 100 : 0;
      const avg = entry.switches ? entry.upliftSum / entry.switches : 0;
      return `
        <tr class="${cls}">
          <td class="${bandClassSafe(entry.band)}">${escapeHtmlSafe(formatBandLabelSafe(entry.band || ''))}</td>
          <td>${formatNumberSafe(entry.switches)}</td>
          <td>${pct.toFixed(1)}%</td>
          <td>${avg.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Band</th><th>Switches into band</th><th>% improved</th><th>Avg uplift</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderSpotterReliabilityTable(spots) {
    const entries = computeSpotterReliabilityEntriesSafe(spots, 3);
    const rows = entries.slice(0, 15).map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      return `
        <tr class="${cls}">
          <td>${escapeHtmlSafe(entry.spotter || '')}</td>
          <td>${formatNumberSafe(entry.spots)}</td>
          <td>${formatNumberSafe(entry.matched)}</td>
          <td>${entry.pct.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
    if (!rows) return '<p>No spotters with at least 3 spots.</p>';
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Spotter</th><th>Spots</th><th>Matched</th><th>%</th></tr>
        ${rows}
      </table>
    `;
  }

  function hasConcurrentBands(qsos) {
    const buckets = new Map();
    const bucketMs = 10 * 60000;
    (qsos || []).forEach((qso) => {
      if (!Number.isFinite(qso?.ts)) return;
      const band = normalizeBandTokenSafe(qso.band || '') || 'unknown';
      const bucket = Math.floor(qso.ts / bucketMs);
      if (!buckets.has(bucket)) buckets.set(bucket, new Set());
      const set = buckets.get(bucket);
      set.add(band);
    });
    for (const set of buckets.values()) {
      if (set.size > 1) return true;
    }
    return false;
  }

  function renderMissedMultTable(spots, analysis) {
    const missed = buildMissedMultEntriesSafe(spots, analysis);
    if (!missed.length) return '<p>No missed mult candidates found.</p>';
    const rows = missed.slice(0, 20).map((spot, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      return `
        <tr class="${cls}">
          <td>${escapeHtmlSafe(formatDateSafe(spot.ts))}</td>
          <td class="${bandClassSafe(spot.band)}">${escapeHtmlSafe(formatBandLabelSafe(spot.band || ''))}</td>
          <td>${escapeHtmlSafe(spot.dx || '')}</td>
          <td>${escapeHtmlSafe(spot.country || '')}</td>
        </tr>
      `;
    }).join('');
    return `
      <p>Missed mult candidates: ${formatNumberSafe(missed.length)}</p>
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Time (UTC)</th><th>Band</th><th>DX</th><th>Country</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderOpenCloseTable(spots) {
    if (!spots || !spots.length) return '<p>No data.</p>';
    const map = new Map();
    spots.forEach((spot) => {
      const day = formatUtcDate(spot.ts);
      const band = spot.band || 'unknown';
      const key = `${day}|${band}`;
      if (!map.has(key)) map.set(key, { day, band, min: spot.ts, max: spot.ts });
      const entry = map.get(key);
      entry.min = Math.min(entry.min, spot.ts);
      entry.max = Math.max(entry.max, spot.ts);
    });
    const entries = Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day) || bandOrderIndexSafe(a.band) - bandOrderIndexSafe(b.band));
    const rows = entries.map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      const spanHours = ((entry.max - entry.min) / 3600000).toFixed(1);
      return `
        <tr class="${cls}">
          <td>${escapeHtmlSafe(entry.day)}</td>
          <td class="${bandClassSafe(entry.band)}">${escapeHtmlSafe(formatBandLabelSafe(entry.band || ''))}</td>
          <td>${formatUtcTime(entry.min)}</td>
          <td>${formatUtcTime(entry.max)}</td>
          <td>${spanHours}</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Day (UTC)</th><th>Band</th><th>Open</th><th>Close</th><th>Span (h)</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderPileupWindowTable(spots, analysis) {
    if (!spots || !spots.length) return '<p>No data.</p>';
    const bucketMs = 10 * 60000;
    const spotBuckets = new Map();
    spots.forEach((spot) => {
      const bucket = Math.floor(spot.ts / bucketMs);
      spotBuckets.set(bucket, (spotBuckets.get(bucket) || 0) + 1);
    });
    const qsoBuckets = new Map();
    (analysis?.allTimes || []).forEach((ts) => {
      const bucket = Math.floor(ts / bucketMs);
      qsoBuckets.set(bucket, (qsoBuckets.get(bucket) || 0) + 1);
    });
    const entries = Array.from(spotBuckets.entries()).map(([bucket, count]) => ({
      bucket,
      spots: count,
      qsos: qsoBuckets.get(bucket) || 0
    })).filter((entry) => entry.spots >= 5);
    if (!entries.length) return '<p>No pileup windows with at least 5 spots.</p>';
    entries.sort((a, b) => b.spots - a.spots || b.qsos - a.qsos);
    const rows = entries.slice(0, 20).map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      const startTs = entry.bucket * bucketMs;
      return `
        <tr class="${cls}">
          <td>${escapeHtmlSafe(formatDateSafe(startTs))}</td>
          <td>${formatNumberSafe(entry.spots)}</td>
          <td>${formatNumberSafe(entry.qsos)}</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Window start (UTC)</th><th>Spots</th><th>QSOs</th></tr>
        ${rows}
      </table>
    `;
  }

  function renderFrequencyAgilityTable(spots, analysis) {
    if (!spots || !spots.length) return '<p>No data.</p>';
    const moved = { count: 0, rateSum: 0, deltas: [] };
    const stayed = { count: 0, rateSum: 0, deltas: [] };
    const windowMs = 10 * 60000;
    spots.forEach((spot) => {
      const band = spot.band || 'unknown';
      const list = analysis?.qsoRecordsByBand?.get?.(band) || [];
      const times = analysis?.qsoTimesByBand?.get?.(band) || [];
      if (list.length < 2) return;
      const before = findBeforeRecord(list, spot.ts);
      const after = findAfterRecord(list, spot.ts);
      if (!before || !after) return;
      if (!Number.isFinite(before.freq) || !Number.isFinite(after.freq)) return;
      const deltaKhz = Math.abs(after.freq - before.freq) * 1000;
      const rateAfter = countInRange(times, spot.ts, spot.ts + windowMs);
      const bucket = deltaKhz >= 1 ? moved : stayed;
      bucket.count += 1;
      bucket.rateSum += rateAfter;
      bucket.deltas.push(deltaKhz);
    });
    if (!moved.count && !stayed.count) return '<p>No frequency-change samples.</p>';
    const rows = [
      { label: 'Moved ≥ 1 kHz', data: moved },
      { label: 'Stayed < 1 kHz', data: stayed }
    ].map((entry, idx) => {
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      const avgRate = entry.data.count ? entry.data.rateSum / entry.data.count : 0;
      const median = medianValue(entry.data.deltas);
      return `
        <tr class="${cls}">
          <td class="tl">${escapeHtmlSafe(entry.label)}</td>
          <td>${formatNumberSafe(entry.data.count)}</td>
          <td>${avgRate.toFixed(2)}</td>
          <td>${median != null ? median.toFixed(1) : 'N/A'}</td>
        </tr>
      `;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Group</th><th>Spots</th><th>Avg 10m rate after</th><th>Median Δ kHz</th></tr>
        ${rows}
      </table>
    `;
  }

  return {
    buildAnalysisContext,
    renderUnworkedRateTable,
    renderTimeToFirstQsoTable,
    renderSpotUpliftTable,
    renderSpottingFunnelTable,
    renderBandChangeEfficiencyTable,
    renderSpotterReliabilityTable,
    hasConcurrentBands,
    renderMissedMultTable,
    renderOpenCloseTable,
    renderPileupWindowTable,
    renderFrequencyAgilityTable
  };
}
