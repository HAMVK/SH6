export function createSpotsActionsRuntime(deps = {}) {
  const {
    getDom,
    getState,
    getLoadedCompareSlots,
    getSpotStateBySource,
    getSlotById,
    normalizeCall,
    normalizeBandToken,
    buildSpotWindowKey,
    selectRbnDaysForSlot,
    loadSpotsForSource,
    computeSpotsStats,
    renderActiveReport,
    updateDataStatus,
    bindDragZoomOnCanvas,
    alignSpotsCompareSections
  } = deps;

  function getDomSafe() {
    return getDom?.() || {};
  }

  function getStateSafe() {
    return getState?.() || {};
  }

  function getLoadedCompareSlotsSafe() {
    return Array.isArray(getLoadedCompareSlots?.()) ? getLoadedCompareSlots() : [];
  }

  function getSpotStateBySourceSafe(slot, source) {
    return getSpotStateBySource?.(slot, source) || null;
  }

  function getSlotByIdSafe(slotId) {
    return getSlotById?.(slotId);
  }

  function normalizeCallSafe(value) {
    if (typeof normalizeCall === 'function') return normalizeCall(value);
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function normalizeBandTokenSafe(value) {
    if (typeof normalizeBandToken === 'function') return normalizeBandToken(value);
    return String(value || '').trim().toUpperCase();
  }

  function buildSpotWindowKeySafe(minTs, maxTs) {
    if (typeof buildSpotWindowKey === 'function') return buildSpotWindowKey(minTs, maxTs);
    return `${minTs || 0}-${maxTs || 0}`;
  }

  function selectRbnDaysForSlotSafe(slot, minTs, maxTs) {
    return typeof selectRbnDaysForSlot === 'function' ? selectRbnDaysForSlot(slot, minTs, maxTs) : [];
  }

  function loadSpotsForSourceSafe(slot, source) {
    if (typeof loadSpotsForSource === 'function') return loadSpotsForSource(slot, source);
    return undefined;
  }

  function computeSpotsStatsSafe(slot, spotState) {
    if (typeof computeSpotsStats === 'function') computeSpotsStats(slot, spotState);
  }

  function renderActiveReportSafe() {
    if (typeof renderActiveReport === 'function') renderActiveReport();
  }

  function updateDataStatusSafe() {
    if (typeof updateDataStatus === 'function') updateDataStatus();
  }

  function bindDragZoomOnCanvasSafe(canvas, options) {
    if (typeof bindDragZoomOnCanvas === 'function') bindDragZoomOnCanvas(canvas, options);
  }

  function alignSpotsCompareSectionsSafe(reportId) {
    if (typeof alignSpotsCompareSections === 'function') alignSpotsCompareSections(reportId);
  }

  function getLoadTargets() {
    const state = getStateSafe();
    return state.compareEnabled ? getLoadedCompareSlotsSafe() : [{ id: 'A', slot: state }];
  }

  function bindSpotControls(source) {
    const state = getStateSafe();
    const loadTargets = getLoadTargets();
    loadTargets.forEach((entry) => {
      if (!entry.slot?.derived || !entry.slot?.qsoData) return;
      const spotState = getSpotStateBySourceSafe(entry.slot, source);
      if (!spotState) return;
      const call = normalizeCallSafe(entry.slot?.derived?.contestMeta?.stationCallsign || '');
      const minTs = entry.slot?.derived?.timeRange?.minTs;
      const maxTs = entry.slot?.derived?.timeRange?.maxTs;
      const windowKey = (Number.isFinite(minTs) && Number.isFinite(maxTs)) ? buildSpotWindowKeySafe(minTs, maxTs) : '';
      const days = source === 'rbn' ? selectRbnDaysForSlotSafe(entry.slot, minTs, maxTs) : [];
      const daysKey = source === 'rbn' ? (days || []).join(',') : '';
      const requestKey = source === 'rbn'
        ? `${call}|${windowKey}|${daysKey}`
        : `${call}|${windowKey}`;
      let needs = spotState.status === 'idle';
      if (!needs && call && windowKey) {
        const readyCurrent = spotState.status === 'ready'
          && spotState.lastCall === call
          && spotState.lastWindowKey === windowKey
          && (source !== 'rbn' || String(spotState.lastDaysKey || '') === daysKey);
        const loadingCurrent = spotState.status === 'loading'
          && Boolean(spotState.inflightPromise)
          && String(spotState.inflightKey || '') === requestKey;
        const qrxCurrent = spotState.status === 'qrx'
          && String(spotState.lastErrorKey || '') === requestKey;
        needs = !(readyCurrent || loadingCurrent || qrxCurrent);
      }
      if (needs && spotState.status === 'error' && call && windowKey) {
        const now = Date.now();
        const lastKey = String(spotState.lastErrorKey || '');
        const lastAt = Number(spotState.lastErrorAt || 0);
        if (lastKey === requestKey && (now - lastAt) < 60000) {
          needs = false;
        }
      }
      if (needs) loadSpotsForSourceSafe(entry.slot, source);
    });

    document.querySelectorAll(`.spots-window[data-source="${source}"]:not([data-shared="1"])`).forEach((input) => {
      input.addEventListener('input', () => {
        const slotId = input.dataset.slot || 'A';
        const slot = getSlotByIdSafe(slotId) || state;
        const spotState = getSpotStateBySourceSafe(slot, source);
        if (!spotState) return;
        spotState.windowMinutes = Number(input.value) || 15;
        const valueEl = document.querySelector(`.spots-window-value[data-slot="${slotId}"][data-source="${source}"]`);
        if (valueEl) valueEl.textContent = String(spotState.windowMinutes);
        computeSpotsStatsSafe(slot, spotState);
        renderActiveReportSafe();
      });
    });

    document.querySelectorAll(`.spots-band-filter[data-source="${source}"]:not([data-shared="1"])`).forEach((el) => {
      el.addEventListener('change', () => {
        const slotId = el.dataset.slot || 'A';
        const slot = getSlotByIdSafe(slotId) || state;
        const spotState = getSpotStateBySourceSafe(slot, source);
        if (!spotState) return;
        const band = el.dataset.band || '';
        const current = new Set(spotState.bandFilter || []);
        if (band === 'ALL') {
          if (el.checked) current.clear();
        } else if (el.checked) {
          current.add(band);
        } else {
          current.delete(band);
        }
        spotState.bandFilter = Array.from(current);
        computeSpotsStatsSafe(slot, spotState);
        renderActiveReportSafe();
      });
    });

    document.querySelectorAll(`.spots-heat-cell[data-source="${source}"]`).forEach((cell) => {
      cell.addEventListener('click', (evt) => {
        evt.preventDefault();
        const slotId = cell.dataset.slot || 'A';
        const slot = getSlotByIdSafe(slotId) || state;
        const spotState = getSpotStateBySourceSafe(slot, source);
        if (!spotState) return;
        const band = normalizeBandTokenSafe(cell.dataset.band || '') || '';
        const hour = Number(cell.dataset.hour);
        if (!band || !Number.isFinite(hour)) return;
        spotState.drillBand = band;
        spotState.drillHour = Math.max(0, Math.min(23, Math.round(hour)));
        spotState.drillContinent = '';
        spotState.drillCqZone = '';
        spotState.drillItuZone = '';
        renderActiveReportSafe();
      });
    });

    document.querySelectorAll(`.spots-drill-clear[data-source="${source}"]`).forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const slotId = btn.dataset.slot || 'A';
        const slot = getSlotByIdSafe(slotId) || state;
        const spotState = getSpotStateBySourceSafe(slot, source);
        if (!spotState) return;
        spotState.drillBand = '';
        spotState.drillHour = null;
        spotState.drillContinent = '';
        spotState.drillCqZone = '';
        spotState.drillItuZone = '';
        renderActiveReportSafe();
      });
    });

    document.querySelectorAll(`.spots-drill-filter-btn[data-source="${source}"]`).forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const slotId = btn.dataset.slot || 'A';
        const slot = getSlotByIdSafe(slotId) || state;
        const spotState = getSpotStateBySourceSafe(slot, source);
        if (!spotState) return;
        const type = String(btn.dataset.type || '').trim().toLowerCase();
        const value = String(btn.dataset.value || '').trim().toUpperCase();
        if (type === 'continent') {
          spotState.drillContinent = value;
        } else if (type === 'cq') {
          spotState.drillCqZone = value;
        } else if (type === 'itu') {
          spotState.drillItuZone = value;
        } else {
          return;
        }
        renderActiveReportSafe();
      });
    });

    document.querySelectorAll(`.spots-coach-action[data-source="${source}"]`).forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const targetId = String(btn.dataset.target || '').trim();
        if (!targetId) return;
        const target = document.getElementById(targetId);
        if (!target) return;
        const reduceMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        target.scrollIntoView({
          block: 'start',
          behavior: reduceMotion ? 'auto' : 'smooth'
        });
      });
    });

    document.querySelectorAll(`.spots-window[data-source="${source}"][data-shared="1"]`).forEach((input) => {
      input.addEventListener('input', () => {
        const next = Number(input.value) || 15;
        const valueEl = document.querySelector(`.spots-window-value[data-source="${source}"][data-shared="1"]`);
        if (valueEl) valueEl.textContent = String(next);
        getLoadTargets().forEach((entry) => {
          const spotState = getSpotStateBySourceSafe(entry.slot, source);
          if (!spotState) return;
          spotState.windowMinutes = next;
          computeSpotsStatsSafe(entry.slot, spotState);
        });
        renderActiveReportSafe();
      });
    });

    document.querySelectorAll(`.spots-band-filter[data-source="${source}"][data-shared="1"]`).forEach((el) => {
      el.addEventListener('change', () => {
        const band = el.dataset.band || '';
        getLoadTargets().forEach((entry) => {
          const spotState = getSpotStateBySourceSafe(entry.slot, source);
          if (!spotState) return;
          const current = new Set(spotState.bandFilter || []);
          if (band === 'ALL') {
            if (el.checked) current.clear();
          } else if (el.checked) {
            current.add(band);
          } else {
            current.delete(band);
          }
          spotState.bandFilter = Array.from(current);
          computeSpotsStatsSafe(entry.slot, spotState);
        });
        renderActiveReportSafe();
      });
    });

    if (source === 'rbn') {
      document.querySelectorAll(`.rbn-day-select[data-source="${source}"]`).forEach((select) => {
        select.addEventListener('change', () => {
          const slotId = select.dataset.slot || 'A';
          const scoped = Array.from(document.querySelectorAll(`.rbn-day-select[data-source="${source}"][data-slot="${slotId}"]`));
          const values = scoped.map((item) => item.value).filter(Boolean);
          if (scoped.length === 2 && values.length === 2 && values[0] === values[1]) {
            const options = Array.from(select.options).map((item) => item.value);
            const next = options.find((value) => value !== values[0]);
            if (next) {
              const other = scoped[0] === select ? scoped[1] : scoped[0];
              other.value = next;
            }
          }
          const slot = getSlotByIdSafe(slotId) || state;
          const rbnState = getSpotStateBySourceSafe(slot, 'rbn');
          if (!rbnState) return;
          rbnState.selectedDays = scoped.map((item) => item.value).filter(Boolean).slice(0, 2);
          loadSpotsForSourceSafe(slot, 'rbn');
        });
      });
    }
  }

  function bindSpotReport(reportId) {
    const dom = getDomSafe();
    const state = getStateSafe();
    const source = reportId === 'rbn_spots' ? 'rbn' : reportId === 'spots' ? 'spots' : '';
    if (!source) return false;
    if (source === 'spots') {
      dom.spotsStatusRow?.classList?.remove('hidden');
    } else {
      dom.rbnStatusRow?.classList?.remove('hidden');
    }
    updateDataStatusSafe();
    bindSpotControls(source);
    const canvases = Array.from(dom.viewContainer?.querySelectorAll?.('.spots-signal-canvas') || []);
    canvases.forEach((canvas) => {
      bindDragZoomOnCanvasSafe(canvas, {
        chartType: 'spots',
        getBandKey: () => normalizeBandTokenSafe(state.globalBandFilter || ''),
        onZoomChanged: () => renderActiveReportSafe()
      });
    });
    alignSpotsCompareSectionsSafe(reportId);
    return true;
  }

  return {
    bindSpotControls,
    bindSpotReport
  };
}
