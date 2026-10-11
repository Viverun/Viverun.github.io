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
   LLM-style streaming — only for the name.
   Letters arrive one at a time at an even pace, each fading and
   sharpening in, with the cursor riding the end of the line.
   ========================================================= */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function split(el) {
    var chars = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        var word = document.createElement('span');   // keeps a word from breaking mid-way
        word.className = 'word';
        Array.from(part).forEach(function (ch) {
          var span = document.createElement('span');
          span.className = 'tok';
          span.textContent = ch;
          word.append(span);
          chars.push(span);
        });
        frag.append(word);
      });
      node.replaceWith(frag);
    });
    return chars;
  }

  function play(el, step, delay, keepCursor) {
    var chars = split(el);
    if (!chars.length) return;
    el.classList.add('is-streaming');
    var cursor = el.querySelector('.cursor') || Object.assign(document.createElement('span'), { className: 'cursor' });
    cursor.setAttribute('aria-hidden', 'true');
    cursor.classList.add('is-typing');           // solid while typing, blinks once done
    chars[0].before(cursor);
    chars.forEach(function (span, i) {
      setTimeout(function () {
        span.classList.add('on');
        span.after(cursor);
        if (i === chars.length - 1) {
          cursor.classList.remove('is-typing');
          if (!keepCursor) setTimeout(function () { cursor.remove(); }, 900);
        }
      }, delay + i * step);
    });
  }

  document.querySelectorAll('[data-stream="name"]').forEach(function (el) { play(el, 75, 300, true); });

})();
