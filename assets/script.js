/* =========================================================
   Mobile nav drawer
   The drawer animates 0fr -> 1fr on a grid row, so it opens to
   whatever height the content actually is. No magic max-height.
   ========================================================= */
(function () {
  var toggle = document.getElementById('navToggle');
  var drawer = document.getElementById('navLinks');
  if (!toggle || !drawer) return;

  function setOpen(open) {
    drawer.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setOpen(!drawer.classList.contains('is-open'));
  });

  drawer.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
})();

/* =========================================================
   Scroll-spy — the reader always knows where they are
   ========================================================= */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-spy]'));
  if (!links.length || !('IntersectionObserver' in window)) return;

  var byId = {};
  var sections = [];
  links.forEach(function (a) {
    var el = document.getElementById(a.getAttribute('data-spy'));
    if (!el) return;
    byId[el.id] = a;
    sections.push(el);
  });

  function clear() {
    links.forEach(function (a) { a.removeAttribute('aria-current'); });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      clear();
      var link = byId[entry.target.id];
      if (link) link.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  sections.forEach(function (s) { io.observe(s); });
})();

/* =========================================================
   Scroll reveal — staggered inside each group, total budget
   held to 240ms so a group lands together rather than trickling
   ========================================================= */
(function () {
  var GROUPS = ['.about-copy, .fact-list', '.cap-list', '.project-card', '.contact-inner'];
  var STEP = 70, CAP = 240;
  var all = [];

  GROUPS.forEach(function (sel) {
    Array.prototype.slice.call(document.querySelectorAll(sel)).forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(i * STEP, CAP) + 'ms');
      all.push(el);
    });
  });

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    all.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  all.forEach(function (el) { io.observe(el); });
})();

/* =========================================================
   Hero — the MATRIX scan pipeline

   A scripted run of the real four-phase pipeline: a target feeds
   recon and discovery, discovery fans out to the exploitation
   agents, and their findings converge on the exploitability gate.
   The gate rejects one false positive and passes one confirmed
   finding to the report. Deterministic layout, fixed edge list,
   no random drift.

   The whole animation is a pure function of one clock value, so
   reduced-motion just evaluates it at the end and draws the
   finished frame, and a resize recomputes geometry without
   losing the run's position.
   ========================================================= */
(function () {
  var canvas = document.getElementById('agentCanvas');
  var fallback = document.getElementById('graphFallback');
  if (!canvas) return;

  var ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
  if (!ctx) {
    canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    return;
  }

  var css = getComputedStyle(document.documentElement);
  function rgb(name, a) { return 'rgba(' + css.getPropertyValue(name).trim() + ',' + a + ')'; }
  var C = {
    action:   function (a) { return rgb('--rgb-action', a); },
    verified: function (a) { return rgb('--rgb-verified', a); },
    flag:     function (a) { return rgb('--rgb-flag', a); },
    text:     function (a) { return rgb('--rgb-text', a); }
  };

  /* ---- the run, in seconds ---------------------------------- */
  var TOTAL = 9.6, FADE_AT = 8.9;

  /* id, label (\n splits lines), x, y, activate, resolve, end state */
  var NODES = [
    ['target',    'target',              0.50, 0.055, 0.0, 0.6,  'clean'],
    ['recon',     'recon',               0.28, 0.235, 0.9, 1.9,  'clean'],
    ['discovery', 'discovery',           0.72, 0.235, 2.2, 3.2,  'clean'],
    ['sqli',      'SQLi',                0.11, 0.445, 3.5, 4.5,  'flagged'],
    ['xss',       'XSS',                 0.37, 0.445, 3.65, 4.6, 'clean'],
    ['auth',      'auth',                0.63, 0.445, 3.8, 4.75, 'flagged'],
    ['api',       'API',                 0.89, 0.445, 3.95, 4.9, 'clean'],
    ['gate',      'exploitability\ngate', 0.50, 0.655, 5.3, 7.0, 'verified'],
    ['rejected',  'false positive',      0.24, 0.875, 6.6, 7.1,  'rejected'],
    ['report',    'report',              0.70, 0.875, 7.4, 7.9,  'verified']
  ];

  /* from, to, start, duration, payload */
  var MSGS = [
    ['target', 'recon',     0.60, 0.35, 'scan'],
    ['recon', 'discovery',  1.90, 0.35, 'scan'],
    ['discovery', 'sqli',   3.20, 0.35, 'scan'],
    ['discovery', 'xss',    3.28, 0.35, 'scan'],
    ['discovery', 'auth',   3.36, 0.35, 'scan'],
    ['discovery', 'api',    3.44, 0.35, 'scan'],
    ['sqli', 'gate',        4.50, 0.45, 'finding'],
    ['auth', 'gate',        4.75, 0.45, 'finding'],
    ['gate', 'rejected',    6.20, 0.45, 'dead'],
    ['gate', 'report',      7.00, 0.45, 'confirmed']
  ];

  var EDGES = [
    ['target', 'recon'], ['recon', 'discovery'],
    ['discovery', 'sqli'], ['discovery', 'xss'], ['discovery', 'auth'], ['discovery', 'api'],
    ['sqli', 'gate'], ['xss', 'gate'], ['auth', 'gate'], ['api', 'gate'],
    ['gate', 'rejected'], ['gate', 'report']
  ];

  /* narrow canvases drop the fourth agent and respread the row */
  var NARROW_X = { recon: 0.26, discovery: 0.74, sqli: 0.14, xss: 0.50, auth: 0.86 };

  var W = 0, H = 0, narrow = false, N = {}, edges = [], msgs = [];
  var DPR = 1, fs = 11, dotR = 5;

  function layout() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(rect.width, 1);
    H = Math.max(rect.height, 1);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    narrow = W < 360;   /* only genuinely small phones drop to 3 agents */
    fs = narrow ? 10 : 11;
    dotR = narrow ? 5 : 5.6;

    var padX = narrow ? 26 : 34, padT = 14, padB = narrow ? 26 : 30;
    var innerW = W - padX * 2, innerH = H - padT - padB;

    N = {};
    NODES.forEach(function (n) {
      if (narrow && n[0] === 'api') return;
      var nx = (narrow && NARROW_X[n[0]] !== undefined) ? NARROW_X[n[0]] : n[2];
      N[n[0]] = {
        id: n[0], label: n[1],
        x: padX + nx * innerW,
        y: padT + n[3] * innerH,
        act: n[4], res: n[5], end: n[6]
      };
    });

    edges = EDGES.filter(function (e) { return N[e[0]] && N[e[1]]; });
    msgs = MSGS.filter(function (m) { return N[m[0]] && N[m[1]]; });
  }

  function stateOf(n, T) {
    if (T < n.act) return 'idle';
    if (T < n.res) return 'running';
    return n.end;
  }

  /* Node paint reads as: grey = done and nothing to report, cyan = working,
     rose = raised a finding, amber = the gate confirmed it. Greys come off
     --rgb-text at low alpha so they stay legible on --surface-2. */
  var PAINT = {
    idle:     function (a) { return C.text(a * 0.30); },
    running:  C.action,
    clean:    function (a) { return C.text(a * 0.46); },
    flagged:  C.flag,
    verified: C.verified,
    rejected: function (a) { return C.text(a * 0.38); }
  };
  var LABEL = {
    idle:     function (a) { return C.text(a * 0.42); },
    running:  C.action,
    clean:    function (a) { return C.text(a * 0.58); },
    flagged:  C.flag,
    verified: C.verified,
    rejected: function (a) { return C.text(a * 0.42); }
  };
  var PAYLOAD = {
    scan: C.action, finding: C.flag, confirmed: C.verified,
    dead: function (a) { return C.text(a * 0.5); }
  };

  function arrow(a, b, alpha, dashed) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len;
    var gap = dotR + 4;
    var x1 = a.x + ux * gap, y1 = a.y + uy * gap;
    var x2 = b.x - ux * (gap + 3), y2 = b.y - uy * (gap + 3);

    ctx.strokeStyle = C.text(alpha);
    ctx.lineWidth = 1;
    ctx.setLineDash(dashed ? [3, 4] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    var head = 4.5;
    ctx.fillStyle = C.text(alpha + 0.06);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
    ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  function label(n, state, alpha) {
    var lines = n.label.split('\n');
    var colour = LABEL[state](alpha);

    ctx.font = fs + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colour;

    var top = n.y + dotR + 7;
    lines.forEach(function (line, i) {
      var y = top + i * (fs + 2);
      ctx.fillText(line, n.x, y);
      if (state === 'rejected') {
        var w = ctx.measureText(line).width;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.x - w / 2, y + fs * 0.55);
        ctx.lineTo(n.x + w / 2, y + fs * 0.55);
        ctx.stroke();
      }
    });
  }

  function node(n, T, alpha) {
    var state = stateOf(n, T);
    var paint = PAINT[state];
    var isGate = n.id === 'gate';
    var r = isGate ? dotR + 2.4 : dotR;

    if (state === 'running') {
      /* one expanding ring, tied to progress through this node's work */
      var p = (T - n.act) / Math.max(n.res - n.act, 0.001);
      var ring = ((p * 1.6) % 1);
      ctx.strokeStyle = paint(alpha * 0.5 * (1 - ring));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + ring * 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state === 'verified') {
      ctx.fillStyle = paint(alpha * 0.16);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === 'idle' || state === 'rejected') {
      ctx.strokeStyle = paint(alpha);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r - 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = paint(alpha);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === 'rejected') {
      var k = r - 1.4;
      ctx.strokeStyle = paint(alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(n.x - k, n.y - k); ctx.lineTo(n.x + k, n.y + k);
      ctx.moveTo(n.x + k, n.y - k); ctx.lineTo(n.x - k, n.y + k);
      ctx.stroke();
    }

    label(n, state, alpha);
  }

  function render(T) {
    var alpha = T > FADE_AT ? Math.max(1 - (T - FADE_AT) / (TOTAL - FADE_AT), 0.06) : 1;
    ctx.clearRect(0, 0, W, H);

    edges.forEach(function (e) {
      var a = N[e[0]], b = N[e[1]];
      var lit = T >= a.res;
      var dashed = e[1] === 'rejected';
      arrow(a, b, (lit ? 0.20 : 0.09) * alpha, dashed);
    });

    msgs.forEach(function (m) {
      var t = (T - m[2]) / m[3];
      if (t < 0 || t > 1) return;
      var a = N[m[0]], b = N[m[1]];
      var x = a.x + (b.x - a.x) * t;
      var y = a.y + (b.y - a.y) * t;
      var fade = Math.sin(t * Math.PI);
      var paint = PAYLOAD[m[4]];
      ctx.fillStyle = paint(alpha * (0.35 + 0.65 * fade) * (m[4] === 'dead' ? 0.6 : 1));
      ctx.beginPath();
      ctx.arc(x, y, m[4] === 'scan' ? 2.2 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    Object.keys(N).forEach(function (k) { node(N[k], T, alpha); });
  }

  /* ---- clock, gated on visibility and on the hero being on screen -- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var elapsed = 0, last = 0, raf = 0, onScreen = true;

  function frame(ts) {
    if (!last) last = ts;
    elapsed += Math.min((ts - last) / 1000, 0.1);
    last = ts;
    render(elapsed % TOTAL);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || reduce) return;
    if (document.visibilityState !== 'visible' || !onScreen) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  layout();
  render(reduce ? TOTAL - 0.9 : 0);   /* reduced motion: the finished frame */

  if (!reduce) {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') start(); else stop();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start(); else stop();
      }, { threshold: 0 }).observe(canvas);
    }
    start();
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layout();                       /* geometry only — the run keeps its place */
      render(reduce ? TOTAL - 0.9 : elapsed % TOTAL);
    }, 150);
  });
})();
