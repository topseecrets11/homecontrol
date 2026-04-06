(function HomeOS() {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================
  var STORAGE_KEY = 'homeOS';
  var FIVE_MINUTES = 5 * 60 * 1000;
  var TWO_HOURS = 2 * 60 * 60 * 1000;

  var MODULE_INFO = {
    ARENA:   { title: 'THE ARENA',   subtitle: 'Business, Sales, Projections' },
    NODE:    { title: 'THE NODE',    subtitle: 'Home Automation, Sentry' },
    SANCTUM: { title: 'THE SANCTUM', subtitle: 'Library, Wellbeing, Resilience' },
    ORACLE:  { title: 'THE ORACLE',  subtitle: 'Forecasting, Trajectories' }
  };

  var VIRGIL_MESSAGES = {
    ARENA: {
      normal:   'Sales Machine online. Monitoring conversion metrics.',
      nudge:    'Energy reserves critical. Step away from the Arena. Now.',
      lockout:  'Arena locked. Intervention protocol engaged. Confirm to proceed.',
      readonly: 'Relapse protocol active. Financial inputs locked. Read-only mode.'
    },
    NODE: {
      normal: 'NODE FEED SECURE. Monitoring perimeter.',
      nudge:  'Fatigue detected. Node monitoring continues autonomously. Rest.'
    },
    SANCTUM: {
      normal: 'Sanctum Protocol active. Focus on Stoic clarity.',
      nudge:  'Fatigue Trigger. Nudging Sanctum Protocol. Focus on Stoic clarity.'
    },
    ORACLE: {
      normal: 'Forecasting Theater initialized. Analyzing trajectories.',
      nudge:  'Low energy state. Oracle projections skewed by fatigue. Rest first.'
    }
  };

  var DEFAULT_STATE = {
    activeModule: 'ARENA',
    resilience: { t1: false, t2: false, t3: false, lockoutUntil: null, t3TimeLimit: 60 },
    wellbeing: { lastCheckIn: null, recovery: 5, vitality: 5, temper: 5 },
    lastActivity: Date.now()
  };

  // ============================================
  // STATE — O(1) localStorage with memory cache
  // ============================================
  var _cache = null;

  function getState() {
    if (_cache) return _cache;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      _cache = raw ? JSON.parse(raw) : null;
    } catch (e) {
      _cache = null;
    }
    return _cache;
  }

  function setState(partial) {
    var current = getState() || deepCopy(DEFAULT_STATE);
    var next = {};
    var keys = Object.keys(current);
    for (var i = 0; i < keys.length; i++) {
      next[keys[i]] = current[keys[i]];
    }
    var pkeys = Object.keys(partial);
    for (var j = 0; j < pkeys.length; j++) {
      var k = pkeys[j];
      if (partial[k] && typeof partial[k] === 'object' && !Array.isArray(partial[k]) && partial[k] !== null) {
        next[k] = mergeObj(current[k] || {}, partial[k]);
      } else {
        next[k] = partial[k];
      }
    }
    _cache = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function initState() {
    if (!getState()) {
      _cache = deepCopy(DEFAULT_STATE);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
    }
  }

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeObj(base, patch) {
    var result = {};
    var bk = Object.keys(base);
    for (var i = 0; i < bk.length; i++) result[bk[i]] = base[bk[i]];
    var pk = Object.keys(patch);
    for (var j = 0; j < pk.length; j++) result[pk[j]] = patch[j];
    // Fix: use patch keys correctly
    for (var m = 0; m < pk.length; m++) result[pk[m]] = patch[pk[m]];
    return result;
  }

  // ============================================
  // DOM HELPERS
  // ============================================
  function h(tag, attrs) {
    var element = document.createElement(tag);
    if (attrs) {
      var ak = Object.keys(attrs);
      for (var i = 0; i < ak.length; i++) {
        var key = ak[i];
        var val = attrs[key];
        if (key === 'className') element.className = val;
        else if (key === 'textContent') element.textContent = val;
        else if (key === 'innerHTML') element.innerHTML = val;
        else if (key.indexOf('on') === 0 && typeof val === 'function') {
          element.addEventListener(key.slice(2).toLowerCase(), val);
        }
        else if (key === 'style' && typeof val === 'object') {
          var sk = Object.keys(val);
          for (var s = 0; s < sk.length; s++) element.style[sk[s]] = val[sk[s]];
        }
        else element.setAttribute(key, val);
      }
    }
    // Append children from arguments[2+]
    for (var c = 2; c < arguments.length; c++) {
      var child = arguments[c];
      if (typeof child === 'string') element.appendChild(document.createTextNode(child));
      else if (child) element.appendChild(child);
    }
    return element;
  }

  function removeById(id) {
    var el = document.getElementById(id);
    if (el) el.parentNode.removeChild(el);
  }

  // ============================================
  // CLOCK
  // ============================================
  function updateClock() {
    var el = document.getElementById('live-clock');
    if (!el) return;
    var now = new Date();
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    el.textContent =
      (hh < 10 ? '0' : '') + hh + ':' +
      (mm < 10 ? '0' : '') + mm + ':' +
      (ss < 10 ? '0' : '') + ss;
  }

  // ============================================
  // ORIENTATION LOCK
  // ============================================
  function checkOrientation() {
    var lockEl = document.getElementById('portrait-lock');
    var appEl = document.getElementById('homeos-app');
    if (!lockEl || !appEl) return;
    var isPortrait = window.innerHeight > window.innerWidth;
    lockEl.style.display = isPortrait ? 'flex' : 'none';
    if (isPortrait) {
      appEl.classList.add('is-hidden');
    } else {
      appEl.classList.remove('is-hidden');
    }
  }

  // ============================================
  // DAILY MODIFIER
  // ============================================
  function getDailyModifier() {
    var state = getState();
    if (!state || !state.wellbeing) return 0.5;
    var w = state.wellbeing;
    return (w.recovery + w.vitality + w.temper) / 30;
  }

  // ============================================
  // VIRGIL — AI Message Bar
  // ============================================
  function updateVirgil(moduleName) {
    var msgEl = document.getElementById('virgil-msg');
    if (!msgEl) return;
    var state = getState();
    var msgs = VIRGIL_MESSAGES[moduleName] || VIRGIL_MESSAGES.ARENA;
    var mod = getDailyModifier();

    // Priority: T2 lockout > T3 readonly > T1 nudge > normal
    if (moduleName === 'ARENA' && isArenaLocked()) {
      msgEl.textContent = msgs.lockout || msgs.normal;
    } else if (moduleName === 'ARENA' && isT3Active()) {
      msgEl.textContent = msgs.readonly || msgs.normal;
    } else if (state.resilience.t1 && mod < 0.4) {
      msgEl.textContent = msgs.nudge || msgs.normal;
    } else {
      msgEl.textContent = msgs.normal;
    }
  }

  // ============================================
  // MODE INDICATOR
  // ============================================
  function updateModeIndicator() {
    var modeText = document.getElementById('mode-text');
    var modeDot = document.getElementById('mode-dot');
    if (!modeText || !modeDot) return;
    var state = getState();

    if (isT3Active()) {
      modeText.textContent = 'LOCKDOWN MODE';
      modeDot.style.background = '#ff4444';
    } else if (isArenaLocked()) {
      modeText.textContent = 'INTERVENTION MODE';
      modeDot.style.background = '#ff8800';
    } else if (state.resilience.t1 && getDailyModifier() < 0.4) {
      modeText.textContent = 'NUDGE MODE';
      modeDot.style.background = '#ffcc00';
    } else {
      modeText.textContent = 'OPERATIONAL MODE';
      modeDot.style.background = '#32CD32';
    }
  }

  // ============================================
  // LOCKOUT HELPERS
  // ============================================
  function isArenaLocked() {
    var state = getState();
    if (!state.resilience.t2 || !state.resilience.t1) return false;
    var idle = Date.now() - (state.lastActivity || Date.now());
    return idle > TWO_HOURS;
  }

  function isT3Active() {
    var state = getState();
    if (!state.resilience.t3 || !state.resilience.lockoutUntil) return false;
    return Date.now() < state.resilience.lockoutUntil;
  }

  // ============================================
  // MODULE ROUTER — Full mount/unmount
  // ============================================
  function navigateTo(moduleName) {
    var viewport = document.getElementById('viewport');
    if (!viewport) return;

    // Remove any existing lockout overlay
    removeById('arena-lockout-overlay');

    // If navigating to ARENA and it's locked, show lockout instead
    if (moduleName === 'ARENA' && isArenaLocked()) {
      // Still update nav visually
      updateNavButtons(moduleName);
      setState({ activeModule: moduleName });
      mountArenaLockout();
      updateVirgil(moduleName);
      updateModeIndicator();
      return;
    }

    // UNMOUNT: clear viewport completely (true DOM removal)
    while (viewport.firstChild) {
      viewport.removeChild(viewport.firstChild);
    }

    // MOUNT: create new module content
    var info = MODULE_INFO[moduleName];
    var headerRow = h('div', { className: 'module-header-row' },
      h('h1', { className: 'module-title', textContent: info.title }),
      h('span', { className: 'module-subtitle', textContent: '(' + info.subtitle + ')' })
    );

    // Add T3 read-only badge for ARENA
    if (moduleName === 'ARENA' && isT3Active()) {
      headerRow.appendChild(
        h('span', { className: 'module-readonly-badge', 'data-testid': 'readonly-badge' }, 'READ-ONLY')
      );
    }

    var body = h('div', { className: 'module-body' },
      h('p', { className: 'module-placeholder-text', textContent: moduleName + ' MODULE \u2014 AWAITING CONFIGURATION' })
    );

    var container = h('div', {
      className: 'module-container',
      'data-testid': 'module-' + moduleName.toLowerCase()
    }, headerRow, body);

    viewport.appendChild(container);

    // Update state
    setState({ activeModule: moduleName, lastActivity: Date.now() });

    // Update UI
    updateNavButtons(moduleName);
    updateVirgil(moduleName);
    updateModeIndicator();
  }

  function updateNavButtons(activeModule) {
    var buttons = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var mod = btn.getAttribute('data-module');
      var isActive = mod === activeModule;
      if (isActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      var sub = btn.querySelector('.nav-sub');
      if (sub) sub.textContent = isActive ? 'Active' : '';
    }
  }

  // ============================================
  // WELLBEING ENGINE
  // ============================================
  function shouldShowWellbeing() {
    var state = getState();
    if (!state || !state.wellbeing || !state.wellbeing.lastCheckIn) return true;
    var last = new Date(state.wellbeing.lastCheckIn);
    var now = new Date();
    // Different day = show
    if (last.toDateString() !== now.toDateString()) return true;
    // Same day but > 5 min since last check = show
    if (now.getTime() - last.getTime() > FIVE_MINUTES) return true;
    return false;
  }

  function mountWellbeingOverlay() {
    removeById('wellbeing-overlay');
    var state = getState();
    var vals = {
      recovery: state.wellbeing.recovery || 5,
      vitality: state.wellbeing.vitality || 5,
      temper: state.wellbeing.temper || 5
    };

    function makeSlider(key, label, sub) {
      var valEl = h('span', {
        className: 'wb-label-val',
        textContent: String(vals[key]),
        'data-testid': 'wb-val-' + key
      });

      var fillEl = h('div', { className: 'wb-slider-fill' });
      fillEl.style.width = ((vals[key] - 1) / 9 * 100) + '%';

      var rangeInput = h('input', {
        type: 'range',
        className: 'wb-range',
        min: '1',
        max: '10',
        value: String(vals[key]),
        'data-testid': 'wb-slider-' + key
      });

      rangeInput.addEventListener('input', function() {
        var v = parseInt(this.value, 10);
        vals[key] = v;
        valEl.textContent = String(v);
        fillEl.style.width = ((v - 1) / 9 * 100) + '%';
      });

      var trackWrap = h('div', { className: 'wb-slider-track' }, fillEl, rangeInput);

      var scaleEl = h('div', { className: 'wb-scale' });
      var scaleNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      for (var i = 0; i < scaleNums.length; i++) {
        scaleEl.appendChild(h('span', { textContent: String(scaleNums[i]) }));
      }

      return h('div', { className: 'wb-slider-group', 'data-testid': 'wb-group-' + key },
        h('div', { className: 'wb-label-row' },
          h('div', { className: 'wb-label-left' },
            h('span', { className: 'wb-label-name', textContent: label }),
            h('span', { className: 'wb-label-sub', textContent: sub })
          ),
          valEl
        ),
        trackWrap,
        scaleEl
      );
    }

    var submitBtn = h('button', {
      className: 'wb-submit-btn',
      textContent: 'SUBMIT CHECK-IN',
      'data-testid': 'wb-submit-btn',
      onClick: function() {
        setState({
          wellbeing: {
            lastCheckIn: new Date().toISOString(),
            recovery: vals.recovery,
            vitality: vals.vitality,
            temper: vals.temper
          }
        });
        removeById('wellbeing-overlay');
        // Refresh state-dependent UI
        var s = getState();
        updateVirgil(s.activeModule);
        updateModeIndicator();
      }
    });

    var dismissBtn = h('button', {
      className: 'wb-dismiss',
      textContent: 'SKIP FOR NOW',
      'data-testid': 'wb-dismiss-btn',
      onClick: function() {
        // Save current defaults as check-in to avoid re-prompting
        setState({
          wellbeing: {
            lastCheckIn: new Date().toISOString(),
            recovery: vals.recovery,
            vitality: vals.vitality,
            temper: vals.temper
          }
        });
        removeById('wellbeing-overlay');
        var s = getState();
        updateVirgil(s.activeModule);
        updateModeIndicator();
      }
    });

    var overlay = h('div', {
      id: 'wellbeing-overlay',
      className: 'fullscreen-overlay',
      'data-testid': 'wellbeing-overlay'
    },
      h('div', { className: 'wb-container' },
        h('div', { className: 'wb-header' },
          h('h1', { className: 'wb-title', textContent: 'Wellbeing Check-in' }),
          h('p', { className: 'wb-subtitle', textContent: 'Rate your current state to calibrate operations' })
        ),
        h('div', { className: 'wb-sliders' },
          makeSlider('recovery', 'RECOVERY', 'Sleep Quality'),
          makeSlider('vitality', 'VITALITY', 'Energy Levels'),
          makeSlider('temper', 'TEMPER', 'Mood')
        ),
        submitBtn,
        dismissBtn
      )
    );

    document.getElementById('homeos-app').appendChild(overlay);
  }

  // ============================================
  // ARENA LOCKOUT OVERLAY (T2)
  // ============================================
  function mountArenaLockout() {
    removeById('arena-lockout-overlay');

    var unlockBtn = h('button', {
      className: 'lockout-unlock-btn',
      textContent: 'CONFIRM UNLOCK \u2014 RETURN TO ARENA',
      'data-testid': 'lockout-unlock-btn',
      onClick: function() {
        setState({ lastActivity: Date.now() });
        removeById('arena-lockout-overlay');
        navigateTo('ARENA');
      }
    });

    var overlay = h('div', {
      id: 'arena-lockout-overlay',
      className: 'fullscreen-overlay',
      'data-testid': 'arena-lockout-overlay'
    },
      h('div', { className: 'lockout-content' },
        h('div', { className: 'lockout-icon', textContent: '\u26A0' }),
        h('h1', { className: 'lockout-title', textContent: 'ARENA LOCKED' }),
        h('p', { className: 'lockout-msg', textContent: 'Intervention Protocol T2 has locked THE ARENA due to extended inactivity under low energy conditions. You have been idle for over 2 hours with T1 Nudge active. Confirm your intent to unlock and return to operations.' }),
        unlockBtn
      )
    );

    document.getElementById('homeos-app').appendChild(overlay);
  }

  // ============================================
  // SETTINGS PANEL
  // ============================================
  function mountSettings() {
    removeById('settings-panel');
    var state = getState();

    function makeToggle(key, label, desc, checked, isDisabled) {
      var input = h('input', { type: 'checkbox', 'data-testid': 'toggle-' + key });
      input.checked = checked;
      input.addEventListener('change', function() {
        var s = getState();
        var res = deepCopy(s.resilience);
        res[key] = this.checked;
        // If T1 off, force T2 off
        if (key === 't1' && !this.checked) {
          res.t2 = false;
        }
        setState({ resilience: res });
        mountSettings(); // Re-render settings
      });

      var toggleLabel = h('label', { className: 'toggle-wrap' }, input, h('span', { className: 'toggle-track' }));

      var row = h('div', {
        className: 'setting-row' + (isDisabled ? ' disabled' : ''),
        'data-testid': 'setting-row-' + key
      },
        h('div', { className: 'setting-info' },
          h('span', { className: 'setting-label', textContent: label }),
          h('span', { className: 'setting-desc', textContent: desc })
        ),
        toggleLabel
      );
      return row;
    }

    var t1Row = makeToggle('t1', 'T1 \u2014 NUDGE', 'Blunt VIRGIL prompts when energy is low', state.resilience.t1, false);
    var t2Row = makeToggle('t2', 'T2 \u2014 INTERVENTION', 'Lock Arena after 2hr idle under T1', state.resilience.t2, !state.resilience.t1);
    var t3Row = makeToggle('t3', 'T3 \u2014 RELAPSE', 'Set time limit. Financial inputs become READ-ONLY', state.resilience.t3, false);

    var settingsRows = h('div', { className: 'settings-rows' }, t1Row, t2Row, t3Row);

    // T3 time config
    if (state.resilience.t3) {
      var isLockActive = state.resilience.lockoutUntil && Date.now() < state.resilience.lockoutUntil;
      var remaining = isLockActive ? Math.ceil((state.resilience.lockoutUntil - Date.now()) / 60000) : 0;

      var timeInput = h('input', {
        type: 'number',
        className: 't3-input',
        min: '1',
        max: '480',
        value: String(state.resilience.t3TimeLimit || 60),
        'data-testid': 't3-time-input'
      });

      var activateBtn = h('button', {
        className: 't3-activate-btn' + (isLockActive ? ' is-active' : ''),
        textContent: isLockActive ? 'ACTIVE' : 'ACTIVATE',
        'data-testid': 't3-activate-btn',
        onClick: function() {
          if (isLockActive) return;
          var mins = parseInt(timeInput.value, 10) || 60;
          var until = Date.now() + mins * 60 * 1000;
          var s = getState();
          setState({ resilience: mergeObj(s.resilience, { t3TimeLimit: mins, lockoutUntil: until }) });
          mountSettings();
          updateModeIndicator();
          updateVirgil(getState().activeModule);
          // Re-navigate to refresh module view
          navigateTo(getState().activeModule);
        }
      });

      var configRow = h('div', { className: 't3-config-row', 'data-testid': 't3-config-row' },
        h('label', { textContent: 'Duration (min):' }),
        timeInput,
        activateBtn
      );
      settingsRows.appendChild(configRow);

      if (isLockActive) {
        var statusEl = h('div', {
          className: 't3-status active-status',
          textContent: 'T3 ACTIVE \u2014 ' + remaining + ' min remaining',
          'data-testid': 't3-status'
        });
        settingsRows.appendChild(statusEl);
      }
    }

    // Buttons
    var checkinBtn = h('button', {
      className: 'settings-action-btn',
      textContent: 'WELLBEING CHECK-IN',
      'data-testid': 'manual-checkin-btn',
      onClick: function() {
        removeById('settings-panel');
        mountWellbeingOverlay();
      }
    });

    var closeBtn = h('button', {
      className: 'settings-close-btn',
      textContent: 'CLOSE',
      'data-testid': 'settings-close-btn',
      onClick: function() {
        removeById('settings-panel');
        updateModeIndicator();
        updateVirgil(getState().activeModule);
      }
    });

    var panel = h('div', {
      id: 'settings-panel',
      className: 'fullscreen-overlay',
      'data-testid': 'settings-panel'
    },
      h('div', { className: 'settings-container' },
        h('h1', { className: 'settings-title', textContent: 'LOCKOUT PROTOCOL' }),
        h('p', { className: 'settings-subtitle', textContent: 'Configure resilience triggers' }),
        settingsRows,
        h('div', { className: 'settings-actions' }, checkinBtn, closeBtn)
      )
    );

    document.getElementById('homeos-app').appendChild(panel);
  }

  // ============================================
  // ACTIVITY TRACKING
  // ============================================
  var _activityTimer = null;

  function onActivity() {
    if (_activityTimer) return;
    _activityTimer = setTimeout(function() {
      setState({ lastActivity: Date.now() });
      _activityTimer = null;
    }, 15000); // Debounce: write at most every 15s
  }

  function setupActivityTracking() {
    document.addEventListener('mousemove', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity, { passive: true });
    document.addEventListener('click', function() {
      setState({ lastActivity: Date.now() });
    });
    document.addEventListener('touchstart', onActivity, { passive: true });
  }

  // ============================================
  // PERIODIC CHECKS
  // ============================================
  function runPeriodicChecks() {
    var state = getState();
    if (!state) return;

    // T3: Check if lockout expired
    if (state.resilience.t3 && state.resilience.lockoutUntil) {
      if (Date.now() >= state.resilience.lockoutUntil) {
        setState({ resilience: mergeObj(state.resilience, { lockoutUntil: null }) });
        // If on ARENA, refresh to remove readonly badge
        if (state.activeModule === 'ARENA') {
          navigateTo('ARENA');
        }
      }
    }

    updateModeIndicator();
    updateVirgil(state.activeModule);
  }

  // ============================================
  // NAVIGATION SETUP
  // ============================================
  function setupNav() {
    var buttons = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < buttons.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var mod = this.getAttribute('data-module');
          if (mod) navigateTo(mod);
        });
      })(buttons[i]);
    }

    var settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', mountSettings);
    }
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    initState();

    // Orientation lock
    checkOrientation();
    window.addEventListener('resize', checkOrientation);

    // Live clock
    updateClock();
    setInterval(updateClock, 1000);

    // Navigation
    setupNav();

    // Activity tracking
    setupActivityTracking();

    // Navigate to saved module
    var state = getState();
    navigateTo(state.activeModule);

    // Wellbeing check (after module is rendered so overlay goes on top)
    if (shouldShowWellbeing()) {
      mountWellbeingOverlay();
    }

    // Periodic checks every 60s
    setInterval(runPeriodicChecks, 60000);

    // Update mode indicator on init
    updateModeIndicator();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
