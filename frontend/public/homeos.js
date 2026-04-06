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

  var FUNNEL_EVENT_POOL = [
    { type: 'FRONT-END SALE', detail: 'NICHE_B_TEMPLATE', amount: '$47.00' },
    { type: 'LEAD CAPTURED', detail: 'GOOGLE_ADS \u2014 niche_a_funnel', amount: null },
    { type: 'CART ABANDON', detail: 'STRIPE_CHECKOUT', amount: '$197.00' },
    { type: 'UPSELL ACCEPTED', detail: 'NICHE_C_BUNDLE', amount: '$97.00' },
    { type: 'LEAD CAPTURED', detail: 'ORGANIC \u2014 blog_seo_post', amount: null },
    { type: 'FRONT-END SALE', detail: 'NICHE_A_COURSE', amount: '$27.00' },
    { type: 'SUBSCRIPTION RENEWED', detail: 'NICHE_B_SAAS', amount: '$29.00/mo' },
    { type: 'HIGH-TIER SALE', detail: 'NICHE_A_MENTORSHIP', amount: '$497.00' },
    { type: 'TRIAL SIGNUP', detail: 'NICHE_A_PLATFORM \u2014 free_tier', amount: null },
    { type: 'REFUND PROCESSED', detail: 'STRIPE', amount: '-$47.00' },
    { type: 'LEAD CAPTURED', detail: 'TWITTER_ADS \u2014 niche_b_webinar', amount: null },
    { type: 'FRONT-END SALE', detail: 'NICHE_C_EBOOK', amount: '$19.00' },
    { type: 'UPSELL DECLINED', detail: 'NICHE_B_PREMIUM', amount: '$197.00' },
    { type: 'CART ABANDON', detail: 'PAYPAL', amount: '$97.00' },
    { type: 'LEAD CAPTURED', detail: 'REFERRAL \u2014 partner_link', amount: null }
  ];

  var DEFAULT_STATE = {
    activeModule: 'ARENA',
    resilience: { t1: false, t2: false, t3: false, lockoutUntil: null, t3TimeLimit: 60 },
    wellbeing: { lastCheckIn: null, recovery: 5, vitality: 5, temper: 5 },
    lastActivity: Date.now(),
    activeTheme: '#32CD32',
    arena: {
      leadVelocity: 42,
      conversionEfficiency: 2.4,
      customerLTV: 34.50,
      monthlyNetProfit: 4200,
      targetMonthly: 15000,
      growthData: [1200, 1800, 2400, 3100, 3800, 4200, 5400, 6800, 8200, 10100, 11800, 13500]
    },
    products: [
      { id: 'P1', name: 'Prompt Pack v2', price: 29.00, sales: 142, revenue: 4118 },
      { id: 'P2', name: 'Niche Starter Guide', price: 49.00, sales: 85, revenue: 4165 }
    ],
    transactions: [
      { tx: 'tx_98A2', time: '14:02', product: 'Prompt Pack v2', amount: 29.00, status: 'paid', source: 'Meta Ads', customer: 'usr_881' },
      { tx: 'tx_98A3', time: '14:15', product: 'Niche Starter Guide', amount: 49.00, status: 'paid', source: 'Organic Email', customer: 'usr_224' },
      { tx: 'tx_98A4', time: '14:45', product: 'Prompt Pack v2', amount: 29.00, status: 'abandoned', source: 'Meta Ads', customer: 'usr_993' }
    ],
    environment: {
      climate: { location: 'Strathdale, VIC', tempOut: 22, tempIn: 24, humidity: 45 },
      devices: [
        { id: 'g1', name: 'Genio Main Light', type: 'light', state: 'on' },
        { id: 'g2', name: 'Genio Desk Light', type: 'light', state: 'off' },
        { id: 'g3', name: 'Genio Powerboard (Bench)', type: 'power', state: 'on' }
      ],
      sentry: [
        { id: 'cam1', name: 'UNIDEN SOLO PRO - FRONT', status: 'standby', battery: '84%', lastEvent: '14:02 - Motion Detected' }
      ]
    },
    config: {
      hetznerIp: '',
      stripeKey: '',
      tuyaId: ''
    },
    sanctum: {
      dailyChecklist: { deepWork: false, zone2: false, hardStop: false, lastReset: null },
      library: [
        { id: 'L1', title: 'Meditations, Book V', author: 'Marcus Aurelius', text: 'At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work \u2014 as a human being. What do I have to complain of, if I am going to do what I was born for \u2014 the things I was brought into the world to do? Or is this what I was created for? To huddle under the blankets and stay warm? But it is nicer here... So you were born to feel nice? Instead of doing things and experiencing them? Do you not see the plants, the birds, the ants and spiders and bees going about their individual tasks, putting the world in order, as best they can? And you are not willing to do your job as a human being?' },
        { id: 'L2', title: 'Letters from a Stoic, Letter I', author: 'Seneca', text: 'It is not that we have a short time to live, but that we waste a great deal of it. Life is long enough, and a sufficiently generous amount has been given to us for the highest achievements if it were all well invested. But when it is wasted in heedless luxury and spent on no good activity, we are forced at last by death\u2019s final constraint to realize that it has passed away before we knew it was passing.' },
        { id: 'L3', title: 'The Obstacle Is The Way', author: 'Ryan Holiday', text: 'The impediment to action advances action. What stands in the way becomes the way. In every situation, life is asking us a question, and our actions are the answer. Our job is simply to answer well. There is no good or bad without us, there is only perception. There is the event itself and the story we tell ourselves about what it means.' },
        { id: 'L4', title: 'Discourses, Book I', author: 'Epictetus', text: 'No man is free who is not master of himself. Freedom is the only worthy goal in life. It is won by disregarding things that lie beyond our control. We cannot choose our external circumstances, but we can always choose how we respond to them. Make the best use of what is in your power, and take the rest as it happens.' }
      ],
      activeEntry: null
    },
    oracle: {
      adSpend: 1000,
      convRate: 2.0,
      ltv: 50
    }
  };

  // ============================================
  // STATE \u2014 O(1) localStorage with memory cache
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
    var state = getState();
    if (!state) {
      _cache = deepCopy(DEFAULT_STATE);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
    } else {
      // Migrate: add missing fields
      var changed = false;
      if (!state.arena) { state.arena = deepCopy(DEFAULT_STATE.arena); changed = true; }
      if (!state.products) { state.products = deepCopy(DEFAULT_STATE.products); changed = true; }
      if (!state.transactions) { state.transactions = deepCopy(DEFAULT_STATE.transactions); changed = true; }
      if (!state.environment) { state.environment = deepCopy(DEFAULT_STATE.environment); changed = true; }
      if (!state.activeTheme) { state.activeTheme = '#32CD32'; changed = true; }
      if (!state.config) { state.config = deepCopy(DEFAULT_STATE.config); changed = true; }
      if (!state.sanctum) { state.sanctum = deepCopy(DEFAULT_STATE.sanctum); changed = true; }
      if (!state.oracle) { state.oracle = deepCopy(DEFAULT_STATE.oracle); changed = true; }
      if (changed) {
        _cache = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
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
  // THEME ENGINE
  // ============================================

  function hexToDim(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * 0.12);
    g = Math.round(g * 0.12);
    b = Math.round(b * 0.12);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function getAccent() {
    var state = getState();
    return (state && state.activeTheme) ? state.activeTheme : '#32CD32';
  }

  function applyTheme(hex) {
    var root = document.documentElement;
    root.style.setProperty('--theme-accent', hex);
    root.style.setProperty('--theme-accent-dim', hexToDim(hex));
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
  // VIRGIL \u2014 AI Message Bar
  // ============================================
  function updateVirgil(moduleName) {
    var msgEl = document.getElementById('virgil-msg');
    if (!msgEl) return;
    var state = getState();
    var msgs = VIRGIL_MESSAGES[moduleName] || VIRGIL_MESSAGES.ARENA;
    var mod = getDailyModifier();

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
      modeDot.style.background = getAccent();
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
  // ARENA MODULE \u2014 Cleanup
  // ============================================
  var _funnelInterval = null;

  function cleanupArena() {
    if (_funnelInterval) {
      clearInterval(_funnelInterval);
      _funnelInterval = null;
    }
  }

  // ============================================
  // NODE MODULE \u2014 Cleanup
  // ============================================
  var _sentryTimeout = null;

  function cleanupNode() {
    if (_sentryTimeout) {
      clearTimeout(_sentryTimeout);
      _sentryTimeout = null;
    }
  }

  // ============================================
  // SANCTUM — Intervention Mode
  // ============================================
  var _interventionMode = false;
  var _savedThemeBeforeIntervention = null;

  function cleanupSanctum() {
    if (_interventionMode) {
      _interventionMode = false;
      document.body.classList.remove('intervention-mode');
      if (_savedThemeBeforeIntervention) {
        applyTheme(_savedThemeBeforeIntervention);
      }
      _savedThemeBeforeIntervention = null;
    }
  }

  function enterInterventionMode() {
    if (!_interventionMode) {
      _savedThemeBeforeIntervention = getAccent();
      _interventionMode = true;
    }
    document.body.classList.add('intervention-mode');
    applyTheme('#d4af37');
  }

  function exitInterventionMode() {
    if (_interventionMode) {
      _interventionMode = false;
      document.body.classList.remove('intervention-mode');
      applyTheme(_savedThemeBeforeIntervention || getAccent());
      _savedThemeBeforeIntervention = null;
    }
  }

  // ============================================
  // MODULE ROUTER \u2014 Full mount/unmount
  // ============================================
  function navigateTo(moduleName) {
    var viewport = document.getElementById('viewport');
    if (!viewport) return;

    // Cleanup previous module
    cleanupArena();
    cleanupNode();
    cleanupSanctum();

    // Remove any lockout overlay
    removeById('arena-lockout-overlay');

    // If ARENA locked, show lockout
    if (moduleName === 'ARENA' && isArenaLocked()) {
      updateNavButtons(moduleName);
      setState({ activeModule: moduleName });
      mountArenaLockout();
      updateVirgil(moduleName);
      updateModeIndicator();
      return;
    }

    // UNMOUNT: destroy all children
    while (viewport.firstChild) {
      viewport.removeChild(viewport.firstChild);
    }

    // MOUNT: module-specific content
    if (moduleName === 'ARENA') {
      viewport.appendChild(mountArenaModule());
    } else if (moduleName === 'NODE') {
      viewport.appendChild(mountNodeModule());
    } else if (moduleName === 'SANCTUM') {
      viewport.appendChild(mountSanctumModule());
    } else if (moduleName === 'ORACLE') {
      viewport.appendChild(mountOracleModule());
    }

    // Update state & UI
    setState({ activeModule: moduleName, lastActivity: Date.now() });
    updateNavButtons(moduleName);
    updateVirgil(moduleName);
    updateModeIndicator();
  }


  // ============================================
  // THE NODE — Physical Environment & Sentry
  // ============================================
  function mountNodeModule() {
    var state = getState();
    var env = state.environment || deepCopy(DEFAULT_STATE.environment);
    var climate = env.climate;
    var devices = env.devices;
    var sentry = env.sentry;

    // Header
    var headerRow = h('div', { className: 'module-header-row' },
      h('h1', { className: 'module-title', textContent: 'THE NODE' }),
      h('span', { className: 'module-subtitle', textContent: '(Physical Environment & Sentry)' })
    );

    // === LEFT COLUMN: Climate ===
    var climateCol = h('div', { className: 'node-col node-col-climate', 'data-testid': 'node-climate-col' },
      h('div', { className: 'node-section-title' }, 'CLIMATE'),
      h('div', { className: 'climate-card' },
        h('div', { className: 'climate-location', 'data-testid': 'climate-location' }, climate.location),
        h('div', { className: 'climate-row' },
          h('div', { className: 'climate-metric' },
            h('span', { className: 'climate-label' }, 'OUTSIDE'),
            h('span', { className: 'climate-val', 'data-testid': 'climate-temp-out' }, climate.tempOut + '\u00B0C')
          ),
          h('div', { className: 'climate-metric' },
            h('span', { className: 'climate-label' }, 'INSIDE'),
            h('span', { className: 'climate-val climate-val-accent', 'data-testid': 'climate-temp-in' }, climate.tempIn + '\u00B0C')
          )
        ),
        h('div', { className: 'climate-metric climate-metric-full' },
          h('span', { className: 'climate-label' }, 'HUMIDITY'),
          h('span', { className: 'climate-val', 'data-testid': 'climate-humidity' }, climate.humidity + '%')
        )
      ),
      h('div', { className: 'node-section-title node-section-gap' }, 'NETWORK'),
      h('div', { className: 'climate-card' },
        h('div', { className: 'climate-metric climate-metric-full' },
          h('span', { className: 'climate-label' }, 'STATUS'),
          h('span', { className: 'climate-val climate-val-accent', 'data-testid': 'network-status' }, 'ONLINE')
        ),
        h('div', { className: 'climate-metric climate-metric-full' },
          h('span', { className: 'climate-label' }, 'LATENCY'),
          h('span', { className: 'climate-val', 'data-testid': 'network-latency' }, '12ms')
        )
      )
    );

    // === CENTER COLUMN: Genio Matrix ===
    var matrixGrid = h('div', { className: 'genio-grid', 'data-testid': 'genio-device-grid' });

    for (var i = 0; i < devices.length; i++) {
      (function(idx) {
        var dev = devices[idx];
        var isOn = dev.state === 'on';

        var stateLabel = h('span', {
          className: 'genio-state ' + (isOn ? 'genio-on' : 'genio-off'),
          'data-testid': 'genio-state-' + dev.id
        }, isOn ? 'ON' : 'OFF');

        var dot = h('span', { className: 'genio-dot ' + (isOn ? 'genio-dot-on' : '') });

        var typeIcon = dev.type === 'light' ? '\u2600' : '\u26A1';

        var card = h('div', {
          className: 'genio-card ' + (isOn ? 'genio-card-on' : ''),
          'data-testid': 'genio-card-' + dev.id,
          onClick: function() {
            var s = getState();
            var envCopy = deepCopy(s.environment);
            var d = envCopy.devices[idx];
            d.state = d.state === 'on' ? 'off' : 'on';
            setState({ environment: envCopy });

            // Update DOM
            var nowOn = d.state === 'on';
            card.classList.toggle('genio-card-on', nowOn);
            stateLabel.className = 'genio-state ' + (nowOn ? 'genio-on' : 'genio-off');
            stateLabel.textContent = nowOn ? 'ON' : 'OFF';
            dot.className = 'genio-dot ' + (nowOn ? 'genio-dot-on' : '');
          }
        },
          h('div', { className: 'genio-card-top' },
            h('span', { className: 'genio-icon' }, typeIcon),
            dot
          ),
          h('div', { className: 'genio-name', 'data-testid': 'genio-name-' + dev.id }, dev.name),
          h('div', { className: 'genio-card-bottom' },
            h('span', { className: 'genio-type' }, dev.type.toUpperCase()),
            stateLabel
          )
        );
        matrixGrid.appendChild(card);
      })(i);
    }

    var matrixCol = h('div', { className: 'node-col node-col-matrix', 'data-testid': 'node-matrix-col' },
      h('div', { className: 'node-section-title' }, 'GENIO MATRIX'),
      matrixGrid
    );

    // === RIGHT COLUMN: Sentry ===
    var cam = sentry[0];
    var battNum = parseInt(cam.battery, 10);
    var battOk = battNum > 20;

    var wakeBtnText = h('span', { 'data-testid': 'wake-btn-text' }, '[ WAKE FEED ]');
    var wakeCursor = h('span', { className: 'ai-cursor wake-cursor', style: { display: 'none' } });

    var wakeBtn = h('button', {
      className: 'sentry-wake-btn',
      'data-testid': 'sentry-wake-btn',
      onClick: function() {
        if (_sentryTimeout) return; // Already connecting
        wakeBtnText.textContent = 'CONNECTING TO RTSP...';
        wakeCursor.style.display = 'inline-block';
        wakeBtn.classList.add('sentry-connecting');
        _sentryTimeout = setTimeout(function() {
          wakeBtnText.textContent = '[ WAKE FEED ]';
          wakeCursor.style.display = 'none';
          wakeBtn.classList.remove('sentry-connecting');
          _sentryTimeout = null;
        }, 3000);
      }
    }, wakeBtnText, wakeCursor);

    var sentryCol = h('div', { className: 'node-col node-col-sentry', 'data-testid': 'node-sentry-col' },
      h('div', { className: 'node-section-title' }, 'SENTRY SYSTEM'),
      h('div', { className: 'sentry-card', 'data-testid': 'sentry-card-' + cam.id },
        h('div', { className: 'sentry-status-row' },
          h('span', { className: 'sentry-status-dot sentry-standby' }),
          h('span', { className: 'sentry-status-text', 'data-testid': 'sentry-status' }, cam.status.toUpperCase())
        ),
        h('div', { className: 'sentry-name', 'data-testid': 'sentry-cam-name' }, cam.name),
        h('div', { className: 'sentry-details' },
          h('div', { className: 'sentry-detail-row' },
            h('span', { className: 'sentry-detail-label' }, 'BATTERY'),
            h('span', {
              className: 'sentry-detail-val ' + (battOk ? 'sentry-batt-ok' : 'sentry-batt-low'),
              'data-testid': 'sentry-battery'
            }, cam.battery)
          ),
          h('div', { className: 'sentry-detail-row' },
            h('span', { className: 'sentry-detail-label' }, 'LAST EVENT'),
            h('span', { className: 'sentry-detail-val', 'data-testid': 'sentry-last-event' }, cam.lastEvent)
          )
        ),
        wakeBtn
      )
    );

    // 3-column grid
    var nodeGrid = h('div', { className: 'node-grid', 'data-testid': 'node-grid' },
      climateCol, matrixCol, sentryCol
    );

    return h('div', {
      className: 'module-container node-module',
      'data-testid': 'module-node'
    }, headerRow, nodeGrid);
  }


  // ============================================
  // THE SANCTUM — Recovery & Reading
  // ============================================
  function mountSanctumModule() {
    var state = getState();
    var sanctum = state.sanctum || deepCopy(DEFAULT_STATE.sanctum);

    // Auto-reset daily checklist
    var today = new Date().toDateString();
    if (sanctum.dailyChecklist.lastReset !== today) {
      sanctum.dailyChecklist = { deepWork: false, zone2: false, hardStop: false, lastReset: today };
      setState({ sanctum: sanctum });
    }

    var headerRow = h('div', { className: 'module-header-row' },
      h('h1', { className: 'module-title', textContent: 'THE SANCTUM' }),
      h('span', { className: 'module-subtitle', textContent: '(Recovery & Reading)' })
    );

    var libraryTab = h('button', {
      className: 'arena-tab active',
      textContent: 'LIBRARY',
      'data-testid': 'sanctum-tab-library'
    });
    var resilienceTab = h('button', {
      className: 'arena-tab',
      textContent: 'RESILIENCE',
      'data-testid': 'sanctum-tab-resilience'
    });
    var subNav = h('div', { className: 'arena-subnav', 'data-testid': 'sanctum-subnav' }, libraryTab, resilienceTab);
    var contentArea = h('div', { className: 'arena-content-area', 'data-testid': 'sanctum-content-area' });

    function switchSub(view) {
      exitInterventionMode();
      while (contentArea.firstChild) contentArea.removeChild(contentArea.firstChild);
      libraryTab.classList.toggle('active', view === 'library');
      resilienceTab.classList.toggle('active', view === 'resilience');
      if (view === 'library') {
        contentArea.appendChild(mountLibrary(sanctum));
      } else {
        contentArea.appendChild(mountResilience(sanctum));
      }
    }

    libraryTab.addEventListener('click', function() { switchSub('library'); });
    resilienceTab.addEventListener('click', function() { switchSub('resilience'); });

    switchSub('library');

    return h('div', {
      className: 'module-container sanctum-module',
      'data-testid': 'module-sanctum'
    }, headerRow, subNav, contentArea);
  }

  function mountLibrary(sanctum) {
    var library = sanctum.library || DEFAULT_STATE.sanctum.library;
    var readingPane = h('div', { className: 'library-reading-pane', 'data-testid': 'library-reading-pane' });

    var placeholder = h('div', { className: 'library-placeholder', 'data-testid': 'library-placeholder' },
      h('p', { className: 'library-placeholder-text', textContent: 'SELECT A TEXT FROM THE CATALOG' })
    );
    readingPane.appendChild(placeholder);

    function openEntry(entry) {
      while (readingPane.firstChild) readingPane.removeChild(readingPane.firstChild);
      enterInterventionMode();

      var closeBtn = h('button', {
        className: 'library-close-btn',
        textContent: 'CLOSE TEXT',
        'data-testid': 'library-close-btn',
        onClick: function() {
          exitInterventionMode();
          while (readingPane.firstChild) readingPane.removeChild(readingPane.firstChild);
          readingPane.appendChild(placeholder);
        }
      });

      var textView = h('div', { className: 'library-text-view', 'data-testid': 'library-text-view' },
        h('div', { className: 'library-text-header' },
          h('h2', { className: 'library-text-title', textContent: entry.title }),
          h('span', { className: 'library-text-author', textContent: entry.author })
        ),
        h('div', { className: 'library-text-body', 'data-testid': 'library-text-body' },
          h('p', { className: 'library-passage', textContent: entry.text })
        ),
        closeBtn
      );
      readingPane.appendChild(textView);
    }

    var catalogList = h('div', { className: 'library-catalog-list', 'data-testid': 'library-catalog-list' });
    for (var i = 0; i < library.length; i++) {
      (function(entry) {
        var card = h('div', {
          className: 'library-catalog-card',
          'data-testid': 'library-card-' + entry.id,
          onClick: function() { openEntry(entry); }
        },
          h('span', { className: 'library-card-title', textContent: entry.title }),
          h('span', { className: 'library-card-author', textContent: entry.author })
        );
        catalogList.appendChild(card);
      })(library[i]);
    }

    var catalogCol = h('div', { className: 'library-catalog', 'data-testid': 'library-catalog' },
      h('div', { className: 'node-section-title' }, 'CATALOG'),
      catalogList
    );

    return h('div', { className: 'library-grid', 'data-testid': 'library-grid' },
      catalogCol, readingPane
    );
  }

  function mountResilience(sanctum) {
    var checklist = sanctum.dailyChecklist;

    var items = [
      { key: 'deepWork', label: '90m DEEP WORK', desc: 'Uninterrupted focus block. No notifications. No context switching.' },
      { key: 'zone2', label: 'ZONE 2 TRAINING', desc: 'Sustained low-intensity cardio. Heart rate 120\u2013140 BPM.' },
      { key: 'hardStop', label: '19:00 HARD-STOP', desc: 'All screens off. No work past 7 PM. Non-negotiable boundary.' }
    ];

    var listEl = h('div', { className: 'resilience-list', 'data-testid': 'resilience-list' });
    var doneCount = 0;

    for (var i = 0; i < items.length; i++) {
      (function(item) {
        var isChecked = checklist[item.key];
        if (isChecked) doneCount++;

        var checkEl = h('div', {
          className: 'resilience-check' + (isChecked ? ' checked' : ''),
          'data-testid': 'resilience-check-' + item.key
        }, isChecked ? '\u2713' : '');

        var row = h('div', {
          className: 'resilience-item' + (isChecked ? ' completed' : ''),
          'data-testid': 'resilience-item-' + item.key,
          onClick: function() {
            var s = getState();
            var sc = deepCopy(s.sanctum);
            sc.dailyChecklist[item.key] = !sc.dailyChecklist[item.key];
            setState({ sanctum: sc });
            var nowChecked = sc.dailyChecklist[item.key];
            row.classList.toggle('completed', nowChecked);
            checkEl.classList.toggle('checked', nowChecked);
            checkEl.textContent = nowChecked ? '\u2713' : '';
            // Update progress
            var cnt = (sc.dailyChecklist.deepWork ? 1 : 0) + (sc.dailyChecklist.zone2 ? 1 : 0) + (sc.dailyChecklist.hardStop ? 1 : 0);
            progressVal.textContent = cnt + ' / 3';
          }
        },
          checkEl,
          h('div', { className: 'resilience-item-info' },
            h('span', { className: 'resilience-item-label', textContent: item.label }),
            h('span', { className: 'resilience-item-desc', textContent: item.desc })
          )
        );
        listEl.appendChild(row);
      })(items[i]);
    }

    var progressVal = h('span', { className: 'resilience-progress-val', 'data-testid': 'resilience-progress-val', textContent: doneCount + ' / 3' });
    var progressRow = h('div', { className: 'resilience-progress', 'data-testid': 'resilience-progress' },
      h('span', { className: 'resilience-progress-label', textContent: 'DAILY COMPLIANCE' }),
      progressVal
    );

    return h('div', { className: 'resilience-container', 'data-testid': 'resilience-container' },
      h('div', { className: 'node-section-title' }, 'DAILY NON-NEGOTIABLES'),
      listEl,
      progressRow
    );
  }

  // ============================================
  // THE ORACLE — Forecasting Theater
  // ============================================
  function mountOracleModule() {
    var state = getState();
    var oracle = state.oracle || deepCopy(DEFAULT_STATE.oracle);

    var headerRow = h('div', { className: 'module-header-row' },
      h('h1', { className: 'module-title', textContent: 'THE ORACLE' }),
      h('span', { className: 'module-subtitle', textContent: '(Forecasting Theater)' })
    );

    function calcRevenue(adSpend, convRate, ltv) {
      return (adSpend / 0.50) * (convRate / 100) * ltv;
    }

    var revenue = calcRevenue(oracle.adSpend, oracle.convRate, oracle.ltv);
    var heroVal = h('span', {
      className: 'oracle-hero-value',
      'data-testid': 'oracle-hero-value',
      textContent: '$' + Math.round(revenue).toLocaleString()
    });
    var heroDisplay = h('div', { className: 'oracle-hero', 'data-testid': 'oracle-hero' },
      h('span', { className: 'oracle-hero-label', textContent: 'ESTIMATED MONTHLY REVENUE' }),
      heroVal
    );

    var svgWrap = h('div', { className: 'oracle-chart-wrap', 'data-testid': 'oracle-chart-wrap' });

    function updateChart() {
      var baseRevenue = calcRevenue(oracle.adSpend, oracle.convRate, oracle.ltv);
      var data = [];
      for (var i = 0; i < 12; i++) {
        var factor = 0.3 + 0.7 * Math.pow(i / 11, 0.7);
        data.push(Math.round(baseRevenue * factor));
      }
      while (svgWrap.firstChild) svgWrap.removeChild(svgWrap.firstChild);
      svgWrap.appendChild(createOracleSVG(data));
      heroVal.textContent = '$' + Math.round(baseRevenue).toLocaleString();
      setState({ oracle: { adSpend: oracle.adSpend, convRate: oracle.convRate, ltv: oracle.ltv } });
    }

    function makeOracleSlider(key, label, min, max, step, prefix, suffix, testId) {
      var val = oracle[key];
      var valDisplay = h('span', { className: 'oracle-slider-val', 'data-testid': testId + '-val' },
        prefix + (key === 'convRate' ? val.toFixed(1) : String(Math.round(val))) + suffix
      );
      var rangeInput = h('input', {
        type: 'range',
        className: 'oracle-range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(val),
        'data-testid': testId + '-slider'
      });
      rangeInput.addEventListener('input', function() {
        var v = parseFloat(this.value);
        oracle[key] = v;
        valDisplay.textContent = prefix + (key === 'convRate' ? v.toFixed(1) : String(Math.round(v))) + suffix;
        updateChart();
      });
      return h('div', { className: 'oracle-slider-group', 'data-testid': testId },
        h('div', { className: 'oracle-slider-header' },
          h('span', { className: 'oracle-slider-label', textContent: label }),
          valDisplay
        ),
        rangeInput
      );
    }

    var controls = h('div', { className: 'oracle-controls', 'data-testid': 'oracle-controls' },
      makeOracleSlider('adSpend', 'AD SPEND', 0, 5000, 50, '$', '', 'oracle-adspend'),
      makeOracleSlider('convRate', 'CONV. RATE', 0.5, 5, 0.1, '', '%', 'oracle-convrate'),
      makeOracleSlider('ltv', 'CUSTOMER LTV', 10, 200, 5, '$', '', 'oracle-ltv')
    );

    updateChart();

    return h('div', {
      className: 'module-container oracle-module',
      'data-testid': 'module-oracle'
    }, headerRow, heroDisplay, svgWrap, controls);
  }

  function createOracleSVG(data) {
    var NS = 'http://www.w3.org/2000/svg';
    var W = 900, H = 300;
    var pad = { top: 24, right: 48, bottom: 36, left: 64 };
    var cw = W - pad.left - pad.right;
    var ch = H - pad.top - pad.bottom;
    var maxY = Math.max.apply(null, data) * 1.15 || 1;

    function svgEl(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      if (attrs) {
        var k = Object.keys(attrs);
        for (var i = 0; i < k.length; i++) el.setAttribute(k[i], attrs[k[i]]);
      }
      return el;
    }

    function toX(i) { return pad.left + (i / (data.length - 1)) * cw; }
    function toY(v) { return pad.top + ch - (v / maxY) * ch; }

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      width: '100%',
      height: '100%'
    });
    svg.style.display = 'block';

    // Grid lines
    var gridSteps = 5;
    for (var g = 0; g <= gridSteps; g++) {
      var yVal = (maxY / gridSteps) * g;
      var yPos = toY(yVal);
      svg.appendChild(svgEl('line', {
        x1: String(pad.left), y1: String(yPos),
        x2: String(W - pad.right), y2: String(yPos),
        stroke: '#1e1e1e', 'stroke-width': '1'
      }));
      var yLabel = svgEl('text', {
        x: String(pad.left - 8), y: String(yPos + 4),
        fill: '#555', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace',
        'text-anchor': 'end'
      });
      var kVal = yVal / 1000;
      yLabel.textContent = '$' + (kVal >= 1 ? kVal.toFixed(1) + 'k' : String(Math.round(yVal)));
      svg.appendChild(yLabel);
    }

    // Area fill
    var areaD = 'M' + toX(0).toFixed(1) + ',' + toY(data[0]).toFixed(1);
    for (var i = 1; i < data.length; i++) {
      areaD += 'L' + toX(i).toFixed(1) + ',' + toY(data[i]).toFixed(1);
    }
    areaD += 'L' + toX(data.length - 1).toFixed(1) + ',' + (pad.top + ch);
    areaD += 'L' + toX(0).toFixed(1) + ',' + (pad.top + ch) + 'Z';
    svg.appendChild(svgEl('path', {
      d: areaD, fill: 'var(--theme-accent)', opacity: '0.1'
    }));

    // Line path
    var lineD = '';
    for (var li = 0; li < data.length; li++) {
      lineD += (li === 0 ? 'M' : 'L') + toX(li).toFixed(1) + ',' + toY(data[li]).toFixed(1);
    }
    svg.appendChild(svgEl('path', {
      d: lineD, fill: 'none', stroke: 'var(--theme-accent)',
      'stroke-width': '2.5', 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    // Data points
    for (var j = 0; j < data.length; j++) {
      svg.appendChild(svgEl('circle', {
        cx: String(toX(j).toFixed(1)), cy: String(toY(data[j]).toFixed(1)),
        r: '3.5', fill: 'var(--theme-accent)'
      }));
    }

    // X labels
    var months = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
    for (var m = 0; m < data.length; m++) {
      var xLabel = svgEl('text', {
        x: String(toX(m).toFixed(1)), y: String(H - 8),
        fill: '#555', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace',
        'text-anchor': 'middle'
      });
      xLabel.textContent = months[m];
      svg.appendChild(xLabel);
    }

    return svg;
  }

  // ============================================
  // THE ARENA \u2014 Sales Machine (Sub-Routed)
  // ============================================
  var _arenaSubView = 'overview';

  function mountArenaModule() {
    var state = getState();
    var arena = state.arena || DEFAULT_STATE.arena;
    var isReadOnly = isT3Active();

    // Header row
    var headerRow = h('div', { className: 'module-header-row' },
      h('h1', { className: 'module-title', textContent: 'THE ARENA' }),
      h('span', { className: 'module-subtitle', textContent: '(Sales Machine)' })
    );
    if (isReadOnly) {
      headerRow.appendChild(h('span', { className: 'module-readonly-badge', 'data-testid': 'readonly-badge' }, 'READ-ONLY'));
    }

    // Sub-navigation
    var overviewTab = h('button', {
      className: 'arena-tab active',
      textContent: 'OVERVIEW',
      'data-testid': 'arena-tab-overview'
    });
    var ledgerTab = h('button', {
      className: 'arena-tab',
      textContent: 'THE LEDGER',
      'data-testid': 'arena-tab-ledger'
    });
    var subNav = h('div', { className: 'arena-subnav', 'data-testid': 'arena-subnav' }, overviewTab, ledgerTab);

    // Content area
    var contentArea = h('div', { className: 'arena-content-area', 'data-testid': 'arena-content-area' });

    function switchSub(view) {
      _arenaSubView = view;
      cleanupArena();
      while (contentArea.firstChild) contentArea.removeChild(contentArea.firstChild);
      overviewTab.classList.toggle('active', view === 'overview');
      ledgerTab.classList.toggle('active', view === 'ledger');
      if (view === 'overview') {
        contentArea.appendChild(mountArenaOverview(arena));
      } else {
        contentArea.appendChild(mountArenaLedger());
      }
    }

    overviewTab.addEventListener('click', function() { switchSub('overview'); });
    ledgerTab.addEventListener('click', function() { switchSub('ledger'); });

    // Mount default sub-view
    switchSub('overview');

    return h('div', {
      className: 'module-container arena-module',
      'data-testid': 'module-arena'
    }, headerRow, subNav, contentArea);
  }

  // ============================================
  // ARENA: OVERVIEW Sub-View
  // ============================================
  function mountArenaOverview(arena) {
    var isExpanded = false;

    // KPI Cards
    var card1 = createKPICard('LEAD VELOCITY', String(arena.leadVelocity), 'leads', 'lead-velocity');
    var card2 = createKPICard('CONVERSION EFFICIENCY', arena.conversionEfficiency.toFixed(1) + '%', '', 'conversion-eff');
    var card3 = createKPICard('CUSTOMER LTV', '$' + arena.customerLTV.toFixed(2), '', 'customer-ltv');

    // Card 4: expandable
    var card4ValueEl = h('span', { className: 'kpi-value', 'data-testid': 'kpi-val-net-profit' },
      '$' + arena.monthlyNetProfit.toLocaleString()
    );
    var card4ExpandIcon = h('span', { className: 'kpi-expand-icon', 'data-testid': 'kpi-expand-icon' }, '\u25BC');
    var card4Header = h('div', { className: 'kpi-card-inner' },
      h('div', { className: 'kpi-top-row' },
        h('span', { className: 'kpi-title', textContent: 'MONTHLY NET PROFIT' }),
        card4ExpandIcon
      ),
      card4ValueEl
    );

    var nebulaContainer = h('div', { className: 'nebula-wrap', 'data-testid': 'growth-nebula-container' });
    nebulaContainer.style.maxHeight = '0';
    nebulaContainer.style.overflow = 'hidden';
    nebulaContainer.style.transition = 'max-height 0.35s ease';

    var card4El = h('div', {
      className: 'kpi-card kpi-card-expandable',
      'data-testid': 'kpi-card-net-profit',
      onClick: function() {
        isExpanded = !isExpanded;
        if (isExpanded) {
          card4El.classList.add('is-expanded');
          card4ExpandIcon.textContent = '\u25B2';
          if (!nebulaContainer.firstChild) {
            nebulaContainer.appendChild(createNebulaContent(arena));
          }
          nebulaContainer.style.maxHeight = '380px';
        } else {
          card4El.classList.remove('is-expanded');
          card4ExpandIcon.textContent = '\u25BC';
          nebulaContainer.style.maxHeight = '0';
          setTimeout(function() {
            if (!isExpanded) {
              while (nebulaContainer.firstChild) nebulaContainer.removeChild(nebulaContainer.firstChild);
            }
          }, 400);
        }
      }
    }, card4Header, nebulaContainer);

    var kpiGrid = h('div', { className: 'arena-kpi-grid', 'data-testid': 'arena-kpi-grid' },
      card1, card2, card3, card4El
    );

    // Funnel Pulse
    var funnelFeed = h('div', { className: 'funnel-feed', 'data-testid': 'funnel-feed' });
    for (var i = 0; i < 5; i++) {
      funnelFeed.appendChild(createFunnelEvent());
    }

    var funnelPulse = h('div', { className: 'funnel-pulse', 'data-testid': 'funnel-pulse' },
      h('div', { className: 'funnel-header' },
        h('span', { className: 'funnel-title', textContent: 'LIVE FUNNEL PULSE' }),
        h('span', { className: 'funnel-dot' })
      ),
      funnelFeed
    );

    _funnelInterval = setInterval(function() {
      var newEvent = createFunnelEvent();
      if (funnelFeed.firstChild) {
        funnelFeed.insertBefore(newEvent, funnelFeed.firstChild);
      } else {
        funnelFeed.appendChild(newEvent);
      }
      while (funnelFeed.children.length > 10) {
        funnelFeed.removeChild(funnelFeed.lastChild);
      }
    }, 6000);

    return h('div', { className: 'arena-overview', 'data-testid': 'arena-overview' }, kpiGrid, funnelPulse);
  }

  // ============================================
  // ARENA: THE LEDGER Sub-View
  // ============================================
  function mountArenaLedger() {
    var state = getState();
    var products = state.products || DEFAULT_STATE.products;
    var transactions = state.transactions || DEFAULT_STATE.transactions;
    var viewMode = 'simple'; // 'simple' or 'detailed'

    // View toggle
    var simpleBtn = h('button', {
      className: 'ledger-view-btn active',
      textContent: 'SIMPLE',
      'data-testid': 'ledger-view-simple'
    });
    var detailedBtn = h('button', {
      className: 'ledger-view-btn',
      textContent: 'DETAILED',
      'data-testid': 'ledger-view-detailed'
    });

    var viewToggle = h('div', { className: 'ledger-view-toggle', 'data-testid': 'ledger-view-toggle' },
      h('span', { className: 'ledger-view-label', textContent: 'VIEW:' }),
      simpleBtn,
      detailedBtn
    );

    // Transactions table container (re-rendered on toggle)
    var txTableWrap = h('div', { className: 'ledger-tx-wrap', 'data-testid': 'ledger-tx-wrap' });

    function renderTxTable() {
      while (txTableWrap.firstChild) txTableWrap.removeChild(txTableWrap.firstChild);
      txTableWrap.appendChild(buildTransactionsTable(transactions, viewMode));
    }

    simpleBtn.addEventListener('click', function() {
      if (viewMode === 'simple') return;
      viewMode = 'simple';
      simpleBtn.classList.add('active');
      detailedBtn.classList.remove('active');
      renderTxTable();
    });
    detailedBtn.addEventListener('click', function() {
      if (viewMode === 'detailed') return;
      viewMode = 'detailed';
      detailedBtn.classList.add('active');
      simpleBtn.classList.remove('active');
      renderTxTable();
    });

    // Products table
    var productsCol = h('div', { className: 'ledger-col ledger-col-products', 'data-testid': 'ledger-products-col' },
      h('h3', { className: 'ledger-col-title', textContent: 'PRODUCTS' }),
      buildProductsTable(products)
    );

    // Transactions column
    var txCol = h('div', { className: 'ledger-col ledger-col-tx', 'data-testid': 'ledger-tx-col' },
      h('div', { className: 'ledger-col-header' },
        h('h3', { className: 'ledger-col-title', textContent: 'TRANSACTIONS' }),
        viewToggle
      ),
      txTableWrap
    );

    // Initial render
    renderTxTable();

    return h('div', { className: 'arena-ledger', 'data-testid': 'arena-ledger' }, productsCol, txCol);
  }

  // ============================================
  // LEDGER: Products Table
  // ============================================
  function buildProductsTable(products) {
    var thead = h('thead', null,
      h('tr', null,
        h('th', { textContent: 'ID' }),
        h('th', { textContent: 'NAME' }),
        h('th', { className: 'num-col', textContent: 'SALES' }),
        h('th', { className: 'num-col', textContent: 'REV' })
      )
    );
    var tbody = h('tbody');
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      tbody.appendChild(h('tr', { 'data-testid': 'product-row-' + p.id },
        h('td', { className: 'td-id', textContent: p.id }),
        h('td', { textContent: p.name }),
        h('td', { className: 'num-col', textContent: String(p.sales) }),
        h('td', { className: 'num-col', textContent: '$' + p.revenue.toLocaleString() })
      ));
    }
    return h('table', { className: 'ledger-table', 'data-testid': 'products-table' }, thead, tbody);
  }

  // ============================================
  // LEDGER: Transactions Table
  // ============================================
  function buildTransactionsTable(transactions, mode) {
    var isDetailed = mode === 'detailed';
    var headerCells;
    if (isDetailed) {
      headerCells = ['TX', 'TIME', 'PRODUCT', 'AMT', 'SOURCE', 'CUSTOMER'];
    } else {
      headerCells = ['TX', 'TIME', 'PRODUCT', 'STATUS'];
    }

    var tr = h('tr');
    for (var c = 0; c < headerCells.length; c++) {
      var isNum = headerCells[c] === 'AMT';
      tr.appendChild(h('th', { className: isNum ? 'num-col' : '', textContent: headerCells[c] }));
    }
    var thead = h('thead', null, tr);

    var tbody = h('tbody');
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      var row = h('tr', { 'data-testid': 'tx-row-' + t.tx });
      if (isDetailed) {
        row.appendChild(h('td', { className: 'td-id', textContent: t.tx }));
        row.appendChild(h('td', { textContent: t.time }));
        row.appendChild(h('td', { textContent: t.product }));
        row.appendChild(h('td', { className: 'num-col', textContent: '$' + t.amount.toFixed(2) }));
        row.appendChild(h('td', { textContent: t.source }));
        row.appendChild(h('td', { className: 'td-id', textContent: t.customer }));
      } else {
        row.appendChild(h('td', { className: 'td-id', textContent: t.tx }));
        row.appendChild(h('td', { textContent: t.time }));
        row.appendChild(h('td', { textContent: t.product }));
        var statusEl = h('td', {
          className: t.status === 'paid' ? 'status-paid' : 'status-abandoned',
          textContent: t.status.toUpperCase()
        });
        row.appendChild(statusEl);
      }
      tbody.appendChild(row);
    }

    return h('table', { className: 'ledger-table', 'data-testid': 'transactions-table' }, thead, tbody);
  }

  // ============================================
  // KPI Card Builder
  // ============================================
  function createKPICard(title, value, unit, testId) {
    var unitEl = unit ? h('span', { className: 'kpi-unit', textContent: unit }) : null;
    var inner = h('div', { className: 'kpi-card-inner' },
      h('span', { className: 'kpi-title', textContent: title }),
      h('div', { className: 'kpi-value-row' },
        h('span', { className: 'kpi-value', 'data-testid': 'kpi-val-' + testId }, value)
      )
    );
    if (unitEl) inner.querySelector('.kpi-value-row').appendChild(unitEl);
    return h('div', { className: 'kpi-card', 'data-testid': 'kpi-card-' + testId }, inner);
  }

  // ============================================
  // Growth Nebula \u2014 SVG Line Chart
  // ============================================
  function createNebulaContent(arena) {
    var wrap = h('div', { className: 'nebula-content' });

    var titleRow = h('div', { className: 'nebula-header' },
      h('h2', { className: 'nebula-title', textContent: 'Growth Nebula' }),
      h('p', { className: 'nebula-desc', textContent: 'Mapping trajectory over $' + (arena.targetMonthly / 1000) + 'k/month. Key data points with projected growth curve.' })
    );

    var chartWrap = h('div', { className: 'nebula-chart-wrap', 'data-testid': 'nebula-chart' });
    chartWrap.appendChild(createGrowthSVG(arena.growthData, arena.targetMonthly));

    wrap.appendChild(titleRow);
    wrap.appendChild(chartWrap);
    return wrap;
  }

  function createGrowthSVG(data, target) {
    var NS = 'http://www.w3.org/2000/svg';
    var W = 780, H = 280;
    var pad = { top: 24, right: 48, bottom: 32, left: 56 };
    var cw = W - pad.left - pad.right;
    var ch = H - pad.top - pad.bottom;
    var maxY = Math.max(target * 1.15, Math.max.apply(null, data));

    function svgEl(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      if (attrs) {
        var k = Object.keys(attrs);
        for (var i = 0; i < k.length; i++) el.setAttribute(k[i], attrs[k[i]]);
      }
      return el;
    }

    function toX(i) { return pad.left + (i / (data.length - 1)) * cw; }
    function toY(v) { return pad.top + ch - (v / maxY) * ch; }

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      width: '100%',
      height: '100%'
    });
    svg.style.display = 'block';

    // Horizontal grid lines
    var gridSteps = 5;
    for (var g = 0; g <= gridSteps; g++) {
      var yVal = (maxY / gridSteps) * g;
      var yPos = toY(yVal);
      svg.appendChild(svgEl('line', {
        x1: String(pad.left), y1: String(yPos),
        x2: String(W - pad.right), y2: String(yPos),
        stroke: '#1e1e1e', 'stroke-width': '1'
      }));
      // Y label
      var yLabel = svgEl('text', {
        x: String(pad.left - 8), y: String(yPos + 4),
        fill: '#555', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace',
        'text-anchor': 'end'
      });
      var kVal = yVal / 1000;
      yLabel.textContent = '$' + (kVal >= 1 ? Math.round(kVal) + 'k' : String(Math.round(yVal)));
      svg.appendChild(yLabel);
    }

    // Target line (dashed)
    var tY = toY(target);
    svg.appendChild(svgEl('line', {
      x1: String(pad.left), y1: String(tY),
      x2: String(W - pad.right), y2: String(tY),
      stroke: '#32CD32', 'stroke-width': '1', 'stroke-dasharray': '6,4', opacity: '0.35'
    }));
    var tLabel = svgEl('text', {
      x: String(W - pad.right + 4), y: String(tY + 4),
      fill: '#32CD32', 'font-size': '9', 'font-family': 'JetBrains Mono, monospace', opacity: '0.6'
    });
    tLabel.textContent = '$' + (target / 1000) + 'k/m';
    svg.appendChild(tLabel);

    // Data path
    var pathD = '';
    for (var i = 0; i < data.length; i++) {
      pathD += (i === 0 ? 'M' : 'L') + toX(i).toFixed(1) + ',' + toY(data[i]).toFixed(1);
    }
    svg.appendChild(svgEl('path', {
      d: pathD,
      fill: 'none',
      stroke: '#32CD32',
      'stroke-width': '2',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));

    // Data points
    for (var j = 0; j < data.length; j++) {
      svg.appendChild(svgEl('circle', {
        cx: String(toX(j).toFixed(1)),
        cy: String(toY(data[j]).toFixed(1)),
        r: '3',
        fill: '#32CD32'
      }));
      // Value label on hover-like dots for key points
      if (j === 0 || j === data.length - 1 || j === Math.floor(data.length / 2)) {
        var dLabel = svgEl('text', {
          x: String(toX(j).toFixed(1)),
          y: String(toY(data[j]).toFixed(1) - 10),
          fill: '#888',
          'font-size': '9',
          'font-family': 'JetBrains Mono, monospace',
          'text-anchor': 'middle'
        });
        dLabel.textContent = '$' + (data[j] / 1000).toFixed(1) + 'k';
        svg.appendChild(dLabel);
      }
    }

    // X-axis labels
    var months = ['Mon', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    for (var m = 0; m < data.length; m++) {
      var xLabel = svgEl('text', {
        x: String(toX(m).toFixed(1)),
        y: String(H - 6),
        fill: '#555',
        'font-size': '10',
        'font-family': 'JetBrains Mono, monospace',
        'text-anchor': 'middle'
      });
      xLabel.textContent = months[m] || String(m + 1);
      svg.appendChild(xLabel);
    }

    return svg;
  }

  // ============================================
  // Funnel Pulse \u2014 Live Terminal Feed
  // ============================================
  function createFunnelEvent() {
    var pool = FUNNEL_EVENT_POOL;
    var evt = pool[Math.floor(Math.random() * pool.length)];
    var now = new Date();
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ts = '[' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ']';

    var line = h('div', { className: 'funnel-event' },
      h('span', { className: 'funnel-ts', textContent: ts }),
      h('span', { className: 'funnel-type', textContent: evt.type + ':' }),
      h('span', { className: 'funnel-detail', textContent: evt.detail })
    );
    if (evt.amount) {
      var isNeg = evt.amount.indexOf('-') === 0;
      line.appendChild(h('span', {
        className: 'funnel-amount' + (isNeg ? ' funnel-neg' : ''),
        textContent: evt.amount
      }));
    }
    return line;
  }

  // ============================================
  // NAV BUTTON UPDATE
  // ============================================
  function updateNavButtons(activeModule) {
    var buttons = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var mod = btn.getAttribute('data-module');
      var isActive = mod === activeModule;
      if (isActive) btn.classList.add('active');
      else btn.classList.remove('active');
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
    if (last.toDateString() !== now.toDateString()) return true;
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
        type: 'range', className: 'wb-range',
        min: '1', max: '10', value: String(vals[key]),
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
      for (var i = 1; i <= 10; i++) scaleEl.appendChild(h('span', { textContent: String(i) }));
      return h('div', { className: 'wb-slider-group', 'data-testid': 'wb-group-' + key },
        h('div', { className: 'wb-label-row' },
          h('div', { className: 'wb-label-left' },
            h('span', { className: 'wb-label-name', textContent: label }),
            h('span', { className: 'wb-label-sub', textContent: sub })
          ), valEl
        ), trackWrap, scaleEl
      );
    }

    function doSubmit() {
      setState({ wellbeing: {
        lastCheckIn: new Date().toISOString(),
        recovery: vals.recovery, vitality: vals.vitality, temper: vals.temper
      }});
      removeById('wellbeing-overlay');
      var s = getState();
      updateVirgil(s.activeModule);
      updateModeIndicator();
    }

    var overlay = h('div', {
      id: 'wellbeing-overlay', className: 'fullscreen-overlay', 'data-testid': 'wellbeing-overlay'
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
        h('button', { className: 'wb-submit-btn', textContent: 'SUBMIT CHECK-IN', 'data-testid': 'wb-submit-btn', onClick: doSubmit }),
        h('button', { className: 'wb-dismiss', textContent: 'SKIP FOR NOW', 'data-testid': 'wb-dismiss-btn', onClick: doSubmit })
      )
    );
    document.getElementById('homeos-app').appendChild(overlay);
  }

  // ============================================
  // ARENA LOCKOUT OVERLAY (T2)
  // ============================================
  function mountArenaLockout() {
    removeById('arena-lockout-overlay');
    var overlay = h('div', {
      id: 'arena-lockout-overlay', className: 'fullscreen-overlay', 'data-testid': 'arena-lockout-overlay'
    },
      h('div', { className: 'lockout-content' },
        h('div', { className: 'lockout-icon', textContent: '\u26A0' }),
        h('h1', { className: 'lockout-title', textContent: 'ARENA LOCKED' }),
        h('p', { className: 'lockout-msg', textContent: 'Intervention Protocol T2 has locked THE ARENA due to extended inactivity under low energy conditions. Confirm your intent to unlock.' }),
        h('button', {
          className: 'lockout-unlock-btn', textContent: 'CONFIRM UNLOCK \u2014 RETURN TO ARENA',
          'data-testid': 'lockout-unlock-btn',
          onClick: function() {
            setState({ lastActivity: Date.now() });
            removeById('arena-lockout-overlay');
            navigateTo('ARENA');
          }
        })
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

    var sectionContent = h('div', { className: 'settings-section-content', 'data-testid': 'settings-section-content' });

    var tabAesthetics = h('button', { className: 'settings-tab active', textContent: '[ AESTHETICS ]', 'data-testid': 'settings-tab-aesthetics' });
    var tabConnections = h('button', { className: 'settings-tab', textContent: '[ CONNECTIONS ]', 'data-testid': 'settings-tab-connections' });
    var tabMemory = h('button', { className: 'settings-tab', textContent: '[ SYSTEM MEMORY ]', 'data-testid': 'settings-tab-memory' });

    function switchSection(name) {
      tabAesthetics.classList.toggle('active', name === 'aesthetics');
      tabConnections.classList.toggle('active', name === 'connections');
      tabMemory.classList.toggle('active', name === 'memory');
      while (sectionContent.firstChild) sectionContent.removeChild(sectionContent.firstChild);
      if (name === 'aesthetics') sectionContent.appendChild(buildAestheticsSection());
      else if (name === 'connections') sectionContent.appendChild(buildConnectionsSection());
      else sectionContent.appendChild(buildMemorySection());
    }

    tabAesthetics.addEventListener('click', function() { switchSection('aesthetics'); });
    tabConnections.addEventListener('click', function() { switchSection('connections'); });
    tabMemory.addEventListener('click', function() { switchSection('memory'); });

    var tabRow = h('div', { className: 'settings-tab-row', 'data-testid': 'settings-tab-row' }, tabAesthetics, tabConnections, tabMemory);

    // === AESTHETICS SECTION ===
    function buildAestheticsSection() {
      var currentTheme = getAccent();
      var colorInput = h('input', { type: 'color', className: 'visually-hidden', value: currentTheme, 'data-testid': 'color-picker-input' });
      var colorLabel = h('span', { className: 'custom-color-label', 'data-testid': 'custom-color-label', textContent: currentTheme.toUpperCase() });
      var colorPreview = h('span', { className: 'custom-color-preview', 'data-testid': 'custom-color-preview', style: { background: currentTheme } });

      colorInput.addEventListener('input', function() {
        var hex = this.value;
        setState({ activeTheme: hex });
        applyTheme(hex);
        colorLabel.textContent = hex.toUpperCase();
        colorPreview.style.background = hex;
        updateModeIndicator();
      });

      var colorBtn = h('button', {
        className: 'custom-color-btn', 'data-testid': 'custom-color-btn',
        onClick: function() { colorInput.click(); }
      }, colorPreview, h('span', { textContent: '[ CUSTOM COLOR ]' }), colorLabel);

      var colorSection = h('div', { className: 'settings-field-group' },
        h('span', { className: 'settings-field-title', textContent: 'ENVIRONMENT THEME' }),
        colorBtn, colorInput
      );

      function makeToggle(key, label, desc, checked, isDisabled) {
        var input = h('input', { type: 'checkbox', 'data-testid': 'toggle-' + key });
        input.checked = checked;
        input.addEventListener('change', function() {
          var s = getState();
          var res = deepCopy(s.resilience);
          res[key] = this.checked;
          if (key === 't1' && !this.checked) res.t2 = false;
          setState({ resilience: res });
          switchSection('aesthetics');
        });
        var toggleLabel = h('label', { className: 'toggle-wrap' }, input, h('span', { className: 'toggle-track' }));
        return h('div', {
          className: 'setting-row' + (isDisabled ? ' disabled' : ''),
          'data-testid': 'setting-row-' + key
        },
          h('div', { className: 'setting-info' },
            h('span', { className: 'setting-label', textContent: label }),
            h('span', { className: 'setting-desc', textContent: desc })
          ), toggleLabel
        );
      }

      var s = getState();
      var rows = h('div', { className: 'settings-rows' },
        makeToggle('t1', 'T1 \u2014 NUDGE', 'Blunt VIRGIL prompts when energy is low', s.resilience.t1, false),
        makeToggle('t2', 'T2 \u2014 INTERVENTION', 'Lock Arena after 2hr idle under T1', s.resilience.t2, !s.resilience.t1),
        makeToggle('t3', 'T3 \u2014 RELAPSE', 'Set time limit. Financial inputs become READ-ONLY', s.resilience.t3, false)
      );

      if (s.resilience.t3) {
        var isLockActive = s.resilience.lockoutUntil && Date.now() < s.resilience.lockoutUntil;
        var remaining = isLockActive ? Math.ceil((s.resilience.lockoutUntil - Date.now()) / 60000) : 0;
        var timeInput = h('input', {
          type: 'number', className: 't3-input', min: '1', max: '480',
          value: String(s.resilience.t3TimeLimit || 60), 'data-testid': 't3-time-input'
        });
        var activateBtn = h('button', {
          className: 't3-activate-btn' + (isLockActive ? ' is-active' : ''),
          textContent: isLockActive ? 'ACTIVE' : 'ACTIVATE', 'data-testid': 't3-activate-btn',
          onClick: function() {
            if (isLockActive) return;
            var mins = parseInt(timeInput.value, 10) || 60;
            var st = getState();
            setState({ resilience: mergeObj(st.resilience, { t3TimeLimit: mins, lockoutUntil: Date.now() + mins * 60000 }) });
            switchSection('aesthetics');
            updateModeIndicator();
            updateVirgil(getState().activeModule);
          }
        });
        rows.appendChild(h('div', { className: 't3-config-row', 'data-testid': 't3-config-row' },
          h('label', { textContent: 'Duration (min):' }), timeInput, activateBtn
        ));
        if (isLockActive) {
          rows.appendChild(h('div', { className: 't3-status active-status', 'data-testid': 't3-status',
            textContent: 'T3 ACTIVE \u2014 ' + remaining + ' min remaining' }));
        }
      }

      return h('div', { className: 'settings-aesthetics', 'data-testid': 'settings-aesthetics' }, colorSection, rows);
    }

    // === CONNECTIONS SECTION ===
    function buildConnectionsSection() {
      var config = state.config || { hetznerIp: '', stripeKey: '', tuyaId: '' };

      function makeField(key, label, placeholder) {
        var input = h('input', {
          type: 'password', className: 'connection-input',
          value: config[key] || '', placeholder: placeholder,
          'data-testid': 'config-' + key
        });
        input.addEventListener('change', function() {
          var s = getState();
          var cfg = deepCopy(s.config || {});
          cfg[key] = this.value;
          setState({ config: cfg });
        });
        return h('div', { className: 'settings-field-group', 'data-testid': 'field-' + key },
          h('span', { className: 'settings-field-title', textContent: label }),
          input
        );
      }

      return h('div', { className: 'settings-connections', 'data-testid': 'settings-connections' },
        makeField('hetznerIp', 'HETZNER IP', '0.0.0.0'),
        makeField('stripeKey', 'STRIPE KEY', 'sk_live_...'),
        makeField('tuyaId', 'TUYA ID', 'tuya_device_...')
      );
    }

    // === SYSTEM MEMORY SECTION ===
    function buildMemorySection() {
      var exportBtn = h('button', {
        className: 'memory-action-btn', textContent: '[ EXPORT ]',
        'data-testid': 'memory-export-btn',
        onClick: function() {
          var data = localStorage.getItem(STORAGE_KEY);
          if (!data) return;
          var blob = new Blob([data], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'home_os_backup.json';
          a.click();
          URL.revokeObjectURL(url);
        }
      });

      var fileInput = h('input', {
        type: 'file', accept: '.json', className: 'visually-hidden',
        'data-testid': 'memory-import-input'
      });
      fileInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          try {
            var parsed = JSON.parse(ev.target.result);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            _cache = null;
            window.location.reload();
          } catch (err) {
            // Invalid JSON
          }
        };
        reader.readAsText(file);
      });

      var importBtn = h('button', {
        className: 'memory-action-btn', textContent: '[ IMPORT ]',
        'data-testid': 'memory-import-btn',
        onClick: function() { fileInput.click(); }
      });

      return h('div', { className: 'settings-memory', 'data-testid': 'settings-memory' },
        h('div', { className: 'settings-field-group' },
          h('span', { className: 'settings-field-title', textContent: 'DATA IMMORTALITY' }),
          h('span', { className: 'settings-field-desc', textContent: 'Export or import your complete HOME OS state.' })
        ),
        h('div', { className: 'memory-actions' }, exportBtn, importBtn, fileInput)
      );
    }

    switchSection('aesthetics');

    var panel = h('div', {
      id: 'settings-panel', className: 'fullscreen-overlay', 'data-testid': 'settings-panel'
    },
      h('div', { className: 'settings-container' },
        h('h1', { className: 'settings-title', textContent: 'SETTINGS' }),
        h('p', { className: 'settings-subtitle', textContent: 'System Configuration' }),
        tabRow,
        sectionContent,
        h('div', { className: 'settings-actions' },
          h('button', { className: 'settings-action-btn', textContent: 'WELLBEING CHECK-IN',
            'data-testid': 'manual-checkin-btn', onClick: function() { removeById('settings-panel'); mountWellbeingOverlay(); } }),
          h('button', { className: 'settings-close-btn', textContent: 'CLOSE',
            'data-testid': 'settings-close-btn', onClick: function() { removeById('settings-panel'); updateModeIndicator(); updateVirgil(getState().activeModule); } })
        )
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
    }, 15000);
  }

  function setupActivityTracking() {
    document.addEventListener('mousemove', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity, { passive: true });
    document.addEventListener('click', function() { setState({ lastActivity: Date.now() }); });
    document.addEventListener('touchstart', onActivity, { passive: true });
  }

  // ============================================
  // PERIODIC CHECKS
  // ============================================
  function runPeriodicChecks() {
    var state = getState();
    if (!state) return;
    if (state.resilience.t3 && state.resilience.lockoutUntil) {
      if (Date.now() >= state.resilience.lockoutUntil) {
        setState({ resilience: mergeObj(state.resilience, { lockoutUntil: null }) });
        if (state.activeModule === 'ARENA') navigateTo('ARENA');
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
    if (settingsBtn) settingsBtn.addEventListener('click', mountSettings);
  }

  // ============================================
  // SERVICE WORKER REGISTRATION
  // ============================================
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then(function(reg) {
        // SW registered
      }).catch(function() {
        // SW registration failed (dev environment)
      });
    }
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    initState();
    // Apply saved theme immediately
    applyTheme(getAccent());
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    updateClock();
    setInterval(updateClock, 1000);
    setupNav();
    setupActivityTracking();
    var state = getState();
    navigateTo(state.activeModule);
    if (shouldShowWellbeing()) mountWellbeingOverlay();
    setInterval(runPeriodicChecks, 60000);
    updateModeIndicator();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
