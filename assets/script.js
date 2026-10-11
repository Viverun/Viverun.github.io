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
  var GROUPS = ['.about-copy, .fact-list', '.cap-list', '.project-card', '.writing-grid > *', '.contact-inner'];
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
   Latest blog entries — read from the journal's own RSS feed,
   so this list updates whenever a post is published there
   ========================================================= */
(function () {
  var list = document.getElementById('latestPosts');
  if (!list || !window.fetch || !window.DOMParser) return;

  fetch('/devlith/rss.xml')
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.text(); })
    .then(function (xml) {
      var items = new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('item');
      if (!items.length) return;
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(items, 0, 3).forEach(function (item) {
        var text = function (tag) { var el = item.querySelector(tag); return el ? el.textContent : ''; };
        var date = new Date(text('pubDate'));
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = text('link');
        a.className = 'post';
        var meta = document.createElement('span');
        meta.className = 'post-meta';
        meta.textContent = [text('category'), isNaN(date) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ');
        var title = document.createElement('span');
        title.className = 'post-title';
        title.textContent = text('title');
        var desc = document.createElement('span');
        desc.className = 'post-desc';
        desc.textContent = text('description');
        a.append(meta, title, desc);
        li.appendChild(a);
        frag.appendChild(li);
      });
      var all = document.createElement('li');
      all.innerHTML = '<a href="/devlith/writing/">All entries →</a>';
      frag.appendChild(all);
      list.replaceChildren(frag);
    })
    .catch(function () { /* keep the static "All entries" link */ });
})();

/* =========================================================
   Chat-style streaming for [data-stream="char" | "word"],
   the same effect as the blog: text arrives in uneven chunks
   with the cursor riding the end
   ========================================================= */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-stream]'));
  if (!blocks.length) return;

  function tokenize(el, mode) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var parts = mode === 'char' ? Array.from(node.nodeValue) : node.nodeValue.split(/(\s+)/);
      parts.forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        var span = document.createElement('span');
        span.className = 'tok';
        span.textContent = part;
        frag.append(span);
        out.push(span);
      });
      node.replaceWith(frag);
    });
    return out;
  }

  var queue = blocks.map(function (el) {
    return { toks: tokenize(el, el.dataset.stream), own: el.querySelector('.cursor') };
  });
  document.documentElement.classList.add('streaming');

  function play(i) {
    if (i >= queue.length) return;
    var toks = queue[i].toks, own = queue[i].own;
    if (!toks.length) return play(i + 1);
    var cursor = own || Object.assign(document.createElement('span'), { className: 'cursor' });
    cursor.setAttribute('aria-hidden', 'true');
    var base = Math.max(1, Math.ceil(toks.length / 120));
    var n = 0;
    (function tick() {
      var end = Math.min(toks.length, n + base + Math.floor(Math.random() * (base + 2)));
      for (; n < end; n++) toks[n].classList.add('on');
      toks[n - 1].after(cursor);
      if (n < toks.length) return setTimeout(tick, 30 + Math.random() * 50);
      if (!own) cursor.remove();
      setTimeout(function () { play(i + 1); }, 150);
    })();
  }
  setTimeout(function () { play(0); }, 300);
})();
