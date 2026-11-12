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
   System diagrams

   Five panels, one engine. Each is a scripted run of a real
   pipeline — the hero shows the shape all four projects share,
   and every project card shows its own. Deterministic layout,
   fixed edge lists, no random drift.

   Every frame is a pure function of one clock value, so reduced
   motion just evaluates the run at the end and draws the finished
   frame, and a resize recomputes geometry without losing the
   run's position.

   Node states, and the whole colour language of these panels:

     idle     hollow grey   not reached yet
     running  its own hue   working, with one expanding ring
     done     grey          finished, nothing to report
     proc     violet        the model, or neutral processing
     flag     rose          raised a risk
     pass     cyan          evaluated and passed
     blocked  rose, struck  a real risk, stopped here
     killed   grey, struck  discarded — it was never real

   Amber never appears here. On this page amber means "someone
   outside it checked this", and a drawing can't earn that.
   ========================================================= */
(function () {
  var canvases = Array.prototype.slice.call(document.querySelectorAll('canvas[data-graph]'));
  if (!canvases.length) return;

  var css = getComputedStyle(document.documentElement);

  /* If the stylesheet a visitor has cached predates one of these tokens,
     getPropertyValue returns '' and every colour becomes the invalid string
     "rgba(,0.5)" — canvas ignores it and keeps the last fill, so the whole
     diagram goes muddy. Fall back to the literal instead of failing quietly. */
  var FALLBACK = {
    '--rgb-action': '95, 224, 214',
    '--rgb-proc':   '167, 139, 250',
    '--rgb-flag':   '238, 116, 128',
    '--rgb-text':   '240, 241, 243'
  };
  function rgb(name, a) {
    return 'rgba(' + (css.getPropertyValue(name).trim() || FALLBACK[name]) + ',' + a + ')';
  }
  var ACTION = function (a) { return rgb('--rgb-action', a); };
  var PROC   = function (a) { return rgb('--rgb-proc', a); };
  var FLAG   = function (a) { return rgb('--rgb-flag', a); };
  var TEXT   = function (a) { return rgb('--rgb-text', a); };
  function grey(k) { return function (a) { return TEXT(a * k); }; }

  /* dot colour, label colour. Labels run brighter — 11px type needs it. */
  var PAINT = {
    idle: grey(0.40), done: grey(0.50), killed: grey(0.46),
    proc: PROC, flag: FLAG, pass: ACTION, blocked: FLAG
  };
  /* Labels run brighter than their dots — 11px type needs it, and these
     all clear 4.5:1 on the panel ground with its tint at full strength. */
  var LABEL = {
    idle: grey(0.56), done: grey(0.62), killed: grey(0.56),
    proc: PROC, flag: FLAG, pass: ACTION, blocked: FLAG
  };
  var STRUCK = { killed: 1, blocked: 1 };
  var HOLLOW = { idle: 1, killed: 1, blocked: 1 };
  var STATUS = { proc: 'proc', flag: 'flag', pass: 'approved', blocked: 'flag' };

  /* ---------------------------------------------------------
     The runs. Node tuple:
       id, label (\n splits lines), x, y, activates, resolves,
       end state, [1 = draw it large, it's the decision point]
     Message tuple: from, to, start, duration, payload
     Edge tuple:    from, to, ['dashed' | 'loop']
     --------------------------------------------------------- */
  var SPECS = {

    /* The pattern every project below is an instance of: a system
       proposes, a gate judges before anything acts, a human closes
       the loop. Not a product — the shape of the work. */
    safety: {
      total: 11.0, fade: 10.2, pad: [40, 16, 32],
      nodes: [
        ['input',    'input',              0.14, 0.045, 0.00, 0.50, 'done'],
        ['model',    'AI model',           0.50, 0.045, 0.10, 0.60, 'proc'],
        ['tools',    'tool use',           0.86, 0.045, 0.25, 0.70, 'done'],
        ['reason',   'reasoning',          0.50, 0.205, 0.90, 1.90, 'proc'],
        ['output',   'output',             0.50, 0.345, 2.20, 3.00, 'proc'],
        ['policy',   'policy\ncheck',      0.14, 0.455, 2.60, 3.30, 'done'],
        ['gate',     'safety\ngate',       0.50, 0.520, 3.60, 6.20, 'pass', 1],
        ['risk',     'risk\ndetection',    0.86, 0.455, 2.70, 3.45, 'flag'],
        ['unsafe',   'unsafe\naction',     0.14, 0.665, 5.30, 5.80, 'blocked'],
        ['align',    'alignment',          0.50, 0.665, 6.50, 7.00, 'pass'],
        ['harmful',  'harmful\noutput',    0.86, 0.665, 5.65, 6.15, 'blocked'],
        ['human',    'human\noversight',   0.50, 0.805, 7.30, 7.90, 'pass'],
        ['approved', 'approved',           0.50, 0.955, 8.20, 8.70, 'pass']
      ],
      edges: [
        ['input', 'reason'], ['model', 'reason'], ['tools', 'reason'],
        ['reason', 'output'], ['output', 'gate'],
        ['policy', 'gate'], ['risk', 'gate'],
        ['gate', 'unsafe', 'dashed'], ['gate', 'harmful', 'dashed'],
        ['gate', 'align'], ['align', 'human'], ['human', 'approved'],
        ['human', 'model', 'loop']
      ],
      msgs: [
        ['input', 'reason', 0.55, 0.35, 'data'],
        ['model', 'reason', 0.68, 0.35, 'proc'],
        ['tools', 'reason', 0.78, 0.35, 'data'],
        ['reason', 'output', 1.95, 0.35, 'proc'],
        ['output', 'gate', 3.05, 0.40, 'proc'],
        ['policy', 'gate', 3.35, 0.40, 'data'],
        ['risk', 'gate', 3.50, 0.40, 'risk'],
        ['gate', 'unsafe', 5.00, 0.40, 'risk'],
        ['gate', 'harmful', 5.35, 0.40, 'risk'],
        ['gate', 'align', 6.25, 0.35, 'pass'],
        ['align', 'human', 7.05, 0.35, 'pass'],
        ['human', 'approved', 7.95, 0.35, 'pass'],
        ['human', 'model', 8.90, 1.10, 'pass']
      ]
    },

    /* MATRIX: the real four-phase scan. Eight agents in the repo,
       four drawn — the row is the idea, not the inventory. */
    matrix: {
      total: 9.6, fade: 8.9, pad: [32, 14, 30],
      nodes: [
        ['target',    'target',               0.50, 0.055, 0.00, 0.60, 'done'],
        ['recon',     'recon',                0.28, 0.235, 0.90, 1.90, 'done'],
        ['discovery', 'discovery',            0.72, 0.235, 2.20, 3.20, 'done'],
        ['sqli',      'SQLi',                 0.11, 0.445, 3.50, 4.50, 'flag'],
        ['xss',       'XSS',                  0.37, 0.445, 3.65, 4.60, 'done'],
        ['auth',      'auth',                 0.63, 0.445, 3.80, 4.75, 'flag'],
        ['api',       'API',                  0.89, 0.445, 3.95, 4.90, 'done'],
        ['gate',      'exploitability\ngate', 0.50, 0.655, 5.30, 7.00, 'pass', 1],
        ['rejected',  'false positive',       0.24, 0.875, 6.60, 7.10, 'killed'],
        ['report',    'report',               0.70, 0.875, 7.40, 7.90, 'pass']
      ],
      edges: [
        ['target', 'recon'], ['recon', 'discovery'],
        ['discovery', 'sqli'], ['discovery', 'xss'],
        ['discovery', 'auth'], ['discovery', 'api'],
        ['sqli', 'gate'], ['xss', 'gate'], ['auth', 'gate'], ['api', 'gate'],
        ['gate', 'rejected', 'dashed'], ['gate', 'report']
      ],
      msgs: [
        ['target', 'recon', 0.60, 0.35, 'data'],
        ['recon', 'discovery', 1.90, 0.35, 'data'],
        ['discovery', 'sqli', 3.20, 0.35, 'data'],
        ['discovery', 'xss', 3.28, 0.35, 'data'],
        ['discovery', 'auth', 3.36, 0.35, 'data'],
        ['discovery', 'api', 3.44, 0.35, 'data'],
        ['sqli', 'gate', 4.50, 0.45, 'risk'],
        ['auth', 'gate', 4.75, 0.45, 'risk'],
        ['gate', 'rejected', 6.20, 0.45, 'dead'],
        ['gate', 'report', 7.00, 0.45, 'pass']
      ],
      narrow: { drop: ['api'], x: { recon: 0.26, discovery: 0.74, sqli: 0.14, xss: 0.50, auth: 0.86 } }
    },

    /* JITS: deterministic all the way down. The release gate is the
       interesting node — 3,008 processed, 2,181 shipped. */
    jits: {
      total: 9.8, fade: 9.1, pad: [32, 14, 30],
      nodes: [
        ['corpus', 'raw corpus',            0.50, 0.045, 0.00, 0.60, 'done'],
        ['norm',   'normalise',             0.50, 0.190, 0.90, 1.80, 'done'],
        ['meta',   'metadata',              0.15, 0.340, 2.10, 3.00, 'done'],
        ['cites',  'citations',             0.50, 0.340, 2.20, 3.10, 'done'],
        ['sects',  'sections',              0.85, 0.340, 2.30, 3.20, 'done'],
        ['bns',    'BNS/BNSS\nguardrail',   0.50, 0.500, 3.50, 4.50, 'flag'],
        ['sim',    'similarity\ngraph',     0.50, 0.660, 4.90, 6.00, 'proc'],
        ['gate',   'release\ngate',         0.50, 0.810, 6.30, 7.60, 'pass', 1],
        ['drop',   'excluded\n827',         0.20, 0.945, 7.30, 7.80, 'killed'],
        ['out',    'train.jsonl\n2,181',    0.72, 0.945, 7.90, 8.40, 'pass']
      ],
      edges: [
        ['corpus', 'norm'],
        ['norm', 'meta'], ['norm', 'cites'], ['norm', 'sects'],
        ['meta', 'bns'], ['cites', 'bns'], ['sects', 'bns'],
        ['bns', 'sim'], ['sim', 'gate'],
        ['gate', 'drop', 'dashed'], ['gate', 'out']
      ],
      msgs: [
        ['corpus', 'norm', 0.62, 0.35, 'data'],
        ['norm', 'meta', 1.85, 0.35, 'data'],
        ['norm', 'cites', 1.92, 0.35, 'data'],
        ['norm', 'sects', 1.99, 0.35, 'data'],
        ['meta', 'bns', 3.05, 0.40, 'data'],
        ['cites', 'bns', 3.15, 0.40, 'data'],
        ['sects', 'bns', 3.25, 0.40, 'risk'],
        ['bns', 'sim', 4.55, 0.40, 'data'],
        ['sim', 'gate', 6.05, 0.40, 'proc'],
        ['gate', 'drop', 7.00, 0.45, 'dead'],
        ['gate', 'out', 7.65, 0.45, 'pass']
      ],
      narrow: { x: { meta: 0.13, sects: 0.87, drop: 0.20, out: 0.74 } }
    },

    /* Playlistify: the only one here with no rejection step — it
       ranks rather than judges, and the diagram says so. */
    playlistify: {
      total: 8.8, fade: 8.1, pad: [34, 14, 30],
      nodes: [
        ['prompt', 'prompt',            0.50, 0.055, 0.00, 0.70, 'done'],
        ['intent', 'intent\nengine',    0.20, 0.240, 1.00, 2.00, 'proc'],
        ['memory', 'agent\nmemory',     0.80, 0.240, 1.10, 2.10, 'done'],
        ['agent',  'agentic\nengine',   0.50, 0.440, 2.40, 3.80, 'proc', 1],
        ['spotify', 'spotify api',      0.16, 0.640, 4.10, 5.00, 'done'],
        ['cache',  'cache',             0.50, 0.640, 4.20, 5.05, 'done'],
        ['rate',   'rate limit',        0.84, 0.640, 4.30, 5.10, 'done'],
        ['ranked', 'ranked tracks',     0.50, 0.800, 5.40, 6.20, 'proc'],
        ['play',   'playlist',          0.26, 0.940, 6.60, 7.10, 'pass'],
        ['mcp',    'mcp tool',          0.74, 0.940, 6.80, 7.30, 'pass']
      ],
      edges: [
        ['prompt', 'intent'], ['prompt', 'memory'],
        ['intent', 'agent'], ['memory', 'agent'],
        ['agent', 'spotify'], ['agent', 'cache'], ['agent', 'rate'],
        ['spotify', 'ranked'], ['cache', 'ranked'], ['rate', 'ranked'],
        ['ranked', 'play'], ['ranked', 'mcp']
      ],
      msgs: [
        ['prompt', 'intent', 0.72, 0.35, 'data'],
        ['prompt', 'memory', 0.80, 0.35, 'data'],
        ['intent', 'agent', 2.05, 0.40, 'proc'],
        ['memory', 'agent', 2.15, 0.40, 'data'],
        ['agent', 'spotify', 3.85, 0.35, 'proc'],
        ['agent', 'cache', 3.92, 0.35, 'proc'],
        ['agent', 'rate', 3.99, 0.35, 'proc'],
        ['spotify', 'ranked', 5.05, 0.40, 'data'],
        ['cache', 'ranked', 5.12, 0.40, 'data'],
        ['ranked', 'play', 6.25, 0.40, 'pass'],
        ['ranked', 'mcp', 6.40, 0.40, 'pass']
      ],
      narrow: { drop: ['rate'], x: { spotify: 0.20, cache: 0.70 } }
    },

    /* Sentinel: the README's waterfall, drawn as one. Each layer
       covers the blind spot of the one above it. */
    sentinel: {
      total: 9.4, fade: 8.7, pad: [34, 14, 30],
      nodes: [
        ['txn',  'transaction',       0.38, 0.050, 0.00, 0.60, 'done'],
        ['vel',  'velocity\ntrap',    0.38, 0.245, 0.90, 1.80, 'done'],
        ['mule', 'mule\nblocked',     0.83, 0.245, 1.90, 2.40, 'blocked'],
        ['vol',  'volume\ntrap',      0.38, 0.460, 2.60, 3.50, 'done'],
        ['smrf', 'smurfing\nblocked', 0.83, 0.460, 3.60, 4.10, 'blocked'],
        ['vae',  'VAE',               0.38, 0.675, 4.40, 6.00, 'proc', 1],
        ['anom', 'anomaly\nblocked',  0.83, 0.675, 6.10, 6.60, 'blocked'],
        ['step', 'step-up\nauth',     0.68, 0.900, 6.90, 7.40, 'flag'],
        ['ok',   'approved',          0.22, 0.900, 7.10, 7.60, 'pass']
      ],
      edges: [
        ['txn', 'vel'], ['vel', 'mule', 'dashed'],
        ['vel', 'vol'], ['vol', 'smrf', 'dashed'],
        ['vol', 'vae'], ['vae', 'anom', 'dashed'],
        ['vae', 'step'], ['vae', 'ok']
      ],
      msgs: [
        ['txn', 'vel', 0.62, 0.35, 'data'],
        ['vel', 'mule', 1.85, 0.35, 'risk'],
        ['vel', 'vol', 1.95, 0.40, 'data'],
        ['vol', 'smrf', 3.55, 0.35, 'risk'],
        ['vol', 'vae', 3.65, 0.40, 'data'],
        ['vae', 'anom', 6.05, 0.35, 'risk'],
        ['vae', 'step', 6.85, 0.35, 'risk'],
        ['vae', 'ok', 6.95, 0.40, 'pass']
      ],
      narrow: { x: { txn: 0.34, vel: 0.34, vol: 0.34, vae: 0.34, mule: 0.82, smrf: 0.82, anom: 0.82, ok: 0.20, step: 0.66 } }
    }
  };

  var PAYLOAD = {
    data: grey(0.55), proc: PROC, risk: FLAG,
    pass: ACTION, dead: grey(0.42)
  };

  /* ---------------------------------------------------------
     One graph instance
     --------------------------------------------------------- */
  function Graph(canvas, spec, status) {
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return null;

    var W = 0, H = 0, N = {}, edges = [], msgs = [];
    var fs = 11, dotR = 5.6, narrow = false, phase = null;

    /* How tall this graph has to be at this width.

       A fixed aspect ratio can't know that JITS runs eight rows deep
       and Sentinel five, so at 320px the tall ones used to collide.
       Instead: for every pair of nodes whose labels could overlap
       horizontally, work out the vertical room the upper one's label
       needs, and take the largest answer. Nodes sitting side by side
       in different columns don't constrain each other at all. */
    function neededInner(innerW, drop, nx) {
      var list = [];
      spec.nodes.forEach(function (n) {
        if (drop.indexOf(n[0]) > -1) return;
        var lines = n[1].split('\n'), chars = 0;
        lines.forEach(function (l) { chars = Math.max(chars, l.length); });
        var x = (narrow && nx.x && nx.x[n[0]] !== undefined) ? nx.x[n[0]] : n[2];
        list.push({ x: x, y: n[3], lines: lines.length, w: chars * fs * 0.62 });
      });

      var need = 0, i, j, a, b;
      for (i = 0; i < list.length; i++) {
        for (j = 0; j < list.length; j++) {
          a = list[i]; b = list[j];
          if (a.y >= b.y) continue;
          if (Math.abs(a.x - b.x) * innerW > (a.w + b.w) / 2 + 10) continue;
          need = Math.max(need, (dotR * 2 + 17 + a.lines * (fs + 2)) / (b.y - a.y));
        }
      }

      /* the bottom row's label has to fit inside the bottom padding */
      var lastY = 0, lastLines = 1;
      list.forEach(function (n) { if (n.y > lastY) { lastY = n.y; lastLines = n.lines; } });
      var spill = dotR + 7 + lastLines * (fs + 2) - spec.pad[2];
      if (spill > 0 && lastY < 1) need = Math.max(need, spill / (1 - lastY));

      return Math.max(need, innerW * 0.5);
    }

    function layout() {
      W = Math.max(canvas.getBoundingClientRect().width, 1);

      narrow = W < 340;
      fs = narrow ? 10 : 11;
      dotR = narrow ? 4.8 : 5.6;

      var nx = spec.narrow || {};
      var drop = nx.drop || [];
      var padX = narrow ? spec.pad[0] * 0.76 : spec.pad[0];
      var innerW = W - padX * 2;
      var innerH = neededInner(innerW, drop, nx);

      H = Math.round(spec.pad[1] + spec.pad[2] + innerH);
      canvas.style.height = H + 'px';

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      N = {};
      spec.nodes.forEach(function (n) {
        if (narrow && drop.indexOf(n[0]) > -1) return;
        var x = n[2];
        if (narrow && nx.x && nx.x[n[0]] !== undefined) x = nx.x[n[0]];
        N[n[0]] = {
          id: n[0], label: n[1],
          x: padX + x * innerW, y: spec.pad[1] + n[3] * innerH,
          act: n[4], res: n[5], end: n[6], big: !!n[7]
        };
      });

      function live(e) { return N[e[0]] && N[e[1]]; }
      edges = spec.edges.filter(live);
      msgs = spec.msgs.filter(live);
    }

    /* Every edge is a polyline so the feedback loop, which routes
       out through the gutter and back up, is not a special case. */
    function pathOf(e) {
      var a = N[e[0]], b = N[e[1]];
      if (e[2] === 'loop') {
        var rx = W - Math.max(9, spec.pad[0] * 0.26);
        return [[a.x, a.y], [rx, a.y], [rx, b.y], [b.x, b.y]];
      }
      return [[a.x, a.y], [b.x, b.y]];
    }

    /* pull both ends back off the dots so arrowheads don't sit on them */
    function trim(p) {
      var q = p.map(function (pt) { return pt.slice(); });
      var last = q.length - 1;
      shrink(q[0], q[1], dotR + 4);
      shrink(q[last], q[last - 1], dotR + 7);
      return q;
    }
    function shrink(from, toward, by) {
      var dx = toward[0] - from[0], dy = toward[1] - from[1];
      var len = Math.hypot(dx, dy) || 1;
      from[0] += dx / len * by;
      from[1] += dy / len * by;
    }

    function along(p, t) {
      var segs = [], total = 0, i;
      for (i = 0; i < p.length - 1; i++) {
        var d = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
        segs.push(d); total += d;
      }
      var want = total * t;
      for (i = 0; i < segs.length; i++) {
        if (want <= segs[i] || i === segs.length - 1) {
          var k = segs[i] ? want / segs[i] : 0;
          return [p[i][0] + (p[i + 1][0] - p[i][0]) * k,
                  p[i][1] + (p[i + 1][1] - p[i][1]) * k];
        }
        want -= segs[i];
      }
      return p[p.length - 1];
    }

    function drawEdge(e, alpha, lit) {
      var p = trim(pathOf(e));
      var dashed = e[2] === 'dashed' || e[2] === 'loop';
      var a = (lit ? 0.22 : 0.09) * alpha;

      ctx.strokeStyle = TEXT(a);
      ctx.lineWidth = 1;
      ctx.setLineDash(dashed ? [3, 4] : []);
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (var i = 1; i < p.length - 1; i++) ctx.arcTo(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], 10);
      ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
      ctx.setLineDash([]);

      var end = p[p.length - 1], prev = p[p.length - 2];
      var dx = end[0] - prev[0], dy = end[1] - prev[1];
      var len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len, head = 4.5;
      ctx.fillStyle = TEXT(a + 0.06);
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(end[0] - ux * head - uy * head * 0.5, end[1] - uy * head + ux * head * 0.5);
      ctx.lineTo(end[0] - ux * head + uy * head * 0.5, end[1] - uy * head - ux * head * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    function drawNode(n, T, alpha) {
      var state = T < n.act ? 'idle' : (T < n.res ? 'running' : n.end);
      var paint = PAINT[state === 'running' ? n.end : state];
      var r = n.big ? dotR + 2.4 : dotR;

      if (state === 'running') {
        var ring = ((T - n.act) / Math.max(n.res - n.act, 0.001) * 1.6) % 1;
        ctx.strokeStyle = paint(alpha * 0.5 * (1 - ring));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + ring * 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (state === 'pass' || (state === 'running' && n.big)) {
        ctx.fillStyle = paint(alpha * 0.15);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (HOLLOW[state]) {
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

      if (STRUCK[state]) {
        var k = r - 1.4;
        ctx.strokeStyle = paint(alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(n.x - k, n.y - k); ctx.lineTo(n.x + k, n.y + k);
        ctx.moveTo(n.x + k, n.y - k); ctx.lineTo(n.x - k, n.y + k);
        ctx.stroke();
      }

      var colour = LABEL[state === 'running' ? n.end : state](alpha);
      ctx.font = fs + 'px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = colour;
      n.label.split('\n').forEach(function (line, i) {
        var y = n.y + r + 7 + i * (fs + 2);
        ctx.fillText(line, n.x, y);
        if (STRUCK[state]) {
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

    /* one slow sweep, so the panel reads as an instrument that is on */
    function sweep(T, alpha) {
      var y = (T / spec.total) * (H + 120) - 60;
      var g = ctx.createLinearGradient(0, y - 46, 0, y + 46);
      g.addColorStop(0, TEXT(0));
      g.addColorStop(0.5, TEXT(0.022 * alpha));
      g.addColorStop(1, TEXT(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 46, W, 92);
    }

    function render(T) {
      var alpha = T > spec.fade ? Math.max(1 - (T - spec.fade) / (spec.total - spec.fade), 0.06) : 1;
      ctx.clearRect(0, 0, W, H);
      sweep(T, alpha);

      edges.forEach(function (e) { drawEdge(e, alpha, T >= N[e[0]].res); });

      msgs.forEach(function (m) {
        var t = (T - m[2]) / m[3];
        if (t < 0 || t > 1) return;
        var pt = along(pathOf([m[0], m[1], edgeKind(m[0], m[1])]), t);
        var fade = Math.sin(t * Math.PI);
        ctx.fillStyle = PAYLOAD[m[4]](alpha * (0.35 + 0.65 * fade));
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], m[4] === 'data' ? 2.2 : 3, 0, Math.PI * 2);
        ctx.fill();
      });

      Object.keys(N).forEach(function (k) { drawNode(N[k], T, alpha); });
      if (status) setStatus(T);
    }

    function edgeKind(from, to) {
      for (var i = 0; i < edges.length; i++) {
        if (edges[i][0] === from && edges[i][1] === to) return edges[i][2];
      }
      return undefined;
    }

    function setStatus(T) {
      var now = null;
      for (var k in N) {
        if (T >= N[k].act && T < N[k].res) { now = N[k]; break; }
      }
      var text = now ? now.label.replace('\n', ' ') : 'idle';
      if (text === phase) return;
      phase = text;
      status.textContent = text;
      var s = now ? STATUS[now.end] : '';
      if (s) status.setAttribute('data-state', s); else status.removeAttribute('data-state');
    }

    return {
      canvas: canvas,
      total: spec.total,
      layout: layout,
      render: render,
      still: function () { render(spec.total - 0.9); }
    };
  }

  /* ---------------------------------------------------------
     One clock for all of them. Only panels actually on screen
     are ticked, and the whole loop stops when the tab is hidden.
     --------------------------------------------------------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var graphs = [], visible = [], clock = 0, last = 0, raf = 0;

  canvases.forEach(function (canvas, i) {
    var spec = SPECS[canvas.getAttribute('data-graph')];
    var panel = canvas.closest('.viz');
    var fallback = panel && panel.querySelector('.graph-fallback');
    var g = spec && Graph(canvas, spec, panel && panel.querySelector('.viz-status'));

    if (!g) {
      canvas.hidden = true;
      if (fallback) fallback.hidden = false;
      return;
    }
    g.offset = i * 1.7;   /* two panels side by side shouldn't pulse in unison */
    graphs.push(g);
    g.layout();
    if (reduce) g.still(); else g.render(0);
  });
  if (!graphs.length) return;

  function frame(ts) {
    if (!last) last = ts;
    clock += Math.min((ts - last) / 1000, 0.1);
    last = ts;
    visible.forEach(function (g) { g.render((clock + g.offset) % g.total); });
    raf = visible.length ? requestAnimationFrame(frame) : 0;
  }

  function start() {
    if (raf || reduce || !visible.length) return;
    if (document.visibilityState !== 'visible') return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  if (!reduce) {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') start(); else stop();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var g = graphs.filter(function (x) { return x.canvas === entry.target; })[0];
          if (!g) return;
          var at = visible.indexOf(g);
          if (entry.isIntersecting && at < 0) visible.push(g);
          else if (!entry.isIntersecting && at > -1) visible.splice(at, 1);
        });
        if (visible.length) start(); else stop();
      }, { threshold: 0 });
      graphs.forEach(function (g) { io.observe(g.canvas); });
    } else {
      visible = graphs.slice();
    }
    start();
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      graphs.forEach(function (g) {
        g.layout();                       /* geometry only — the run keeps its place */
        if (reduce) g.still(); else g.render((clock + g.offset) % g.total);
      });
    }, 150);
  });
})();
