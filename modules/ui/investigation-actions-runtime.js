export function createInvestigationActionsRuntime(deps = {}) {
  const {
    getState,
    getActiveReportId,
    createAgentBriefingState,
    createCompetitorCoachState,
    normalizeCoachScopeType,
    triggerCompetitorCoachRefresh,
    setActiveReportById,
    getAgentBriefingActionById,
    handleAgentBriefingAction,
    showOverlayNotice,
    trackEvent,
    loadCqApiHistoryArchiveToSlot,
    buildCoachRowKey,
    renderCurrentReportWithLoading,
    renderActiveReport,
    normalizeCall
  } = deps;

  function getStateSafe() {
    return typeof getState === 'function' ? getState() : null;
  }

  function getActiveReportIdSafe() {
    return typeof getActiveReportId === 'function' ? String(getActiveReportId() || '') : '';
  }

  function normalizeCallSafe(value) {
    if (typeof normalizeCall === 'function') return normalizeCall(value);
    return String(value || '').trim().toUpperCase();
  }

  function normalizeCoachScopeTypeSafe(value) {
    if (typeof normalizeCoachScopeType === 'function') return normalizeCoachScopeType(value);
    return String(value || '').trim().toLowerCase();
  }

  function triggerCompetitorCoachRefreshSafe(force) {
    if (typeof triggerCompetitorCoachRefresh === 'function') {
      return triggerCompetitorCoachRefresh(force);
    }
    return Promise.resolve();
  }

  function showOverlayNoticeSafe(message, durationMs) {
    if (typeof showOverlayNotice === 'function') showOverlayNotice(message, durationMs);
  }

  function trackEventSafe(name, payload) {
    if (typeof trackEvent === 'function') trackEvent(name, payload || {});
  }

  function renderCurrentReportWithLoadingSafe() {
    if (typeof renderCurrentReportWithLoading === 'function') renderCurrentReportWithLoading();
  }

  function renderActiveReportSafe() {
    if (typeof renderActiveReport === 'function') renderActiveReport();
  }

  function bindAgentBriefingActions() {
    const state = getStateSafe();
    const navButtons = document.querySelectorAll('.agent-action-btn[data-report]');
    const actionButtons = document.querySelectorAll('.agent-action-btn[data-agent-action-id]');
    const refreshButtons = document.querySelectorAll('.agent-refresh-btn[data-agent-refresh]');

    navButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const target = String(btn.dataset.report || '').trim();
        if (!target) return;
        if (typeof setActiveReportById === 'function') setActiveReportById(target);
      });
    });

    actionButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const actionId = String(btn.dataset.agentActionId || '').trim();
        if (!actionId || typeof getAgentBriefingActionById !== 'function') return;
        const action = getAgentBriefingActionById(actionId);
        if (typeof handleAgentBriefingAction === 'function') handleAgentBriefingAction(action);
      });
    });

    refreshButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (!state) return;
        state.agentBriefing = typeof createAgentBriefingState === 'function'
          ? createAgentBriefingState()
          : { status: 'idle', result: null };
        renderCurrentReportWithLoadingSafe();
      });
    });
  }

  function bindCompetitorCoachActions() {
    const state = getStateSafe();
    if (!state) return;

    const scopeButtons = document.querySelectorAll('.coach-scope-btn');
    const categoryButtons = document.querySelectorAll('.coach-category-btn');
    const navButtons = document.querySelectorAll('.coach-brief-nav');

    const setActiveChoice = (buttons, predicate) => {
      buttons.forEach((btn) => {
        const active = Boolean(predicate(btn));
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    const syncCoachControls = () => {
      state.competitorCoach = state.competitorCoach || (typeof createCompetitorCoachState === 'function'
        ? createCompetitorCoachState()
        : { scopeType: 'continent', categoryMode: 'same' });
      const activeScope = Array.from(scopeButtons).find((btn) => btn.classList.contains('active'));
      const activeCategory = Array.from(categoryButtons).find((btn) => btn.classList.contains('active'));
      if (activeScope) state.competitorCoach.scopeType = normalizeCoachScopeTypeSafe(activeScope.dataset.scope || '');
      if (activeCategory) state.competitorCoach.categoryMode = activeCategory.dataset.categoryMode === 'all' ? 'all' : 'same';
    };

    scopeButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (btn.disabled) return;
        const nextScope = btn.dataset.scope || '';
        setActiveChoice(scopeButtons, (item) => item.dataset.scope === nextScope);
        syncCoachControls();
        triggerCompetitorCoachRefreshSafe(true);
      });
    });

    categoryButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (btn.disabled) return;
        const nextMode = btn.dataset.categoryMode || 'same';
        setActiveChoice(categoryButtons, (item) => (item.dataset.categoryMode || 'same') === nextMode);
        syncCoachControls();
        triggerCompetitorCoachRefreshSafe(true);
      });
    });

    navButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const target = String(btn.dataset.report || '').trim();
        if (!target) return;
        if (typeof setActiveReportById === 'function') setActiveReportById(target);
      });
    });

    if (state.competitorCoach?.status === 'idle') {
      triggerCompetitorCoachRefreshSafe(false);
    }
  }

  function bindCqApiLoadButtons() {
    const state = getStateSafe();
    if (!state) return;

    const cqApiLoadButtons = document.querySelectorAll('.cqapi-load-btn');
    cqApiLoadButtons.forEach((btn) => {
      btn.addEventListener('click', async (evt) => {
        evt.preventDefault();
        if (btn.disabled) return;
        const slotId = String(btn.dataset.slot || '').toUpperCase();
        const year = Number(btn.dataset.year);
        const callsign = normalizeCallSafe(btn.dataset.callsign || '');
        const contestId = String(btn.dataset.contest || '').trim().toUpperCase();
        const mode = String(btn.dataset.mode || '').trim().toLowerCase();
        if (!slotId || !Number.isFinite(year) || !callsign || !contestId || !mode) {
          showOverlayNoticeSafe('Missing CQ API load details for this row.', 2500);
          return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.classList.add('is-loading');
        btn.textContent = '...';

        trackEventSafe('cqapi_compare_load_click', {
          slot: slotId,
          callsign,
          contest: contestId,
          mode,
          year
        });

        try {
          const result = await loadCqApiHistoryArchiveToSlot({
            slotId,
            callsign,
            contestId,
            mode,
            year
          });
          if (btn.classList.contains('coach-load-btn')) {
            const rowKey = String(btn.dataset.rowKey || '').trim()
              || (typeof buildCoachRowKey === 'function' ? buildCoachRowKey({ callsign, year, contestId, mode }) : '');
            if (rowKey) {
              const coach = state.competitorCoach || (typeof createCompetitorCoachState === 'function' ? createCompetitorCoachState() : {});
              const nextLoadedSlots = { ...(coach.loadedSlotRows || {}) };
              nextLoadedSlots[slotId] = rowKey;
              state.competitorCoach = {
                ...coach,
                loadedSlotRows: nextLoadedSlots,
                lastLoadedSlot: slotId,
                lastLoadedRowKey: rowKey
              };
            }
          }
          btn.classList.remove('is-loading');
          btn.classList.add('is-ok');
          btn.textContent = 'OK';
          showOverlayNoticeSafe(`Loaded ${callsign} ${contestId} ${year} into Log ${slotId}.`, 2200);
          trackEventSafe('cqapi_compare_load_success', {
            slot: slotId,
            callsign,
            contest: contestId,
            mode,
            year,
            path: result?.path || ''
          });
          if (btn.classList.contains('coach-load-btn') && getActiveReportIdSafe() === 'competitor_coach') {
            renderActiveReportSafe();
            return;
          }
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('is-ok');
            btn.disabled = false;
          }, 900);
        } catch (err) {
          const message = err && err.message ? err.message : 'Unable to load archive log';
          btn.classList.remove('is-loading');
          btn.classList.add('is-error');
          btn.textContent = 'ERR';
          showOverlayNoticeSafe(message, 3200);
          trackEventSafe('cqapi_compare_load_error', {
            slot: slotId,
            callsign,
            contest: contestId,
            mode,
            year,
            message
          });
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('is-error');
            btn.disabled = false;
          }, 1100);
        }
      });
    });
  }

  function bindInvestigationActions(reportId) {
    bindCqApiLoadButtons();
    if (reportId === 'agent_briefing') bindAgentBriefingActions();
    if (reportId === 'competitor_coach') bindCompetitorCoachActions();
  }

  return {
    bindInvestigationActions
  };
}
