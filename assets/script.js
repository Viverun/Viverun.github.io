/* =========================================================
   Mobile nav toggle
   ========================================================= */
(function () {
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  links.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* =========================================================
   Scroll reveal
   ========================================================= */
(function () {
  var targets = document.querySelectorAll(
    '.about-copy, .fact-list, .skill-group, .project-card, .contact-inner'
  );
  targets.forEach(function (el) { el.classList.add('reveal'); });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach(function (el) { io.observe(el); });
})();

/* =========================================================
   Hero node-graph / constellation canvas
   ---------------------------------------------------------
   A field of drifting nodes connects to its nearest
   neighbours, with the occasional bright pulse travelling
   along an edge — a nod to agent-to-agent hand-offs (and,
   loosely, a constellation).
   ========================================================= */
(function () {
  var canvas = document.getElementById('graphCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var width, height;
  var nodes = [];
  var pulses = [];
  var NODE_COUNT = 34;
  var LINK_DIST = 0;

  var COLOR_NODE = '242, 167, 84';   /* amber */
  var COLOR_EDGE = '237, 239, 247';  /* soft white, low alpha */
  var COLOR_PULSE = '95, 224, 214';  /* cyan */

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * DPR;
    canvas.height = height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    LINK_DIST = Math.max(width, height) * 0.22;
  }

  function makeNodes() {
    nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 1.4 + Math.random() * 1.6
      });
    }
  }

  function maybeSpawnPulse() {
    if (Math.random() > 0.02) return;
    var a = nodes[Math.floor(Math.random() * nodes.length)];
    var candidates = nodes.filter(function (n) {
      var dx = n.x - a.x, dy = n.y - a.y;
      return n !== a && Math.sqrt(dx * dx + dy * dy) < LINK_DIST;
    });
    if (!candidates.length) return;
    var b = candidates[Math.floor(Math.random() * candidates.length)];
    pulses.push({ a: a, b: b, t: 0 });
  }

  function step() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    }
    for (var p = pulses.length - 1; p >= 0; p--) {
      pulses[p].t += 0.02;
      if (pulses[p].t >= 1) pulses.splice(p, 1);
    }
    maybeSpawnPulse();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    /* edges */
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          var alpha = (1 - dist / LINK_DIST) * 0.18;
          ctx.strokeStyle = 'rgba(' + COLOR_EDGE + ',' + alpha + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    /* pulses travelling along an active edge */
    for (var p = 0; p < pulses.length; p++) {
      var pulse = pulses[p];
      var x = pulse.a.x + (pulse.b.x - pulse.a.x) * pulse.t;
      var y = pulse.a.y + (pulse.b.y - pulse.a.y) * pulse.t;
      var glowAlpha = Math.sin(pulse.t * Math.PI);
      ctx.fillStyle = 'rgba(' + COLOR_PULSE + ',' + (0.9 * glowAlpha) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    /* nodes */
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      ctx.fillStyle = 'rgba(' + COLOR_NODE + ',0.85)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    step();
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  makeNodes();
  window.addEventListener('resize', function () {
    resize();
    makeNodes();
  });

  if (reduceMotion) {
    draw();
  } else {
    loop();
  }
})();
