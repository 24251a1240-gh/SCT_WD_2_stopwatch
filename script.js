/* ============================================================
   MODERN STOPWATCH — SCRIPT
   Vanilla JS. Accurate timing via performance.now().
   ============================================================ */

(() => {
  'use strict';

  /* ---------- DOM references ---------- */
  const card         = document.getElementById('stopwatchCard');
  const logoRing     = document.getElementById('logoRing');
  const hoursEl      = document.getElementById('hoursDisplay');
  const minutesEl    = document.getElementById('minutesDisplay');
  const secondsEl    = document.getElementById('secondsDisplay');
  const msEl         = document.getElementById('msDisplay');

  const startBtn     = document.getElementById('startBtn');
  const pauseBtn     = document.getElementById('pauseBtn');
  const lapBtn       = document.getElementById('lapBtn');
  const resetBtn     = document.getElementById('resetBtn');

  const statusPill   = document.getElementById('statusPill');
  const statusText   = document.getElementById('statusText');
  const lapCountEl   = document.getElementById('lapCount');

  const lapList      = document.getElementById('lapList');
  const lapEmpty     = document.getElementById('lapEmpty');

  const liveClockEl  = document.getElementById('liveClock');

  /* ---------- Timer state ---------- */
  let elapsedBeforePause = 0;   // ms accumulated across previous run segments
  let startTimestamp = null;    // performance.now() at last (re)start
  let rafId = null;             // requestAnimationFrame handle
  let isRunning = false;
  let hasStarted = false;       // ever started (for lap enabling / status)
  let laps = [];                // { label, totalMs, splitMs }

  /* ---------- Helpers ---------- */

  function pad(num, len = 2) {
    return String(num).padStart(len, '0');
  }

  function getElapsed() {
    if (isRunning) {
      return elapsedBeforePause + (performance.now() - startTimestamp);
    }
    return elapsedBeforePause;
  }

  function formatTime(totalMs) {
    const ms = Math.floor(totalMs % 1000 / 10); // two-digit ms
    const totalSeconds = Math.floor(totalMs / 1000);
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    return { h: pad(h), m: pad(m), s: pad(s), ms: pad(ms) };
  }

  function triggerTick(el) {
    el.classList.remove('tick');
    // Force reflow so animation can restart
    void el.offsetWidth;
    el.classList.add('tick');
  }

  function render() {
    const { h, m, s, ms } = formatTime(getElapsed());

    if (hoursEl.textContent !== h)   { hoursEl.textContent = h; }
    if (minutesEl.textContent !== m) { minutesEl.textContent = m; triggerTick(minutesEl); }
    if (secondsEl.textContent !== s) { secondsEl.textContent = s; triggerTick(secondsEl); }
    msEl.textContent = ms;

    if (isRunning) {
      rafId = requestAnimationFrame(render);
    }
  }

  /* ---------- Status / UI state ---------- */

  function setStatus(state) {
    statusPill.classList.remove('running', 'paused');
    if (state === 'running') {
      statusPill.classList.add('running');
      statusText.textContent = 'Running';
      card.classList.add('is-running');
      logoRing.classList.add('pulse');
    } else if (state === 'paused') {
      statusPill.classList.add('paused');
      statusText.textContent = 'Paused';
      card.classList.remove('is-running');
      logoRing.classList.remove('pulse');
    } else {
      statusText.textContent = 'Stopped';
      card.classList.remove('is-running');
      logoRing.classList.remove('pulse');
    }
  }

  function updateButtonStates() {
    startBtn.disabled = isRunning;                 // disable Start while running
    pauseBtn.disabled = !isRunning;                 // Pause only enabled while running
    lapBtn.disabled   = !isRunning;                 // Lap disabled before/while-not running
    resetBtn.disabled = false;                      // Reset always available
  }

  /* ---------- Ripple effect on buttons ---------- */

  function attachRipple(btn) {
    btn.addEventListener('click', (e) => {
      if (btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
      ripple.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  [startBtn, pauseBtn, lapBtn, resetBtn].forEach(attachRipple);

  /* ---------- Core actions ---------- */

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    hasStarted = true;
    startTimestamp = performance.now();
    setStatus('running');
    updateButtonStates();
    rafId = requestAnimationFrame(render);
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    elapsedBeforePause += performance.now() - startTimestamp;
    startTimestamp = null;
    if (rafId) cancelAnimationFrame(rafId);
    setStatus('paused');
    updateButtonStates();
    render(); // final paint of frozen time
  }

  function resetTimer() {
    isRunning = false;
    hasStarted = false;
    elapsedBeforePause = 0;
    startTimestamp = null;
    if (rafId) cancelAnimationFrame(rafId);
    laps = [];
    renderLaps();
    setStatus('stopped');
    updateButtonStates();
    render();
  }

  function recordLap() {
    if (!isRunning) return;
    const current = getElapsed();
    const previousTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    const split = current - previousTotal;
    laps.push({ index: laps.length + 1, totalMs: current, splitMs: split });
    renderLaps();
  }

  /* ---------- Lap rendering ---------- */

  function renderLaps() {
    lapCountEl.textContent = laps.length;

    if (laps.length === 0) {
      lapList.innerHTML = '';
      lapList.appendChild(lapEmpty);
      return;
    }

    // Determine fastest / slowest split for highlighting
    let fastestIdx = 0, slowestIdx = 0;
    laps.forEach((lap, i) => {
      if (lap.splitMs < laps[fastestIdx].splitMs) fastestIdx = i;
      if (lap.splitMs > laps[slowestIdx].splitMs) slowestIdx = i;
    });

    const showHighlight = laps.length > 1;

    // Newest first
    const itemsHtml = laps.slice().reverse().map((lap, revIdx) => {
      const i = laps.length - 1 - revIdx;
      const { h, m, s, ms } = formatTime(lap.splitMs);
      let cls = 'lap-item';
      if (showHighlight && i === fastestIdx) cls += ' fastest';
      if (showHighlight && i === slowestIdx) cls += ' slowest';
      return `
        <li class="${cls}">
          <span class="lap-name"><span class="lap-number">Lap ${lap.index}</span></span>
          <span class="lap-time">${h}:${m}:${s}:${ms}</span>
        </li>`;
    }).join('');

    lapList.innerHTML = itemsHtml;
  }

  /* ---------- Button wiring ---------- */

  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  lapBtn.addEventListener('click', recordLap);
  resetBtn.addEventListener('click', resetTimer);

  /* ---------- Keyboard shortcuts ---------- */

  document.addEventListener('keydown', (e) => {
    // Avoid interfering with typing in inputs (none here, but future-proof)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        isRunning ? pauseTimer() : startTimer();
        break;
      case 'KeyR':
        e.preventDefault();
        resetTimer();
        break;
      case 'KeyL':
        e.preventDefault();
        recordLap();
        break;
    }
  });

  /* ---------- Live corner clock ---------- */

  function updateLiveClock() {
    const now = new Date();
    const h = pad(now.getHours());
    const m = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    liveClockEl.textContent = `${h}:${m}:${s}`;
  }
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  /* ---------- Initial paint ---------- */

  setStatus('stopped');
  updateButtonStates();
  render();

})();
