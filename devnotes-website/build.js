#!/usr/bin/env node
/*
 * DevNotes build script — zero dependencies (Node 16+).
 *
 *   content/catalog.json                 tracks + topics shown on the site
 *   content/<track>/<topic>/NN-slug.md   one Markdown file per chapter
 *
 * Output goes to site/data/ (catalog.js, search-index.js, one .js per chapter).
 * The site/ folder is the deployable website.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'site', 'data');

// ---------------------------------------------------------------- utilities

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

const stripTags = (html) => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

// ---------------------------------------------------------------- inline markdown

function inline(text) {
  const codes = [];
  const escapes = [];
  let s = String(text).replace(/\\([*_`\\|{}])/g, (_, c) => { escapes.push(c); return `\u0001${escapes.length - 1}\u0001`; });
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${u}"${ext}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => esc(escapes[+i]));
  return s;
}

// ---------------------------------------------------------------- syntax highlighting

const JAVA_KEYWORDS = new Set(('abstract assert boolean break byte case catch char class const continue default do double ' +
  'else enum extends final finally float for goto if implements import instanceof int interface long native new ' +
  'package private protected public return short static strictfp super switch synchronized this throw throws ' +
  'transient try void volatile while var record sealed permits non-sealed yield true false null').split(' '));

function highlight(code, lang) {
  if (!['java', 'json', 'js', 'javascript', 'sql'].includes(lang)) return esc(code);
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*")|('(?:\\.|[^'\\\n])')|(@[A-Za-z_]\w*)|(\b\d[\d_]*(?:\.\d+)?[lLfFdD]?\b)|(\bnon-sealed\b|\b[A-Za-z_$][\w$]*\b)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [tok] = m;
    let cls = '';
    if (m[1]) cls = 'c';
    else if (m[2] || m[3]) cls = 's';
    else if (m[4]) cls = 'a';
    else if (m[5]) cls = 'n';
    else if (m[6]) {
      const after = code.slice(re.lastIndex).match(/^\s*\(/);
      if (JAVA_KEYWORDS.has(tok)) cls = 'k';
      else if (after) cls = 'f';
      else if (/^[A-Z]/.test(tok)) cls = 't';
    }
    out += cls ? `<span class="tk-${cls}">${esc(tok)}</span>` : esc(tok);
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

const LANG_LABEL = { java: 'Java', json: 'JSON', text: 'Text', sql: 'SQL', bash: 'Shell', js: 'JavaScript' };

function renderCode(lang, title, code) {
  lang = (lang || 'text').toLowerCase();
  code = code.replace(/\s+$/, '');
  if (lang === 'output' || lang === 'console') {
    return `<div class="code-block is-output"><div class="code-head"><span class="code-lang">${esc(title || 'Output')}</span></div>` +
      `<pre><code>${esc(code)}</code></pre></div>`;
  }
  const label = title || LANG_LABEL[lang] || lang.toUpperCase();
  return `<div class="code-block" data-lang="${esc(lang)}"><div class="code-head"><span class="code-lang">${esc(label)}</span>` +
    `<button class="copy-btn" type="button" aria-label="Copy code">Copy</button></div>` +
    `<pre><code>${highlight(code, lang)}</code></pre></div>`;
}

// ---------------------------------------------------------------- diagrams

const caption = (c) => (c ? `<figcaption>${inline(c)}</figcaption>` : '');

function nodeHtml(text, cls = 'node') {
  let badge = '';
  text = text.replace(/\s*\{([^}]+)\}\s*$/, (_, b) => { badge = `<span class="badge badge-${slugify(b)}">${esc(b)}</span>`; return ''; });
  const parts = text.split(/\s+\|\s+/);
  const head = `<span class="node-title">${inline(parts[0])}${badge}</span>`;
  const rest = parts.slice(1).map((p) => `<span class="node-sub">${inline(p)}</span>`).join('');
  return `<div class="${cls}">${head}${rest}</div>`;
}

function renderFlow(kind, cap, lines) {
  const dir = kind === 'flow-h' ? 'h' : kind === 'flow-up' ? 'up' : 'v';
  const arrowChar = dir === 'h' ? '→' : dir === 'up' ? '↑' : '↓';
  const cols = [[]];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === '---' && dir !== 'h') { cols.push([]); continue; }
    cols[cols.length - 1].push(line);
  }
  const renderCol = (items) => {
    let html = '', pendingLabel = null, first = true, both = false;
    for (const it of items) {
      if (it.startsWith(': ')) { pendingLabel = it.slice(2); continue; }
      if (it === '<->') { both = true; continue; }
      if (!first) {
        const ch = both ? (dir === 'h' ? '⇄' : '⇅') : arrowChar;
        html += `<div class="flow-arrow" aria-hidden="true"><span>${ch}</span>${pendingLabel ? `<em>${inline(pendingLabel)}</em>` : ''}</div>`;
      }
      pendingLabel = null;
      both = false;
      first = false;
      if (it.startsWith('? ')) {
        // decision: "? Question | Yes: outcome | No: outcome"
        const [q, ...branches] = it.slice(2).split(/\s+\|\s+/);
        html += `<div class="node decision"><span class="node-title">${inline(q)}</span></div><div class="branches">` +
          branches.map((br) => {
            const m = br.match(/^([^:]+):\s*(.*)$/);
            const label = m ? m[1] : '', target = m ? m[2] : br;
            return `<div class="branch"><div class="flow-arrow" aria-hidden="true"><span>${dir === 'h' ? '→' : '↓'}</span>${label ? `<em>${inline(label)}</em>` : ''}</div>${nodeHtml(target)}</div>`;
          }).join('') + `</div>`;
        continue;
      }
      html += nodeHtml(it);
    }
    return html;
  };
  const body = cols.filter((c) => c.length)
    .map((c) => `<div class="flow-col">${renderCol(c)}</div>`).join('');
  return `<figure class="diagram flow flow-${dir}${cols.length > 1 ? ' flow-multi' : ''}"><div class="flow-cols">${body}</div>${caption(cap)}</figure>`;
}

function renderTree(cap, lines) {
  const root = { children: [] };
  const stack = [{ indent: -1, node: root }];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const node = { text: raw.trim(), children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent, node });
  }
  let maxKids = 0, leaves = 0, longSub = false;
  (function walk(n) {
    maxKids = Math.max(maxKids, n.children.length);
    if (!n.children.length) leaves++;
    if (n.text && n.text.includes(' | ')) longSub = true;
    n.children.forEach(walk);
  })(root);
  const chart = maxKids <= 4 && leaves <= 6 && !(longSub && maxKids > 3);
  const render = (nodes) => `<ul>${nodes.map((n) =>
    `<li>${nodeHtml(n.text)}${n.children.length ? render(n.children) : ''}</li>`).join('')}</ul>`;
  return `<figure class="diagram tree ${chart ? 'tree-chart' : 'tree-outline'}"><div class="tree-scroll">${render(root.children)}</div>${caption(cap)}</figure>`;
}

function renderRefs(cap, lines) {
  const rows = lines.filter((l) => l.trim()).map((l) => {
    const [left, right = ''] = l.split(/\s*->\s*/);
    const vars = left.split(/\s*,\s*(?![^()]*\))/).map((v) => {
      const m = v.match(/^(.+?)\s*=\s*(.+)$/);
      return m
        ? `<span class="ref-var"><b>${inline(m[1])}</b><span class="ref-val">${inline(m[2])}</span></span>`
        : `<span class="ref-var"><b>${inline(v)}</b></span>`;
    }).join('');
    return `<div class="ref-row"><div class="ref-vars">${vars}</div><div class="ref-arrow" aria-hidden="true"></div>${nodeHtml(right, 'node ref-obj')}</div>`;
  }).join('');
  return `<figure class="diagram refs">${rows}${caption(cap)}</figure>`;
}

function renderBuckets(cap, lines, kind = 'buckets') {
  const isArray = kind === 'array';
  const cells = lines.filter((l) => l.trim()).map((l) => {
    const i = l.indexOf(':');
    const label = l.slice(0, i).trim();
    const items = l.slice(i + 1).split(/\s*,\s*(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);
    const empty = isArray ? '<span class="empty">null</span>' : '<span class="empty">empty</span>';
    return `<div class="bucket${items.length ? ' filled' : ''}${!isArray && items.length > 1 ? ' collision' : ''}">` +
      `<div class="bucket-label">${isArray ? `[${esc(label)}]` : /^\d+$/.test(label) ? `Bucket ${esc(label)}` : inline(label)}</div>` +
      `<div class="bucket-items">${items.map((it) => `<span>${inline(it)}</span>`).join('') || empty}</div></div>`;
  }).join('');
  return `<figure class="diagram buckets${isArray ? ' is-array' : ''}"><div class="bucket-row">${cells}</div>${caption(cap)}</figure>`;
}

// ---------------------------------------------------------------- block parser

function parseBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const isTableSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l || '');
  const startsBlock = (l, next) => /^```/.test(l) || /^#{2,4}\s/.test(l) || /^>/.test(l) ||
    /^\s*([-*]|\d+\.)\s+/.test(l) || (/^\s*\|/.test(l) && isTableSep(next)) || /^---\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m = line.match(/^```\s*([\w-]*)\s*(.*)$/);
    if (m) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'fence', lang: m[1], info: m[2].trim(), body });
      continue;
    }
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      blocks.push({ type: 'h', level: m[1].length, text: m[2].trim() });
      i++; continue;
    }
    if (/^---\s*$/.test(line)) { i++; continue; }
    if (/^>/.test(line)) {
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', body });
      continue;
    }
    if (/^\s*\|/.test(line) && isTableSep(lines[i + 1])) {
      const split = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = split(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(split(lines[i++]));
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    if ((m = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/))) {
      const ordered = /\d/.test(m[1]);
      const items = [];
      while (i < lines.length) {
        const lm = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (lm) { items.push(lm[2]); i++; continue; }
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i], lines[i + 1]))) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

const CALLOUT_LABEL = { TIP: 'Tip', NOTE: 'Note', WARNING: 'Watch out', IMPORTANT: 'Important', QUESTION: 'Interview question' };

function renderBlock(b) {
  switch (b.type) {
    case 'p': return `<p>${inline(b.text)}</p>`;
    case 'h': return `<h${b.level} id="${b.id || slugify(b.text)}">${inline(b.text)}</h${b.level}>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      const items = b.items.map((it) => {
        let cls = '';
        const t = it.replace(/^(✅|✔|❌)\s*/, (_, mk) => { cls = mk === '❌' ? ' class="li-no"' : ' class="li-yes"'; return ''; });
        return `<li${cls}>${inline(t)}</li>`;
      }).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'table': {
      const head = b.head.map((c) => `<th>${inline(c)}</th>`).join('');
      const rows = b.rows.map((r) => `<tr>${b.head.map((_, j) => `<td>${inline(r[j] || '')}</td>`).join('')}</tr>`).join('');
      return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'quote': {
      const m = b.body[0].match(/^\[!(\w+)\]\s*(.*)$/);
      if (m) {
        const type = m[1].toUpperCase();
        const title = m[2] ? inline(m[2]) : CALLOUT_LABEL[type] || type;
        const body = b.body.slice(1).filter((l) => l.trim()).map((l) => inline(l)).join('<br>');
        return `<aside class="callout callout-${type.toLowerCase()}"><div class="callout-title">` +
          `<span class="callout-kind">${CALLOUT_LABEL[type] || type}</span>${m[2] ? `<strong>${title}</strong>` : ''}</div>` +
          (body ? `<div class="callout-body">${body}</div>` : '') + `</aside>`;
      }
      return `<blockquote>${b.body.filter((l) => l.trim()).map((l) => inline(l)).join('<br>')}</blockquote>`;
    }
    case 'fence': {
      const k = b.lang.toLowerCase();
      if (k === 'flow' || k === 'flow-h' || k === 'flow-up') return renderFlow(k, b.info, b.body);
      if (k === 'tree') return renderTree(b.info, b.body);
      if (k === 'refs') return renderRefs(b.info, b.body);
      if (k === 'buckets' || k === 'array') return renderBuckets(b.info, b.body, k);
      return renderCode(k, b.info, b.body.join('\n'));
    }
    default: return '';
  }
}

function sectionKind(title) {
  if (/quick revision|cheat sheet|chapter summary/i.test(title)) return 'summary';
  if (/interview|questions?\b|scenarios?\b|traps?\b/i.test(title)) return 'interview';
  return 'concept';
}

function renderChapter(md) {
  const blocks = parseBlocks(md);
  const sections = [];
  let cur = null;
  const used = new Set();
  const uid = (t) => { let s = slugify(t), n = 2; const base = s; while (used.has(s)) s = `${base}-${n++}`; used.add(s); return s; };

  for (const b of blocks) {
    if (b.type === 'h' && b.level === 2) {
      cur = { id: uid(b.text), title: b.text, kind: sectionKind(b.text), blocks: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) { cur = { id: uid('introduction'), title: 'Introduction', kind: 'concept', blocks: [] }; sections.push(cur); }
    if (b.type === 'h') b.id = uid(`${cur.id}-${b.text}`);
    cur.blocks.push(b);
  }

  let questions = 0, examples = 0;
  const html = sections.map((sec, idx) => {
    let body = '';
    if (sec.kind === 'interview' && sec.blocks.some((b) => b.type === 'h' && b.level === 3)) {
      let open = false, n = 0;
      for (const b of sec.blocks) {
        if (b.type === 'h' && b.level === 3) {
          if (open) body += '</div></details>';
          const m = b.text.match(/^(Q\d+)[.:]?\s*(.*)$/);
          n++;
          const num = m ? m[1] : `Q${n}`;
          const q = m ? m[2] : b.text;
          questions++;
          body += `<details class="qa" open id="${b.id}"><summary><span class="qa-num">${esc(num)}</span><span class="qa-q">${inline(q)}</span></summary><div class="qa-a">`;
          open = true;
        } else body += renderBlock(b);
      }
      if (open) body += '</div></details>';
    } else {
      body = sec.blocks.map(renderBlock).join('');
    }
    const hasCode = sec.blocks.some((b) => b.type === 'fence' && ['java', 'json', 'sql'].includes(b.lang.toLowerCase()));
    if (hasCode) examples += sec.blocks.filter((b) => b.type === 'fence' && b.lang.toLowerCase() === 'java').length;
    questions += sec.blocks.filter((b) => b.type === 'quote' && /^\[!QUESTION\]/i.test(b.body[0])).length;
    const extra = /common mistakes/i.test(sec.title) ? ' is-mistakes' : /best practices|advantages/i.test(sec.title) ? ' is-best' : '';
    sec.hasCode = hasCode;
    sec.html = body;
    return `<section class="note-section kind-${sec.kind}${extra}" id="${sec.id}" data-kind="${sec.kind}" data-code="${hasCode ? 1 : 0}">` +
      `<h2><a class="anchor" href="#" data-sec="${sec.id}" aria-label="Link to this section">#</a>${inline(sec.title)}</h2>${body}</section>` +
      (idx < sections.length - 1 ? '' : '');
  }).join('');

  const words = stripTags(html).split(' ').length;
  return {
    html,
    toc: sections.map((s) => ({ id: s.id, title: stripTags(inline(s.title)), kind: s.kind, code: s.hasCode })),
    search: sections.map((s) => [s.id, stripTags(inline(s.title)),
      stripTags(s.html.replace(/<div class="code-head">[\s\S]*?<\/div>/g, ' ').replace(/<span class="qa-num">[^<]*<\/span>/g, ' '))]),
    readMin: Math.max(2, Math.round(words / 200)),
    questions,
    examples,
  };
}

// ---------------------------------------------------------------- build

function build() {
  const catalog = JSON.parse(fs.readFileSync(path.join(CONTENT, 'catalog.json'), 'utf8'));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const searchIndex = [];
  let chapterCount = 0;

  for (const track of catalog.tracks) {
    for (const topic of track.topics) {
      const dir = path.join(CONTENT, track.id, topic.id);
      topic.chapters = [];
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
      for (const file of files) {
        const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(dir, file), 'utf8'));
        const slug = meta.slug || file.replace(/\.md$/, '').replace(/^\d+[-_]/, '');
        const key = `${track.id}/${topic.id}/${slug}`;
        const r = renderChapter(body);
        const chapter = {
          slug,
          title: meta.title || slug,
          subtitle: meta.subtitle || '',
          order: Number(meta.order) || topic.chapters.length + 1,
          readMin: r.readMin,
          questions: r.questions,
          examples: r.examples,
          sections: r.toc.length,
        };
        topic.chapters.push(chapter);
        const outDir = path.join(OUT, track.id, topic.id);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `${slug}.js`),
          `DevNotes.register(${JSON.stringify(key)},${JSON.stringify({ html: r.html, toc: r.toc })});\n`);
        searchIndex.push({ k: key, t: chapter.title, s: r.search });
        chapterCount++;
      }
      topic.chapters.sort((a, b) => a.order - b.order);
      if (topic.chapters.length && topic.status !== 'soon') topic.status = 'live';
    }
  }

  catalog.builtAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'catalog.js'), `window.DEVNOTES_CATALOG=${JSON.stringify(catalog)};\n`);
  fs.writeFileSync(path.join(OUT, 'search-index.js'), `window.DEVNOTES_SEARCH=${JSON.stringify(searchIndex)};\n`);
  console.log(`Built ${chapterCount} chapter(s) into ${path.relative(ROOT, OUT)}`);
}

build();
