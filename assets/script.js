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
        meta.textContent = [text('category'), isNaN(date) ? '' : [String(date.getUTCDate()).padStart(2, '0'), 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ')[date.getUTCMonth()], date.getUTCFullYear()].join(' ')].filter(Boolean).join(' · ');
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
