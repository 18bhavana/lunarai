/* DevNotes — client app. Static, no dependencies, hash routing (works on any static host). */
(function () {
  'use strict';

  const CATALOG = window.DEVNOTES_CATALOG || { site: { name: 'DevNotes' }, tracks: [] };
  const SITE = CATALOG.site || { name: 'DevNotes' };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');

  // ------------------------------------------------------------ storage (always guarded)
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('devnotes:' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('devnotes:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };
  const readSet = () => new Set(store.get('read', []));
  const isRead = (key) => readSet().has(key);
  function toggleRead(key) {
    const s = readSet();
    s.has(key) ? s.delete(key) : s.add(key);
    store.set('read', Array.from(s));
    return s.has(key);
  }

  // Topics that moved to a new URL: old prefix → new prefix (keeps old links and reading progress working).
  const MOVED = { 'java/design-patterns': 'design-patterns/essential-patterns' };
  const remap = (key) => {
    for (const [from, to] of Object.entries(MOVED)) if (key === from || key.startsWith(from + '/')) return to + key.slice(from.length);
    return key;
  };
  (function migrateStoredKeys() {
    const read = store.get('read', []);
    const moved = read.map(remap);
    if (moved.some((k, i) => k !== read[i])) store.set('read', Array.from(new Set(moved)));
    const last = store.get('last', null);
    if (last && remap(last) !== last) store.set('last', remap(last));
  })();

  // ------------------------------------------------------------ catalog helpers
  const chapterKey = (track, topic, ch) => `${track.id}/${topic.id}/${ch.slug}`;
  const findTrack = (id) => CATALOG.tracks.find((t) => t.id === id);
  const findTopic = (track, id) => track && track.topics.find((t) => t.id === id);
  const liveTopics = () => CATALOG.tracks.flatMap((tr) => tr.topics.filter((tp) => tp.status === 'live' && tp.chapters && tp.chapters.length).map((tp) => ({ track: tr, topic: tp })));
  function topicProgress(track, topic) {
    const s = readSet();
    const total = (topic.chapters || []).length;
    const done = (topic.chapters || []).filter((c) => s.has(chapterKey(track, topic, c))).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  function lookupKey(key) {
    const [tid, pid, slug] = key.split('/');
    const track = findTrack(tid), topic = findTopic(track, pid);
    const chapter = topic && (topic.chapters || []).find((c) => c.slug === slug);
    return chapter ? { track, topic, chapter } : null;
  }

  // ------------------------------------------------------------ chapter loading
  const loaded = {};
  const pending = {};
  window.DevNotes = { register(key, data) { loaded[key] = data; (pending[key] || []).forEach((fn) => fn(data)); delete pending[key]; } };
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadChapter(key) {
    if (loaded[key]) return Promise.resolve(loaded[key]);
    return new Promise((resolve, reject) => {
      (pending[key] = pending[key] || []).push(resolve);
      loadScript(`/data/${key}.js`).catch(reject);
    });
  }

  // ------------------------------------------------------------ routing (real paths; every page is also pre-rendered by build.js)
  const u = (p) => (p ? `/${p}/` : '/');
  const PAGES = CATALOG.pages || [];                 // static pages: about, contact, privacy-policy, terms
  const findPage = (slug) => PAGES.find((p) => p.slug === slug);

  function parseRoute() {
    const parts = location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const hash = location.hash.slice(1);
    return { parts, section: hash && !hash.startsWith('/') ? decodeURIComponent(hash) : null };
  }
  const main = $('#main');
  // HTML the build already rendered into this page — reused so the first view appears instantly.
  const PRE = main.dataset.route != null ? { route: main.dataset.route, content: $('#content') ? $('#content').innerHTML : null } : null;
  let current = { view: null, key: null };
  let filter = 'all';
  let cleanup = [];

  // GoatCounter counts the first page load itself; in-app navigation is reported here.
  let lastCounted = location.pathname;
  function countPageView() {
    if (location.pathname === lastCounted) return;
    lastCounted = location.pathname;
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') {
      // Title is read after the new view has rendered.
      setTimeout(() => gc.count({ path: location.pathname, title: document.title, event: false }), 0);
    }
  }

  function navigate(href, replace) {
    history[replace ? 'replaceState' : 'pushState'](null, '', href);
    route();
    if (!location.hash && !replace) window.scrollTo({ top: 0, behavior: 'instant' });
    if (!replace) countPageView();
  }

  function route() {
    // Old "#/track/topic/chapter?s=section" links → "/track/topic/chapter/#section"
    if (location.hash.startsWith('#/')) {
      const [p, q = ''] = location.hash.slice(2).split('?');
      const s = new URLSearchParams(q).get('s');
      history.replaceState(null, '', u(p.split('/').filter(Boolean).join('/')) + (s ? `#${s}` : ''));
    }
    const { parts, section } = parseRoute();
    const path = parts.join('/');
    if (remap(path) !== path) return navigate(u(remap(path)) + (section ? `#${section}` : ''), true);
    closeSidebar();
    closeSearch();
    if (parts.length >= 3) {
      const key = parts.slice(0, 3).join('/');
      if (current.view === 'chapter' && current.key === key) { scrollToSection(section, true); return; }
      return renderChapter(key, section);
    }
    cleanup.forEach((fn) => fn()); cleanup = [];
    setProgressBar(0);
    if (parts.length === 1 && parts[0] === 'support' && SUPPORT) return renderSupport();
    if (parts.length === 1 && findPage(parts[0])) return renderStaticPage(findPage(parts[0]));
    if (parts.length === 2) return renderTopic(parts[0], parts[1]);
    if (parts.length === 1) return renderTrack(parts[0]);
    if (parts.length === 0) return renderHome();
    return renderNotFound();
  }

  function setMeta(name, value, attr = 'name') {
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }
  function setView(view, key, html, title, description) {
    current = { view, key };
    document.body.classList.toggle('view-home', view === 'home');
    main.innerHTML = html;
    document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} — ${SITE.tagline || 'Tech notes'}`;
    const desc = description || SITE.tagline || '';
    setMeta('description', desc);
    setMeta('og:title', document.title, 'property');
    setMeta('og:description', desc, 'property');
    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical && SITE.url) canonical.href = SITE.url.replace(/\/$/, '') + location.pathname;
    renderNav();
    renderSidebar();
  }

  // Same-origin links are handled in the app (no full page reload).
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /^\/(assets|data)\//.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    e.preventDefault();
    if (url.pathname === location.pathname && url.hash) {
      history.replaceState(null, '', url.pathname + url.hash);
      scrollToSection(decodeURIComponent(url.hash.slice(1)), true);
      return;
    }
    navigate(url.pathname + url.hash);
  });
  addEventListener('popstate', () => { route(); countPageView(); });

  const SUPPORT = SITE.support && SITE.support.upi ? SITE.support : null;
  // UPI deep link; no amount means the payer types any amount in their app.
  function upiLink(amount) {
    const q = [`pa=${SUPPORT.upi}`, `pn=${encodeURIComponent(SUPPORT.payee || SITE.name)}`, 'cu=INR', `tn=${encodeURIComponent(SUPPORT.note || 'Support ' + SITE.name)}`];
    if (amount) q.push(`am=${amount}`);
    return `upi://pay?${q.join('&')}`;
  }

  const footerHtml = () => `<footer class="site-footer"><span>© ${new Date().getFullYear()} ${esc(SITE.name)} · Notes for learning and interview prep</span>` +
    `<nav class="footer-links" aria-label="Site">${PAGES.map((p) => `<a href="${u(p.slug)}">${esc(p.title)}</a>`).join('')}${SUPPORT ? `<a href="/support/">Support</a>` : ''}</nav>` +
    `<span>Updated ${esc(CATALOG.builtAt || '')}</span></footer>`;

  // About, Contact, Privacy Policy, Terms — content written in content/pages/*.md
  function renderStaticPage(page) {
    const key = `pages/${page.slug}`;
    setView('page', key, `<div class="page legal-page"><article class="legal"><h1>${esc(page.title)}</h1>` +
      `<p class="legal-updated">Last updated: ${esc(page.updated || CATALOG.builtAt || '')}</p>` +
      `<div class="content" id="content">${PRE && PRE.route === key && PRE.content ? PRE.content : '<div class="skeleton"></div><div class="skeleton" style="width:80%"></div>'}</div></article></div>${footerHtml()}`,
      page.title, page.description);
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadChapter(key).then((data) => { if (current.key === key) $('#content').innerHTML = data.html; })
      .catch(() => { $('#content').innerHTML = '<div class="filter-empty">Couldn\x27t load this page. Refresh to try again.</div>'; });
  }

  // ------------------------------------------------------------ top nav + sidebar
  function activeIds() {
    const { parts } = parseRoute();
    return { track: parts[0] || null, topic: parts[1] || null, slug: parts[2] || null };
  }

  function renderNav() {
    const a = activeIds();
    $('#trackNav').innerHTML = `<a class="nav-link${!a.track ? ' active' : ''}" href="/">Home</a>` +
      CATALOG.tracks.map((t) => {
        const live = t.topics.some((tp) => tp.status === 'live');
        return `<a class="nav-link${a.track === t.id ? ' active' : ''}" href="${u(t.id)}">${esc(t.name)}${live ? '' : '<span class="soon-dot" title="Coming soon"></span>'}</a>`;
      }).join('');
  }

  function renderSidebar() {
    const a = activeIds();
    const s = readSet();
    const focus = (a.track && findTopic(findTrack(a.track), a.topic) && findTopic(findTrack(a.track), a.topic).status === 'live')
      ? { track: findTrack(a.track), topic: findTopic(findTrack(a.track), a.topic) }
      : liveTopics()[0];
    let html = `<div class="side-head"><div class="side-title">Backend Notes</div><div class="side-sub">${esc(SITE.tagline || '')}</div></div>`;
    if (focus) {
      const p = topicProgress(focus.track, focus.topic);
      html += `<div class="progress-card"><div class="progress-top"><span>${esc(focus.topic.name)} progress</span><b>${p.done} / ${p.total}</b></div>` +
        `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}" aria-label="${esc(focus.topic.name)} chapters read"><span style="width:${p.pct}%"></span></div></div>`;
    }
    for (const track of CATALOG.tracks) {
      html += `<div class="side-label">${esc(track.name)}</div>`;
      for (const topic of track.topics) {
        if (topic.status !== 'live' || !topic.chapters || !topic.chapters.length) {
          html += `<div class="side-topic is-soon"><span>${esc(topic.name)}</span><span class="chip">Soon</span></div>`;
          continue;
        }
        html += `<a class="side-topic" href="${u(track.id + "/" + topic.id)}"><span>${esc(topic.name)}</span><span class="chip chip-live">${topic.chapters.length}</span></a>`;
        html += `<div class="side-chapters">` + topic.chapters.map((c, i) => {
          const key = chapterKey(track, topic, c);
          const active = a.track === track.id && a.topic === topic.id && a.slug === c.slug;
          return `<a class="chapter-link${active ? ' active' : ''}" href="${u(key)}"${active ? ' aria-current="page"' : ''}>` +
            `<span class="num">${pad(i + 1)}</span><span>${esc(c.title)}</span>${s.has(key) ? '<span class="done-tick" title="Read">✓</span>' : ''}</a>`;
        }).join('') + `</div>`;
      }
    }
    const sb = $('#sidebar');
    const top = sb.scrollTop;
    sb.innerHTML = html;
    sb.scrollTop = top;
    const act = $('.chapter-link.active', sb);
    if (act) {
      const r = act.getBoundingClientRect(), sr = sb.getBoundingClientRect();
      if (r.top < sr.top || r.bottom > sr.bottom) act.scrollIntoView({ block: 'center' });
    }
  }

  // ------------------------------------------------------------ cards
  function chapterCard(track, topic, c, i) {
    const key = chapterKey(track, topic, c);
    return `<a class="chapter-card" href="${u(key)}">` +
      `<div class="card-num"><span>CHAPTER ${pad(i + 1)}</span>${isRead(key) ? '<span class="done">✓ Read</span>' : ''}</div>` +
      `<h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p>` +
      `<div class="card-foot"><span>${c.readMin} min · ${c.questions} Q&amp;A · ${c.examples} examples</span><span class="arrow" aria-hidden="true">→</span></div></a>`;
  }

  function trackCard(track) {
    const rows = track.topics.map((tp) => tp.status === 'live' && tp.chapters && tp.chapters.length
      ? `<a class="topic-row" href="${u(track.id + "/" + tp.id)}"><span>${esc(tp.name)}</span><span class="chip chip-live">${tp.chapters.length} chapters</span></a>`
      : `<div class="topic-row is-soon"><span>${esc(tp.name)}</span><span class="chip">Soon</span></div>`).join('');
    return `<div class="track-card"><h3><a href="${u(track.id)}">${esc(track.name)}</a></h3><p>${esc(track.description || '')}</p>${rows}</div>`;
  }

  // ------------------------------------------------------------ views
  // ------------------------------------------------------------ landing illustration + icons
  const ICONS = {
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".6"/>',
    concept: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    question: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.3c-.7.3-1.1 1-1.1 1.7v.5M12 17h.01"/>',
    java: '<path d="M6 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H16.5"/><path d="M9 3.5c-.8 1 .8 1.8 0 3M12.5 3c-.8 1 .8 1.8 0 3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  const icon = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.layers}</svg>`;

  function heroArt() {
    const cube = (x, y, s, cls) => `<g class="cube ${cls}" transform="translate(${x} ${y})">` +
      `<path d="M0 ${-s * 0.5} L${s} 0 L0 ${s * 0.5} L${-s} 0Z" class="c-top"/>` +
      `<path d="M${-s} 0 L0 ${s * 0.5} L0 ${s * 1.5} L${-s} ${s}Z" class="c-left"/>` +
      `<path d="M${s} 0 L0 ${s * 0.5} L0 ${s * 1.5} L${s} ${s}Z" class="c-right"/></g>`;
    const tile = (x, y, glyph, cls, d) => `<g class="tile ${cls}" style="animation-delay:${d}s"><g transform="translate(${x} ${y})">` +
      `<rect x="-29" y="-29" width="58" height="58" rx="14" class="t-back"/><rect x="-27" y="-31" width="58" height="58" rx="14" class="t-face"/>` +
      `<g transform="translate(-10 -14)" class="t-glyph">${glyph}</g></g></g>`;
    const g = {
      cup: '<path d="M2 8h16v6a7 7 0 0 1-7 7H9a7 7 0 0 1-7-7V8Z"/><path d="M18 10h2a3 3 0 0 1 0 6h-2.5"/><path d="M7 1.5c-1 1.3 1 2.2 0 4M11 1c-1 1.3 1 2.2 0 4"/>',
      leaf: '<path d="M3 21C3 9 10 3 21 3c0 11-6 18-18 18Z"/><path d="M3 21 14 10"/>',
      box: '<path d="M2 8 11 3l9 5v10l-9 5-9-5Z"/><path d="m2 8 9 5 9-5M11 13v10"/>',
      wheel: '<circle cx="11" cy="12" r="9"/><circle cx="11" cy="12" r="3"/><path d="M11 3v6M11 15v6M2 12h6M14 12h6M4.6 5.6l4.3 4.3M13.1 14.1l4.3 4.3M4.6 18.4l4.3-4.3M13.1 9.9l4.3-4.3"/>',
      db: '<ellipse cx="11" cy="5" rx="8" ry="3"/><path d="M3 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M3 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
      cloud: '<path d="M6 20h11a5 5 0 0 0 .8-9.9A7 7 0 0 0 4.4 11 4.5 4.5 0 0 0 6 20Z"/>',
    };
    const codeLines = [[0, 60, 'l1'], [0, 104, 'l2'], [14, 78, 'l3'], [14, 120, 'l1'], [28, 52, 'l2'], [14, 96, 'l3'], [0, 70, 'l1'], [14, 110, 'l2'], [28, 64, 'l3'], [0, 88, 'l1']]
      .map(([x, w, c], i) => `<rect x="${18 + x}" y="${26 + i * 13}" width="${w}" height="6" rx="3" class="${c}"/>`).join('');
    const keys = Array.from({ length: 4 }, (_, r) => Array.from({ length: 9 }, (__, c) =>
      `<rect x="${14 + c * 18}" y="${12 + r * 15}" width="14" height="10" rx="2.5" class="key"/>`).join('')).join('');
    return `<svg class="hero-art" viewBox="0 0 560 440" role="img" aria-label="Illustration of a laptop surrounded by floating technology tiles">
      <defs>
        <linearGradient id="hg-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1d6b"/><stop offset="1" stop-color="#120c33"/></linearGradient>
        <linearGradient id="hg-deck" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#6d28d9"/></linearGradient>
        <linearGradient id="hg-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4c1d95"/><stop offset="1" stop-color="#2e1065"/></linearGradient>
        <radialGradient id="hg-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".55"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="300" cy="300" rx="250" ry="140" fill="url(#hg-glow)"/>
      <g class="grid-floor" opacity=".35">${Array.from({ length: 9 }, (_, i) => `<path d="M${60 + i * 55} 420 L${300} 250"/>`).join('')}</g>
      ${cube(110, 300, 16, 'cb1')}${cube(470, 345, 13, 'cb2')}${cube(150, 395, 11, 'cb3')}${cube(430, 220, 10, 'cb1')}${cube(500, 250, 8, 'cb2')}
      <g class="laptop">
        <path d="M120 300 L310 378 L310 392 L120 314Z" fill="#3b1a7a"/>
        <path d="M310 378 L470 296 L470 310 L310 392Z" fill="url(#hg-edge)"/>
        <path d="M120 300 L310 378 L470 296 L280 218Z" fill="url(#hg-deck)"/>
        <g transform="matrix(1 0.41 -1.15 0.59 280 218)">${keys}<rect x="66" y="92" width="58" height="26" rx="5" class="pad"/></g>
        <path d="M280 218 L470 296 L486 118 L296 40Z" fill="#1b1145" stroke="#7c5cff" stroke-opacity=".55" stroke-width="2"/>
        <g transform="matrix(1 0.41 -0.091 1.011 296 40)"><g>
          <rect x="6" y="6" width="178" height="164" rx="6" fill="url(#hg-screen)"/>
          <circle cx="18" cy="15" r="3" class="dot1"/><circle cx="28" cy="15" r="3" class="dot2"/><circle cx="38" cy="15" r="3" class="dot3"/>
          ${codeLines}
          <rect x="128" y="34" width="44" height="54" rx="5" class="panel"/>
          <rect x="134" y="42" width="30" height="5" rx="2.5" class="l3"/><rect x="134" y="54" width="22" height="5" rx="2.5" class="l1"/><rect x="134" y="66" width="28" height="5" rx="2.5" class="l2"/>
        </g></g>
      </g>
      ${tile(130, 110, g.cloud, 'tl-blue', 0)}${tile(345, 50, g.cup, 'tl-white', 0.6)}${tile(450, 80, g.leaf, 'tl-green', 1.2)}
      ${tile(515, 170, g.box, 'tl-sky', 0.3)}${tile(500, 290, g.wheel, 'tl-violet', 0.9)}${tile(70, 215, g.db, 'tl-pink', 1.5)}
    </svg>`;
  }

  function pathCard(path, i) {
    const steps = (path.steps || []).map((s) => { const [tid, pid] = s.split('/'); const tr = findTrack(tid); return { track: tr, topic: findTopic(tr, pid) }; }).filter((s) => s.topic);
    const liveSteps = steps.filter((s) => s.topic.status === 'live' && s.topic.chapters && s.topic.chapters.length);
    let done = 0, total = 0;
    liveSteps.forEach((s) => { const p = topicProgress(s.track, s.topic); done += p.done; total += p.total; });
    const pct = total ? Math.round((done / total) * 100) : 0;
    const first = liveSteps.find((s) => topicProgress(s.track, s.topic).done < s.topic.chapters.length) || liveSteps[0];
    const route = steps.map((s) => `<span class="${s.topic.status === 'live' ? 'live' : ''}">${esc(s.topic.name.replace(/ & Streams| Fundamentals| Basics/, ''))}</span>`).join('<i>→</i>');
    const inner = `<div class="path-top"><span class="path-icon pi-${i % 3}">${icon(path.icon)}</span><div><h3>${esc(path.name)}</h3><div class="path-route">${route}</div></div></div>` +
      `<div class="path-foot"><div class="path-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(path.name)} progress"><span style="width:${Math.max(pct, total ? 3 : 0)}%"></span></div>` +
      `<span class="chip">${steps.length} modules · ${liveSteps.length} live</span></div>` +
      `<div class="path-meta">${total ? `${done} / ${total} chapters read` : 'Coming soon'}</div>`;
    return first ? `<a class="path-card" href="${u(first.track.id + "/" + first.topic.id)}">${inner}</a>` : `<div class="path-card is-soon">${inner}</div>`;
  }

  function renderHome() {
    const live = liveTopics();
    const chapters = live.flatMap(({ topic }) => topic.chapters);
    const qs = chapters.reduce((n, c) => n + (c.questions || 0), 0);
    const ex = chapters.reduce((n, c) => n + (c.examples || 0), 0);
    const concepts = chapters.reduce((n, c) => n + (c.sections || 0), 0);
    const first = live[0];
    const last = store.get('last', null);
    const lastInfo = last && lookupKey(last);
    const startHref = lastInfo ? u(last) : first ? u(chapterKey(first.track, first.topic, first.topic.chapters[0])) : '/';
    const stat = (cls, ic, value, label) => `<div class="lstat"><span class="lstat-icon ${cls}">${icon(ic)}</span><div><b>${value}</b><span>${label}</span></div></div>`;
    let html = `<section class="landing-hero"><div class="landing-inner">` +
      `<div class="landing-copy"><span class="pill">${icon('spark', 15)} From Basics to Advanced</span>` +
      `<h1>Master Modern <span class="grad-hero">Technologies</span></h1>` +
      `<p>Structured notes, hands-on examples, real-world scenarios and interview questions to accelerate your learning journey.</p>` +
      `<div class="hero-actions"><a class="btn btn-hero" href="${startHref}">${lastInfo ? 'Continue learning' : 'Get Started'}</a>` +
      `<button class="btn btn-ghost" type="button" id="browseTopics">Browse Topics</button></div>` +
      (lastInfo ? `<div class="hero-resume">Last read: <a href="${u(last)}">${esc(lastInfo.chapter.title)}</a> · ${esc(lastInfo.topic.name)}</div>` : '') +
      `</div><div class="landing-visual">${heroArt()}</div></div></section>` +
      `<div class="page landing-page"><div class="lstats">` +
      stat('si-orange', 'layers', `${CATALOG.tracks.length}`, 'Learning tracks') +
      stat('si-violet', 'concept', `${concepts}+`, 'Concepts') +
      stat('si-pink', 'code', `${ex}+`, 'Code examples') +
      stat('si-green', 'question', `${qs}+`, 'Interview questions') + `</div>`;
    html += `<div class="section-head" id="allTracks"><div><h2>All tracks</h2><p>More topics are on the way. Each one follows the same deep-notes format.</p></div></div>` +
      `<div class="track-grid">${CATALOG.tracks.map(trackCard).join('')}</div>`;
    if ((CATALOG.paths || []).length) {
      html += `<div class="section-head"><div><h2>Featured Learning Paths</h2><p>Follow structured paths to master each technology from basics to advanced.</p></div>` +
        `<a class="link-more" href="#" id="viewAllPaths">View all tracks ${icon('arrow', 16)}</a></div>` +
        `<div class="path-grid">${CATALOG.paths.map(pathCard).join('')}</div>`;
    }
    for (const { track, topic } of live) {
      const p = topicProgress(track, topic);
      const preview = topic.chapters.slice(0, 6);
      html += `<div class="section-head"><div><h2>${esc(topic.name)}</h2><p>${esc(topic.description || '')}</p></div>` +
        `<a class="btn" href="${u(track.id + "/" + topic.id)}">All ${topic.chapters.length} chapters${p.done ? ` · ${p.done} read` : ''} →</a></div>` +
        `<div class="chapter-grid">${preview.map((c, i) => chapterCard(track, topic, c, i)).join('')}</div>`;
    }
    html += `</div>${footerHtml()}`;
    setView('home', null, html, null);
    const toTracks = (e) => { e.preventDefault(); const t = $('#allTracks'); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' }); };
    $('#browseTopics').addEventListener('click', toTracks);
    const va = $('#viewAllPaths'); if (va) va.addEventListener('click', toTracks);
  }

  function renderTrack(trackId) {
    const track = findTrack(trackId);
    if (!track) return renderNotFound();
    const topicCard = (tp) => {
      const live = tp.status === 'live' && tp.chapters && tp.chapters.length;
      const foot = live ? `<span>${tp.chapters.length} chapters · ${topicProgress(track, tp).done} read</span><span class="arrow" aria-hidden="true">→</span>` : '<span class="chip">Coming soon</span>';
      const inner = `<div class="card-num"><span>${esc(track.name.toUpperCase())}</span></div><h3>${esc(tp.name)}</h3><p>${esc(tp.description || '')}</p><div class="card-foot">${foot}</div>`;
      return live ? `<a class="chapter-card" href="${u(track.id + "/" + tp.id)}">${inner}</a>` : `<div class="chapter-card" style="opacity:.7">${inner}</div>`;
    };
    const html = `<div class="page"><section class="hero"><div class="eyebrow">Track</div><h1>${esc(track.name)}</h1><p>${esc(track.description || '')}</p></section>` +
      `<div style="height:28px"></div><div class="chapter-grid">${track.topics.map(topicCard).join('')}</div></div>${footerHtml()}`;
    setView('track', null, html, track.name, track.description);
  }

  function renderTopic(trackId, topicId) {
    const track = findTrack(trackId), topic = findTopic(track, topicId);
    if (!topic) return renderNotFound();
    if (topic.status !== 'live' || !topic.chapters || !topic.chapters.length) {
      return setView('topic', null, `<div class="page"><div class="empty-state"><div class="eyebrow">${esc(track.name)}</div><h1>${esc(topic.name)} is coming soon</h1>` +
        `<p>${esc(topic.description || '')}</p><a class="btn btn-primary" href="/">Browse available notes</a></div></div>${footerHtml()}`, topic.name);
    }
    const p = topicProgress(track, topic);
    const next = topic.chapters.find((c) => !isRead(chapterKey(track, topic, c))) || topic.chapters[0];
    const html = `<div class="page"><section class="hero"><div class="eyebrow">${esc(track.name)} · ${topic.chapters.length} chapters</div>` +
      `<h1>${esc(topic.name)} <span class="grad">Masterclass</span></h1><p>${esc(topic.description || '')}</p>` +
      `<div class="hero-actions"><a class="btn btn-primary" href="${u(chapterKey(track, topic, next))}">${p.done ? 'Continue' : 'Start'}: ${esc(next.title)} →</a></div>` +
      `<div class="hero-progress"><div class="progress-top"><span>Your progress</span><b>${p.done} / ${p.total} read</b></div><div class="progress"><span style="width:${p.pct}%"></span></div></div></section>` +
      `<div style="height:30px"></div><div class="chapter-grid">${topic.chapters.map((c, i) => chapterCard(track, topic, c, i)).join('')}</div></div>${footerHtml()}`;
    setView('topic', null, html, topic.name, topic.description);
  }

  function renderNotFound() {
    setView('404', null, `<div class="page"><div class="empty-state"><div class="eyebrow">404</div><h1>Page not found</h1><p>That note doesn't exist (yet). Try search, or head back home.</p>` +
      `<a class="btn btn-primary" href="/">Go home</a></div></div>${footerHtml()}`, 'Not found');
  }

  const TABS = [
    { id: 'all', label: 'Concept' },
    { id: 'code', label: 'Examples' },
    { id: 'interview', label: 'Interview Q&A' },
    { id: 'summary', label: 'Quick Revision' },
  ];

  // ------------------------------------------------------------ support (UPI donations, any amount)
  function renderSupport() {
    const chapters = liveTopics().reduce((n, { topic }) => n + topic.chapters.length, 0);
    const amounts = SUPPORT.amounts || [];
    const readCount = readSet().size;
    const personal = readCount >= 1
      ? `<p class="support-personal">🌱 You’ve read <b>${readCount}</b> chapter${readCount === 1 ? '' : 's'} on ${esc(SITE.name)} so far. Every one of them was free — and with your help, they can stay that way.</p>`
      : '';
    const html = `<div class="page support-page"><section class="support-hero">` +
      `<div class="eyebrow">Support ${esc(SITE.name)}</div>` +
      `<h1>Help keep learning free for the next person</h1>` +
      `<p>Kahin koi student hostel ke kamre mein placement ki taiyari kar raha hai. Kahin koi developer raat 1 baje finally samajh raha hai ki HashMap andar se kaise kaam karta hai. ` +
      `${esc(SITE.name)} unke liye hai — aur shayad kabhi aapke liye bhi tha. 💜</p>` +
      `<p>There are no ads, no paywalls and no sign-ups — just ${chapters} chapters of notes, put together and checked over many evenings, and kept free by readers who chip in what they can. ` +
      `If these notes have helped you, any amount — even ₹10 — makes a real difference.</p>${personal}</section>` +
      `<div class="support-impact" aria-label="What your support does">` +
      `<div><b>₹29</b><span>Ek cutting chai ☕ — late-night writing sessions ka sahara</span></div>` +
      `<div><b>₹99</b><span>Helps cover hosting so the site stays fast and ad-free</span></div>` +
      `<div><b>₹199+</b><span>Helps fund a whole new topic — like Spring Data JPA or Microservices</span></div></div>` +
      `<div class="support-grid"><div class="support-box">` +
      `<h2>Choose an amount</h2>` +
      `<div class="amount-chips" role="group" aria-label="Suggested amounts">` +
      amounts.map((a) => `<button type="button" class="amount-chip" data-amount="${a}" aria-pressed="false">₹${a}</button>`).join('') +
      `<button type="button" class="amount-chip" data-amount="" aria-pressed="true">Any amount</button></div>` +
      `<label class="amount-other"><span>Or enter your own (₹)</span><input id="amountInput" type="text" inputmode="decimal" placeholder="Any amount" autocomplete="off" aria-describedby="amountHint"></label>` +
      `<p class="amount-hint" id="amountHint">No minimum. Leave it empty to type the amount in your UPI app.</p>` +
      `<a class="btn btn-primary support-pay" id="payBtn" href="${upiLink('')}">Pay with UPI app</a>` +
      `<p class="support-small">Opens Google Pay, PhonePe, Paytm or any UPI app on your phone. On a computer, scan the QR code instead.</p></div>` +
      `<div class="support-box support-qr"><h2>Scan to pay</h2>` +
      `<img src="/${esc(SUPPORT.qr.replace(/^\/+/, ''))}" width="220" height="220" alt="UPI QR code for ${esc(SUPPORT.upi)}">` +
      `<div class="upi-id"><code>${esc(SUPPORT.upi)}</code><button type="button" class="btn" id="copyUpi">Copy UPI ID</button></div>` +
      `<p class="support-small">Scan with any UPI app and enter any amount.</p></div></div>` +
      `<div class="support-box support-other"><h2>Other ways to help</h2><ul>` +
      `<li>Share ${esc(SITE.name)} with a friend who's preparing for interviews.</li>` +
      `<li>Spotted a mistake or want a topic covered? Let us know.</li></ul></div>` +
      `<p class="support-thanks">${SUPPORT_BLESSING}</p>` +
      `<p class="support-fine">Payments go directly to the UPI ID above. Contributions are voluntary, give no extra access, and are not refundable or tax-deductible. Thank you! 💜</p>` +
      `</div>${footerHtml()}`;
    setView('support', null, html, 'Support', `Support ${SITE.name} with any amount via UPI — no minimum.`);
    window.scrollTo({ top: 0, behavior: 'instant' });

    const pay = $('#payBtn'), input = $('#amountInput'), chips = $$('.amount-chip');
    const setAmount = (value, fromChip) => {
      const ok = value === '' || (/^\d{1,6}(\.\d{1,2})?$/.test(value) && Number(value) > 0);
      const amount = ok && value ? Number(value).toFixed(2) : '';   // UPI apps expect two decimals
      const shown = amount.endsWith('.00') ? amount.slice(0, -3) : amount;
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      $('#amountHint').textContent = ok ? (amount ? `You'll pay ₹${shown}. You can still change it in your UPI app.` : 'No minimum. Leave it empty to type the amount in your UPI app.') : 'Enter an amount like 50 or 75.50.';
      pay.href = upiLink(amount);
      pay.textContent = amount ? `Pay ₹${shown} with UPI app` : 'Pay with UPI app';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(fromChip ? c.dataset.amount === value : value === '' && c.dataset.amount === '')));
    };
    chips.forEach((c) => c.addEventListener('click', () => { input.value = c.dataset.amount; setAmount(c.dataset.amount, true); }));
    input.addEventListener('input', () => setAmount(input.value.trim(), false));
    $('#copyUpi').addEventListener('click', () => copyText(SUPPORT.upi).then(() => toast('UPI ID copied')));
    // We can't see whether the payment went through, so the thank-you is for the intention.
    pay.addEventListener('click', () => setTimeout(() => toast('Dil se shukriya! 🙏 Thank you for supporting DevNotes 💜'), 400));
  }

  // Rotating, honest end-of-chapter messages. The variant is picked per chapter so it stays stable on revisits.
  const SUPPORT_CARD_LINES = [
    ['Concept clear hua? 😊', 'Wahi “aha!” moment ke liye yeh notes bane hain. If you’d like to keep them free for the next student, any amount helps — even ₹10.'],
    ['Interview ki taiyari chal rahi hai? All the best! 🙏', 'Hum aapke saath hain. If these notes saved you a few hours, a small contribution keeps them free, ad-free and growing.'],
    ['Kahin koi raat ko 1 baje yahi padh raha hai. 🌙', 'Hostel mein, PG mein, ya ghar pe — aapka chhota sa support uske liye bhi notes free rakhta hai.'],
    ['Na ads, na paywall, na sign-up.', 'Bas notes — readers ke pyaar aur support se chalte hain. If that’s you, dil se thank you 💜'],
    ['Gyaan baantne se badhta hai. 📚', 'If DevNotes has helped you, pay it forward with any amount. Sab naye topics mein jaata hai.'],
    ['Ghar walon ka sapna, aapki mehnat. 💪', 'Jab woh offer letter aaye, toh yaad rakhna yeh safar kahan se shuru hua. Support DevNotes — koi minimum nahi.'],
    ['Guru dakshina, apni marzi se. 🙏', 'Purane zamaane mein shishya apne guru ko jo de sake, wohi dete the. ₹10 ho ya ₹500 — har yogdaan keemti hai.'],
  ];

  // Short mid-chapter one-liners, shown between two sections halfway through a chapter.
  const SUPPORT_ONE_LINERS = [
    'Aadha chapter ho gaya — bas thoda aur! 💪 If DevNotes is helping, you can keep it free for the next learner with any amount.',
    'Ek cutting chai ke paise mein, kisi aur ki padhai free rehti hai. ☕ Even ₹10 helps.',
    'Placement season ka pressure samajh sakte hain. All the best! 🙏 A small contribution keeps these notes growing.',
    'Jo seekha hai, wohi aage badhta hai. If this chapter helped, pay it forward for the next student. 💜',
    'Interview clear ho jaaye, toh hamein bhi yaad karna! 😊 Support DevNotes with any amount you like.',
    'Free notes, no ads, no paywall — sab readers ke support se chalta hai. Thank you! 🙏',
    'Guru dakshina in any amount — ₹10 or ₹100 — keeps this guru going. 🙏',
    'Pehli salary aaye toh ek chai DevNotes ke naam? ☕ Or chip in today — no minimum.',
  ];

  function insertMidChapterNote(chapterIdx) {
    if (!SUPPORT) return;
    const sections = $$('#content > .note-section');
    if (sections.length < 4) return;
    const mid = sections[Math.floor(sections.length / 2) - 1];
    const note = document.createElement('aside');
    note.className = 'support-inline';
    note.setAttribute('aria-label', 'A message from DevNotes');
    note.innerHTML = `<div class="si-ornament" aria-hidden="true"><span></span>🪔<span></span></div>` +
      `<p class="si-blessing">${SUPPORT_BLESSING}</p>` +
      `<p class="si-line">${esc(SUPPORT_ONE_LINERS[chapterIdx % SUPPORT_ONE_LINERS.length])}</p>` +
      `<a class="si-btn" href="/support/">💜 Support DevNotes</a>`;
    mid.after(note);
  }

  const SUPPORT_BLESSING = 'Aap support karein ya na karein — yahan padhne ke liye dil se shukriya. Bhagwan kare aapko woh dream job mile. 🙏💜';

  function supportCardHtml(chapterIdx) {
    if (!SUPPORT) return '';
    const readCount = readSet().size;
    const [title, body] = readCount >= 3 && chapterIdx % 2 === 0
      ? [`Wah! ${readCount} chapters ho gaye 🌱`, 'Yeh asli mehnat hai — proud of you! If DevNotes has been part of your journey, help keep it free for the next learner — any amount, no minimum.']
      : SUPPORT_CARD_LINES[chapterIdx % SUPPORT_CARD_LINES.length];
    return `<aside class="support-card"><div><b>${esc(title)}</b><span>${esc(body)}</span></div><a class="btn" href="/support/">💜 Support</a></aside>`;
  }

  // Shown once per topic, the moment the reader finishes its last chapter.
  function maybeAskForSupport(topic) {
    if (!SUPPORT || store.get('supportAsked:' + topic.id, false)) return;
    store.set('supportAsked:' + topic.id, true);
    const wrap = document.createElement('div');
    wrap.className = 'support-modal';
    wrap.innerHTML = `<div class="support-dialog" role="dialog" aria-modal="true" aria-labelledby="supportTitle">` +
      `<div class="support-emoji" aria-hidden="true">🎉</div><h2 id="supportTitle">You finished ${esc(topic.name)}!</h2>` +
      `<p>Saare ${topic.chapters.length} chapters! Yeh asli mehnat hai — aapke ghar wale bhi proud honge. 🙌</p>` +
      `<p>Agar in notes ne aapki madad ki, toh thoda sa aage badhayein? ₹10, ₹50, jo bhi dil kare — taaki kisi aur student ko bhi yeh free mile, jaise aapko mila.</p>` +
      `<div class="support-actions"><a class="btn btn-primary" href="/support/">💜 Guru dakshina dein</a><button type="button" class="btn" data-close>Baad mein</button></div>` +
      `<p class="support-small">Jo bhi ho — bahut bahut badhai, aur aage ke liye all the best! 🎉</p></div>`;
    const close = () => { wrap.remove(); removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]') || e.target.closest('a')) close(); });
    addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    $('.support-dialog .btn-primary', wrap).focus();
  }

  function renderChapter(key, section) {
    const info = lookupKey(key);
    cleanup.forEach((fn) => fn()); cleanup = [];
    if (!info) return renderNotFound();
    const { track, topic, chapter } = info;
    const idx = topic.chapters.indexOf(chapter);
    const prev = topic.chapters[idx - 1], next = topic.chapters[idx + 1];
    const done = isRead(key);
    filter = 'all';
    store.set('last', key);

    const navCard = (c, dir) => c
      ? `<a class="footer-nav ${dir}" href="${u(chapterKey(track, topic, c))}"><small>${dir === 'prev' ? '← Previous' : 'Next →'}</small><b>${esc(c.title)}</b></a>`
      : `<span class="footer-nav ${dir} disabled"><small>${dir === 'prev' ? 'Start' : 'End'}</small><b>${dir === 'prev' ? 'First chapter' : esc(topic.name) + ' complete'}</b></span>`;

    const html = `<div class="reader"><article class="reader-main">` +
      `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${u(track.id)}">${esc(track.name)}</a><span class="sep">/</span><a href="${u(track.id + "/" + topic.id)}">${esc(topic.name)}</a><span class="sep">/</span><b>${esc(chapter.title)}</b></nav>` +
      `<header class="reader-head"><div><div class="eyebrow">${esc(topic.name)} · Chapter ${pad(idx + 1)}</div><h1>${esc(chapter.title)}</h1><p class="subtitle">${esc(chapter.subtitle)}</p>` +
      `<div class="meta"><span>◷ ${chapter.readMin} min read</span><span>§ ${chapter.sections} sections</span><span>? ${chapter.questions} interview questions</span><span>{ } ${chapter.examples} code examples</span></div></div>` +
      `<button class="complete-btn${done ? ' done' : ''}" id="completeBtn" type="button" aria-pressed="${done}">${done ? '✓ Completed' : '○ Mark as read'}</button></header>` +
      `<div class="tabs-bar"><div class="tabs" role="tablist">${TABS.map((t) => `<button class="tab${t.id === 'all' ? ' active' : ''}" role="tab" type="button" data-filter="${t.id}" aria-selected="${t.id === 'all'}">${t.label}<span class="count" data-count="${t.id}"></span></button>`).join('')}</div>` +
      `<button class="practice-btn" id="practiceBtn" type="button" aria-pressed="false" title="Hide answers to test yourself">🎯 <span class="lbl">Practice mode</span></button></div>` +
      `<details class="mobile-toc"><summary>On this page</summary><nav id="mobileToc"></nav></details>` +
      `<div class="content" id="content">${PRE && PRE.route === key && PRE.content ? PRE.content : '<div class="skeleton" style="width:40%;height:26px"></div><div class="skeleton"></div><div class="skeleton" style="width:85%"></div><div class="skeleton" style="width:70%"></div>'}</div>` +
      supportCardHtml(idx) +
      `<nav class="chapter-footer" aria-label="Chapter navigation">${navCard(prev, 'prev')}${navCard(next, 'next')}</nav></article>` +
      `<aside class="rail" aria-label="On this page"><div class="rail-inner"><div class="rail-card"><div class="rail-title">On this page</div><nav id="tocLinks"></nav></div>` +
      (next ? `<div class="rail-card"><div class="rail-title">Study this next</div><a class="next-link" href="${u(chapterKey(track, topic, next))}">${esc(next.title)} →</a></div>` : '') +
      `<div class="rail-card tip-card"><b>Interview tip</b><p>Answer in layers: definition → internal working → example → edge case → where you used it in production.</p></div></div></aside></div>${footerHtml()}`;

    setView('chapter', key, html, chapter.title, chapter.subtitle);
    window.scrollTo({ top: 0, behavior: 'instant' });

    $('#completeBtn').addEventListener('click', (e) => {
      const nowDone = toggleRead(key);
      e.currentTarget.classList.toggle('done', nowDone);
      e.currentTarget.setAttribute('aria-pressed', nowDone);
      e.currentTarget.textContent = nowDone ? '✓ Completed' : '○ Mark as read';
      renderSidebar();
      if (nowDone) toast(next ? `Nice! Next up: ${next.title}` : `${topic.name} complete 🎉`);
      if (nowDone && topicProgress(track, topic).done === topic.chapters.length) maybeAskForSupport(topic);
    });

    loadChapter(key).then((data) => {
      if (current.key !== key) return;
      $('#content').innerHTML = data.html;
      insertMidChapterNote(idx);
      const tocHtml = data.toc.map((s, i) => `<a class="toc-link" href="${u(key)}#${s.id}" data-id="${s.id}">${i + 1}. ${esc(s.title)}${s.kind === 'interview' ? '<span class="k">Q&amp;A</span>' : ''}</a>`).join('');
      $('#tocLinks').innerHTML = tocHtml;
      $('#mobileToc').innerHTML = tocHtml;
      const counts = { code: chapter.examples, interview: chapter.questions };
      $$('[data-count]').forEach((el) => { const c = counts[el.dataset.count]; el.textContent = c || ''; el.hidden = !c; });
      wireReader(key);
      if (section) requestAnimationFrame(() => scrollToSection(section, false));
    }).catch(() => {
      $('#content').innerHTML = `<div class="filter-empty">Couldn't load this chapter. Check your connection and refresh the page.</div>`;
    });
  }

  function applyFilter() {
    const sections = $$('.note-section');
    let shown = 0;
    sections.forEach((el) => {
      const ok = filter === 'all' || (filter === 'code' ? el.dataset.code === '1' : el.dataset.kind === filter);
      el.hidden = !ok;
      if (ok) shown++;
    });
    $$('.support-inline').forEach((el) => { el.hidden = filter !== 'all'; });
    let empty = $('#filterEmpty');
    if (!shown) {
      if (!empty) { empty = document.createElement('div'); empty.id = 'filterEmpty'; empty.className = 'filter-empty'; $('#content').appendChild(empty); }
      empty.textContent = 'Nothing in this view for this chapter.';
    } else if (empty) empty.remove();
    $$('.tab').forEach((t) => { const on = t.dataset.filter === filter; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    $$('.toc-link').forEach((a) => { const sec = document.getElementById(a.dataset.id); a.hidden = !!(sec && sec.hidden); });
  }

  function wireReader(key) {
    $$('.tab').forEach((t) => t.addEventListener('click', () => { filter = t.dataset.filter; applyFilter(); const c = $('.tabs-bar'); if (c.getBoundingClientRect().top < 64) window.scrollTo({ top: $('#content').offsetTop - 130 }); }));

    const practice = $('#practiceBtn');
    practice.addEventListener('click', () => {
      const on = practice.getAttribute('aria-pressed') !== 'true';
      practice.setAttribute('aria-pressed', on);
      $$('.qa').forEach((d) => { d.open = !on; });
      if (on && filter !== 'interview' && $$('.note-section[data-kind="interview"]').length) { filter = 'interview'; applyFilter(); }
      toast(on ? 'Practice mode: answers hidden. Click a question to reveal.' : 'Answers shown');
    });

    $('#content').addEventListener('click', (e) => {
      const copy = e.target.closest('.copy-btn');
      if (copy) {
        const code = copy.closest('.code-block').querySelector('pre').innerText;
        copyText(code).then(() => { copy.textContent = 'Copied ✓'; setTimeout(() => { copy.textContent = 'Copy'; }, 1300); });
        return;
      }
      const anchor = e.target.closest('.anchor');
      if (anchor) {
        e.preventDefault();
        const url = `${location.origin}${u(key)}#${anchor.dataset.sec}`;
        history.replaceState(null, '', `${u(key)}#${anchor.dataset.sec}`);
        copyText(url).then(() => toast('Link to section copied'));
        scrollToSection(anchor.dataset.sec, true);
      }
    });

    // scrollspy + reading progress
    const links = $$('#tocLinks .toc-link');
    const sections = $$('.note-section');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        const max = doc.scrollHeight - innerHeight;
        setProgressBar(max > 0 ? (scrollY / max) * 100 : 0);
        let active = null;
        for (const s of sections) { if (!s.hidden && s.getBoundingClientRect().top < 150) active = s.id; }
        if (!active && sections[0]) active = sections[0].id;
        links.forEach((a) => a.classList.toggle('active', a.dataset.id === active));
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => removeEventListener('scroll', onScroll));
    onScroll();
  }

  function scrollToSection(id, smooth) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.hidden) { filter = 'all'; applyFilter(); }
    if (el.tagName === 'DETAILS') el.open = true;
    const top = el.getBoundingClientRect().top + scrollY - 124;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
    const mt = $('.mobile-toc'); if (mt) mt.open = false;
  }

  function setProgressBar(pct) { $('#readProgress').style.width = Math.min(100, Math.max(0, pct)) + '%'; }

  // ------------------------------------------------------------ search
  const input = $('#searchInput');
  const results = $('#searchResults');
  let searchReady = null;
  let selected = -1;
  function ensureIndex() {
    if (!searchReady) searchReady = window.DEVNOTES_SEARCH ? Promise.resolve() : loadScript('/data/search-index.js');
    return searchReady;
  }
  function snippet(text, terms) {
    const lower = text.toLowerCase();
    let at = -1;
    for (const t of terms) { at = lower.indexOf(t); if (at >= 0) break; }
    if (at < 0) return esc(text.slice(0, 140)) + (text.length > 140 ? '…' : '');
    const start = Math.max(0, at - 50);
    let s = (start ? '…' : '') + text.slice(start, start + 160) + (start + 160 < text.length ? '…' : '');
    s = esc(s);
    for (const t of terms) s = s.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
    return s;
  }
  function runSearch(q) {
    const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1 || /\W/.test(t));
    if (!terms.length) { closeSearch(); return; }
    const hits = [];
    for (const doc of window.DEVNOTES_SEARCH || []) {
      const info = lookupKey(doc.k);
      if (!info) continue;
      const titleL = doc.t.toLowerCase();
      for (const [id, heading, text] of doc.s) {
        const h = heading.toLowerCase(), b = text.toLowerCase();
        let score = 0, all = true;
        for (const t of terms) {
          const inTitle = titleL.includes(t), inHead = h.includes(t), inBody = b.includes(t);
          if (!inTitle && !inHead && !inBody) { all = false; break; }
          score += (inTitle ? 6 : 0) + (inHead ? 10 : 0) + (inBody ? 1 + Math.min(4, b.split(t).length - 1) : 0);
        }
        if (all) hits.push({ doc, info, id, heading, text, score });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, 10);
    selected = top.length ? 0 : -1;
    results.innerHTML = top.length
      ? top.map((h, i) => `<a class="sr-item${i === 0 ? ' active' : ''}" role="option" href="${u(h.doc.k)}#${h.id}">` +
          `<div class="sr-path"><b>${esc(h.info.topic.name)}</b><span>›</span><span>${esc(h.doc.t)}</span></div>` +
          `<div class="sr-title">${esc(h.heading)}</div><div class="sr-snippet">${snippet(h.text, terms)}</div></a>`).join('')
      : `<div class="sr-empty">No results for “${esc(q)}”</div>`;
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function closeSearch() { results.hidden = true; input.setAttribute('aria-expanded', 'false'); selected = -1; }
  let searchTimer = 0;
  input.addEventListener('focus', ensureIndex);
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) return closeSearch();
    searchTimer = setTimeout(() => ensureIndex().then(() => runSearch(q)).catch(() => {
      results.innerHTML = '<div class="sr-empty">Search is unavailable right now.</div>'; results.hidden = false;
    }), 90);
  });
  input.addEventListener('keydown', (e) => {
    const items = $$('.sr-item', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === selected));
      items[selected].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (items[selected]) { e.preventDefault(); navigate(items[selected].getAttribute('href')); input.value = ''; input.blur(); }
    } else if (e.key === 'Escape') { closeSearch(); input.blur(); }
  });
  results.addEventListener('click', (e) => { if (e.target.closest('.sr-item')) { input.value = ''; input.blur(); closeSearch(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('#search')) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape') closeSidebar();
  });

  // ------------------------------------------------------------ theme, sidebar drawer, misc
  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    const nextTheme = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', nextTheme);
    try { localStorage.setItem('devnotes:theme', nextTheme); } catch (e) { /* ignore */ }
  });

  const sidebar = $('#sidebar'), scrim = $('#scrim'), menuBtn = $('#menuBtn');
  function openSidebar() { sidebar.classList.add('open'); scrim.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeSidebar() { sidebar.classList.remove('open'); scrim.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', () => (sidebar.classList.contains('open') ? closeSidebar() : openSidebar()));
  scrim.addEventListener('click', closeSidebar);

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }
  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) route(); });
  route();
})();
