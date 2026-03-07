export function createSpotsChartsRuntime(deps = {}) {
  const {
    normalizeBandToken,
    escapeHtml,
    escapeAttr,
    formatBandLabel,
    formatDateSh6,
    formatNumberSh6,
    bandClass,
    sortBands
  } = deps;

  function normalizeBandTokenSafe(value) {
    if (typeof normalizeBandToken === 'function') return normalizeBandToken(value);
    return String(value || '').trim().toUpperCase();
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

  function formatDateSafe(value) {
    if (typeof formatDateSh6 === 'function') return formatDateSh6(value);
    return String(value == null ? '' : value);
  }

  function formatNumberSafe(value) {
    if (typeof formatNumberSh6 === 'function') return formatNumberSh6(value);
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString('en-US') : '0';
  }

  function bandClassSafe(value) {
    if (typeof bandClass === 'function') return bandClass(value);
    return '';
  }

  function sortBandsSafe(values) {
    if (typeof sortBands === 'function') return sortBands(values);
    return (values || []).slice().sort();
  }

  function buildTenMinuteSeries(context = {}) {
    const derived = context.derived || null;
    const qsos = Array.isArray(context.qsos) ? context.qsos : [];
    const bandFilter = Array.isArray(context.bandFilter) ? context.bandFilter : [];
    const bandSet = new Set(bandFilter);
    if (!bandSet.size) {
      return (derived?.tenMinuteSeries || []).map((point) => ({ ts: point.bucket * 600000, qsos: point.qsos }));
    }
    const map = new Map();
    qsos.forEach((qso) => {
      if (!Number.isFinite(qso?.ts)) return;
      const band = normalizeBandTokenSafe(qso.band || '') || 'unknown';
      if (!bandSet.has(band)) return;
      const bucket = Math.floor(qso.ts / (60000 * 10));
      map.set(bucket, (map.get(bucket) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, count]) => ({ ts: bucket * 600000, qsos: count }));
  }

  function renderSpotRateTimeline(context = {}) {
    const derived = context.derived || null;
    const qsos = Array.isArray(context.qsos) ? context.qsos : [];
    const bandFilter = Array.isArray(context.bandFilter) ? context.bandFilter : [];
    const spots = Array.isArray(context.spots) ? context.spots : [];
    const series = buildTenMinuteSeries({ derived, qsos, bandFilter });
    if (!series.length) return '<p>No QSO rate data.</p>';
    const min = Math.min(...series.map((entry) => entry.ts));
    const max = Math.max(...series.map((entry) => entry.ts));
    const maxRate = Math.max(...series.map((entry) => entry.qsos), 1);
    const width = 900;
    const height = 320;
    const margin = { left: 70, right: 20, top: 20, bottom: 55 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const xScale = (ts) => margin.left + ((ts - min) / (max - min || 1)) * plotW;
    const yScale = (value) => margin.top + (1 - (value / maxRate)) * plotH;
    let prevTs = null;
    const line = series.map((entry, idx) => {
      const x = xScale(entry.ts);
      const y = yScale(entry.qsos);
      const jump = prevTs != null && (entry.ts - prevTs) > 600000;
      const cmd = idx === 0 || jump ? 'M' : 'L';
      prevTs = entry.ts;
      return `${cmd} ${x} ${y}`;
    }).join(' ');
    const xTicks = 5;
    const xGrid = [];
    const xLabels = [];
    for (let i = 0; i < xTicks; i += 1) {
      const ts = min + ((max - min) * i) / (xTicks - 1 || 1);
      const x = xScale(ts);
      xGrid.push(`<line class="freq-grid" x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}"></line>`);
      const label = formatDateSafe(ts);
      xLabels.push(`<text class="freq-axis-text" x="${x}" y="${height - margin.bottom + 18}" transform="rotate(-35 ${x} ${height - margin.bottom + 18})" text-anchor="end">${escapeHtmlSafe(label)}</text>`);
    }
    const yTicks = 5;
    const yGrid = [];
    const yLabels = [];
    for (let i = 0; i < yTicks; i += 1) {
      const value = (maxRate * i) / (yTicks - 1 || 1);
      const y = yScale(value);
      yGrid.push(`<line class="freq-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>`);
      yLabels.push(`<text class="freq-axis-text" x="${margin.left - 8}" y="${y + 4}" text-anchor="end">${escapeHtmlSafe(value.toFixed(0))}</text>`);
    }
    let spotLines = '';
    let spotAgg = '';
    if (spots.length <= 500) {
      spotLines = spots.map((spot) => {
        const x = xScale(spot.ts);
        return `<line class="spot-line" x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}"></line>`;
      }).join('');
    } else {
      const bucketCounts = new Map();
      spots.forEach((spot) => {
        if (!Number.isFinite(spot?.ts)) return;
        const bucket = Math.floor(spot.ts / 600000) * 600000;
        bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
      });
      const maxBucket = Math.max(...Array.from(bucketCounts.values()), 1);
      const aggHeight = plotH * 0.25;
      spotAgg = Array.from(bucketCounts.entries()).map(([bucket, count]) => {
        const x = xScale(bucket);
        const h = (count / maxBucket) * aggHeight;
        return `<rect class="spot-agg" x="${x - 1}" y="${height - margin.bottom - h}" width="2" height="${h}"></rect>`;
      }).join('');
    }
    return `
      <div class="freq-scatter-wrap">
        <svg class="freq-scatter" viewBox="0 0 ${width} ${height}" role="img" aria-label="10 minute rate timeline">
          <rect class="freq-plot-bg" x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}"></rect>
          ${xGrid.join('')}
          ${yGrid.join('')}
          ${spotLines}
          ${spotAgg}
          <path class="spot-rate-line" d="${line}"></path>
          <line class="freq-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
          <line class="freq-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
          ${xLabels.join('')}
          ${yLabels.join('')}
          <text class="freq-axis-title" x="${width / 2}" y="${height - 8}" text-anchor="middle">Time (UTC)</text>
          <text class="freq-axis-title" x="14" y="${height / 2}" transform="rotate(-90 14 ${height / 2})" text-anchor="middle">10 min QSO rate</text>
        </svg>
      </div>
    `;
  }

  function renderHeatmap(context = {}) {
    const heatmapData = Array.isArray(context.heatmapData) ? context.heatmapData : [];
    const heatmapHours = Array.isArray(context.heatmapHours) ? context.heatmapHours : [];
    const drillBand = context.drillBand || '';
    const drillHour = Number.isFinite(Number(context.drillHour)) ? Number(context.drillHour) : null;
    const slotAttr = context.slotAttr || 'A';
    const sourceAttr = context.sourceAttr || 'spots';
    if (!heatmapData.length) return '<p>No heatmap data.</p>';
    const visibleHours = heatmapHours.length ? heatmapHours : Array.from({ length: 24 }, (_, h) => h);
    const bands = sortBandsSafe(heatmapData.map((entry) => entry.band));
    const maxVal = Math.max(
      1,
      ...heatmapData.flatMap((entry) => visibleHours.map((hour) => Number(entry?.hours?.[hour] || 0)))
    );
    const header = visibleHours.map((hour) => `<th>${String(hour).padStart(2, '0')}</th>`).join('');
    const rows = bands.map((band, idx) => {
      const entry = heatmapData.find((item) => item.band === band);
      const hours = entry ? entry.hours : [];
      const cells = visibleHours.map((hour) => {
        const count = Number(hours[hour] || 0);
        const active = drillBand === band && drillHour === hour;
        const intensity = count ? Math.min(0.85, 0.15 + (count / maxVal) * 0.7) : 0;
        const bg = count ? `background: rgba(30, 91, 214, ${intensity}); color: #fff;` : '';
        if (!count) return `<td style="${bg}"></td>`;
        return `
          <td style="${bg}">
            <button type="button" class="spots-heat-cell${active ? ' active' : ''}" data-slot="${slotAttr}" data-source="${sourceAttr}" data-band="${escapeAttrSafe(band)}" data-hour="${hour}" title="Show ${formatNumberSafe(count)} spots on ${escapeAttrSafe(formatBandLabelSafe(band || ''))} at ${String(hour).padStart(2, '0')}Z">${formatNumberSafe(count)}</button>
          </td>
        `;
      }).join('');
      const cls = idx % 2 === 0 ? 'td1' : 'td0';
      return `<tr class="${cls}"><td class="${bandClassSafe(band)}"><b>${escapeHtmlSafe(formatBandLabelSafe(band))}</b></td>${cells}</tr>`;
    }).join('');
    return `
      <table class="mtc" style="margin-top:5px;margin-bottom:10px;text-align:right;">
        <tr class="thc"><th>Band</th>${header}</tr>
        ${rows}
      </table>
    `;
  }

  return {
    buildTenMinuteSeries,
    renderSpotRateTimeline,
    renderHeatmap
  };
}
