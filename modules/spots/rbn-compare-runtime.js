export function createRbnCompareRuntime(deps = {}) {
  const {
    getDom,
    getState,
    getActiveCompareSlots,
    setActiveReportById,
    updateDataStatus,
    bindSpotControls,
    scheduleRbnCompareIndexBuild,
    normalizeSpotterBase,
    normalizeBandToken,
    scheduleRbnCompareSignalDraw,
    copyRbnSignalCardImage,
    getCanvasZoomKey,
    clearCanvasZoom,
    bindDragZoomOnCanvas,
    populateRbnCompareSignalSpotterSelects
  } = deps;

  let resizeObserver = null;
  let resizeRaf = 0;
  let intersectionObserver = null;

  function getWindowSafe() {
    return typeof window !== 'undefined' ? window : globalThis;
  }

  function getDomSafe() {
    return getDom?.() || {};
  }

  function getStateSafe() {
    return getState?.() || {};
  }

  function getActiveCompareSlotsSafe() {
    return Array.isArray(getActiveCompareSlots?.()) ? getActiveCompareSlots() : [];
  }

  function setActiveReportByIdSafe(reportId, options = {}) {
    if (typeof setActiveReportById === 'function') setActiveReportById(reportId, options);
  }

  function updateDataStatusSafe() {
    if (typeof updateDataStatus === 'function') updateDataStatus();
  }

  function bindSpotControlsSafe(source) {
    if (typeof bindSpotControls === 'function') bindSpotControls(source);
  }

  function scheduleRbnCompareIndexBuildSafe(slotId, slot) {
    if (typeof scheduleRbnCompareIndexBuild === 'function') scheduleRbnCompareIndexBuild(slotId, slot);
  }

  function normalizeSpotterBaseSafe(value) {
    if (typeof normalizeSpotterBase === 'function') return normalizeSpotterBase(value);
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/-\d+$/, '');
  }

  function normalizeBandTokenSafe(value) {
    if (typeof normalizeBandToken === 'function') return normalizeBandToken(value);
    return String(value || '').trim().toUpperCase();
  }

  function scheduleRbnCompareSignalDrawSafe() {
    if (typeof scheduleRbnCompareSignalDraw === 'function') scheduleRbnCompareSignalDraw();
  }

  function copyRbnSignalCardImageSafe(button) {
    if (typeof copyRbnSignalCardImage === 'function') return copyRbnSignalCardImage(button);
    return undefined;
  }

  function getCanvasZoomKeySafe(canvas, chartType = 'rbn', bandKey = '') {
    if (typeof getCanvasZoomKey === 'function') return getCanvasZoomKey(canvas, chartType, bandKey);
    return '';
  }

  function clearCanvasZoomSafe(chartType, key, onZoomChanged) {
    if (typeof clearCanvasZoom === 'function') clearCanvasZoom(chartType, key, onZoomChanged);
  }

  function bindDragZoomOnCanvasSafe(canvas, options = {}) {
    if (typeof bindDragZoomOnCanvas === 'function') bindDragZoomOnCanvas(canvas, options);
  }

  function populateRbnCompareSignalSpotterSelectsSafe() {
    if (typeof populateRbnCompareSignalSpotterSelects === 'function') populateRbnCompareSignalSpotterSelects();
  }

  function ensureRbnCompareSignalState() {
    const state = getStateSafe();
    state.rbnCompareSignal = state.rbnCompareSignal && typeof state.rbnCompareSignal === 'object'
      ? state.rbnCompareSignal
      : { selectedByContinent: {} };
    if (!state.rbnCompareSignal.selectedByContinent || typeof state.rbnCompareSignal.selectedByContinent !== 'object') {
      state.rbnCompareSignal.selectedByContinent = {};
    }
    return state.rbnCompareSignal;
  }

  function teardown() {
    const win = getWindowSafe();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    if (resizeRaf && typeof win.cancelAnimationFrame === 'function') {
      win.cancelAnimationFrame(resizeRaf);
    }
    resizeRaf = 0;
  }

  function teardownIfInactive(reportId) {
    if (reportId !== 'rbn_compare_signal') teardown();
  }

  function bindRbnCompareSignalReport(reportId) {
    if (reportId !== 'rbn_compare_signal') return false;
    const dom = getDomSafe();
    const state = getStateSafe();
    dom.rbnStatusRow?.classList?.remove('hidden');
    updateDataStatusSafe();
    bindSpotControlsSafe('rbn');
    getActiveCompareSlotsSafe()
      .filter((entry) => entry.slot?.qsoData && entry.slot?.derived)
      .forEach((entry) => {
        if (entry.slot?.rbnState?.status === 'ready') scheduleRbnCompareIndexBuildSafe(entry.id, entry.slot);
      });

    const root = dom.viewContainer instanceof HTMLElement ? dom.viewContainer : null;
    if (!(root instanceof HTMLElement)) return true;

    root.querySelectorAll('.rbn-coach-nav').forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const target = String(btn.dataset.report || 'competitor_coach').trim();
        if (!target) return;
        setActiveReportByIdSafe(target, { silent: true });
      });
    });

    root.querySelectorAll('.rbn-signal-select').forEach((select) => {
      select.addEventListener('change', () => {
        const store = ensureRbnCompareSignalState();
        const cont = String(select.dataset.continent || '').trim().toUpperCase() || 'N/A';
        const value = normalizeSpotterBaseSafe(String(select.value || '').trim());
        store.selectedByContinent[cont] = value;
        const canvas = select.closest('.rbn-signal-card')?.querySelector('.rbn-signal-canvas');
        if (canvas) canvas.dataset.spotter = value;
        scheduleRbnCompareSignalDrawSafe();
      });
    });

    root.querySelectorAll('.rbn-signal-copy-btn').forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        copyRbnSignalCardImageSafe(btn);
      });
    });

    root.querySelectorAll('.rbn-signal-reset-btn').forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const canvas = btn.closest('.rbn-signal-card')?.querySelector('.rbn-signal-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const bandKey = normalizeBandTokenSafe(state.globalBandFilter || '');
        const key = getCanvasZoomKeySafe(canvas, 'rbn', bandKey);
        clearCanvasZoomSafe('rbn', key, scheduleRbnCompareSignalDrawSafe);
        canvas.dataset.rbnDrawKey = '';
      });
    });

    teardown();
    const win = getWindowSafe();
    const grid = root.querySelector('.rbn-signal-grid');
    if (grid && typeof win.ResizeObserver === 'function') {
      const schedule = () => {
        if (resizeRaf) return;
        resizeRaf = win.requestAnimationFrame(() => {
          resizeRaf = 0;
          scheduleRbnCompareSignalDrawSafe();
        });
      };
      resizeObserver = new win.ResizeObserver(schedule);
      resizeObserver.observe(grid);
    }

    const canvases = Array.from(root.querySelectorAll('.rbn-signal-canvas'));
    canvases.forEach((canvas) => {
      if (canvas instanceof HTMLCanvasElement) canvas.dataset.rbnVisible = '0';
    });
    canvases.forEach((canvas) => {
      bindDragZoomOnCanvasSafe(canvas, {
        chartType: 'rbn',
        getBandKey: () => normalizeBandTokenSafe(state.globalBandFilter || ''),
        onZoomChanged: scheduleRbnCompareSignalDrawSafe
      });
    });

    if (typeof win.IntersectionObserver === 'function') {
      intersectionObserver = new win.IntersectionObserver((entries) => {
        let touched = false;
        entries.forEach((entry) => {
          const target = entry.target;
          if (!(target instanceof HTMLCanvasElement)) return;
          if (entry.isIntersecting) {
            target.dataset.rbnVisible = '1';
            touched = true;
          }
        });
        if (touched) scheduleRbnCompareSignalDrawSafe();
      }, { root: null, rootMargin: '240px 0px', threshold: 0.01 });
      canvases.forEach((canvas) => {
        if (canvas instanceof HTMLCanvasElement) intersectionObserver.observe(canvas);
      });
    } else {
      canvases.forEach((canvas) => {
        if (canvas instanceof HTMLCanvasElement) canvas.dataset.rbnVisible = '1';
      });
    }

    populateRbnCompareSignalSpotterSelectsSafe();
    scheduleRbnCompareSignalDrawSafe();
    return true;
  }

  return {
    teardown,
    teardownIfInactive,
    bindRbnCompareSignalReport
  };
}
