#!/usr/bin/env node
/*
 * DevNotes build script — zero dependencies (Node 16+).
 *
 *   content/catalog.json                 tracks + topics shown on the site
 *   content/<track>/<topic>/NN-slug.md   one Markdown file per chapter
 *
 * Output goes to site/data/ (catalog.js, search-index.js, one .js per chapter), plus a pre-rendered
 * index.html for every page (so search engines and AdSense see real content), sitemap.xml,
 * robots.txt, ads.txt and 404.html. Page layout lives in templates/page.html.
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
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
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

const SQL_KEYWORDS = new Set(('select from where and or not in is null like between exists distinct as on join inner left right ' +
  'full outer cross natural using group by having order asc desc limit offset union all intersect except insert into values ' +
  'update set delete create alter drop truncate rename table database schema view index unique primary foreign key references ' +
  'constraint check default auto_increment if case when then else end with recursive over partition rows range preceding ' +
  'following unbounded current row begin commit rollback savepoint transaction start isolation level read write committed ' +
  'uncommitted repeatable serializable lock for share procedure function returns return declare call trigger each before ' +
  'after cascade restrict no action add column modify change engine charset collate replace ignore duplicate explain analyze ' +
  'show describe use grant revoke true false unsigned signed deterministic sql security definer invoker materialized ' +
  'temporary leave loop while repeat until do iterate open close fetch cursor handler continue exit condition signal ' +
  'interval div mod regexp rlike escape any some window lateral generated always virtual stored fulltext spatial ' +
  'int integer bigint smallint tinyint mediumint decimal numeric float double real bit boolean bool char varchar text ' +
  'tinytext mediumtext longtext blob binary varbinary enum json date datetime timestamp time year').split(' '));

function highlightSql(code) {
  const re = /(--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|\\.|[^'\\])*'|"(?:\\.|[^"\\\n])*")|(`[^`\n]*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w$]*\b)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [tok] = m;
    let cls = '';
    if (m[1]) cls = 'c';
    else if (m[2]) cls = 's';
    else if (m[3]) cls = 't';
    else if (m[4]) cls = 'n';
    else if (m[5]) {
      if (SQL_KEYWORDS.has(tok.toLowerCase())) cls = 'k';
      else if (/^\s*\(/.test(code.slice(re.lastIndex))) cls = 'f';
    }
    out += cls ? `<span class="tk-${cls}">${esc(tok)}</span>` : esc(tok);
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

function highlight(code, lang) {
  if (lang === 'sql' || lang === 'mysql') return highlightSql(code);
  if (!['java', 'json', 'js', 'javascript'].includes(lang)) return esc(code);
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

// Callout body: consecutive lines join with <br>, blank lines start a new paragraph,
// and "- " lines become a bullet list.
function calloutBody(lines) {
  const parts = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) parts.push(para.map((l) => inline(l)).join('<br>')); para = []; };
  const flushList = () => { if (list.length) parts.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`); list = []; };
  for (const l of lines) {
    const item = l.match(/^\s*[-*]\s+(.*)$/);
    if (item) { flushPara(); list.push(item[1]); }
    else if (!l.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(l); }
  }
  flushPara(); flushList();
  return parts.map((p) => (p.startsWith('<ul>') ? p : `<p>${p}</p>`)).join('');
}

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
        const body = calloutBody(b.body.slice(1));
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
    if (hasCode) examples += sec.blocks.filter((b) => b.type === 'fence' && ['java', 'sql'].includes(b.lang.toLowerCase())).length;
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
  const chapterHtml = {};
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
        chapterHtml[key] = r.html;
        chapterCount++;
      }
      topic.chapters.sort((a, b) => a.order - b.order);
      if (topic.chapters.length && topic.status !== 'soon') topic.status = 'live';
    }
  }

  catalog.builtAt = new Date().toISOString().slice(0, 10);

  // Static pages (About, Contact, Privacy Policy, Terms) from content/pages/*.md
  const site = catalog.site || {};
  const vars = {
    siteName: site.name || 'DevNotes',
    siteUrl: siteUrl(site),
    contactEmail: site.contactEmail || 'the email address shown on our Contact page (coming soon)',
    chapterCount: String(chapterCount),
  };
  const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  catalog.pages = [];
  const pagesDir = path.join(CONTENT, 'pages');
  const pageHtml = {};
  if (fs.existsSync(pagesDir)) {
    fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
    for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md'))) {
      const { meta, body } = parseFrontMatter(fill(fs.readFileSync(path.join(pagesDir, file), 'utf8')));
      const slug = file.replace(/\.md$/, '');
      const html = renderChapter(body).html;
      pageHtml[slug] = html;
      catalog.pages.push({ slug, title: meta.title || slug, description: meta.description || '', order: Number(meta.order) || 99, updated: meta.updated || catalog.builtAt });
      fs.writeFileSync(path.join(OUT, 'pages', `${slug}.js`), `DevNotes.register(${JSON.stringify('pages/' + slug)},${JSON.stringify({ html, toc: [] })});\n`);
    }
    catalog.pages.sort((a, b) => a.order - b.order);
  }

  fs.writeFileSync(path.join(OUT, 'catalog.js'), `window.DEVNOTES_CATALOG=${JSON.stringify(catalog)};\n`);
  fs.writeFileSync(path.join(OUT, 'search-index.js'), `window.DEVNOTES_SEARCH=${JSON.stringify(searchIndex)};\n`);
  console.log(`Built ${chapterCount} chapter(s) into ${path.relative(ROOT, OUT)}`);

  const pages = prerender(catalog, chapterHtml, pageHtml);
  console.log(`Pre-rendered ${pages} HTML page(s), sitemap.xml, robots.txt${site.adsenseClient ? ', ads.txt' : ''} and 404.html`);
  if (!site.url) console.warn('  ⚠ site.url is not set in content/catalog.json — canonical URLs and the sitemap use a placeholder.');
  if (!site.contactEmail) console.warn('  ⚠ site.contactEmail is not set — the Contact and Privacy pages show a placeholder.');
  if (!site.adsenseClient) console.warn('  ℹ site.adsenseClient is empty — no AdSense script or ads.txt generated yet.');
}

// ---------------------------------------------------------------- pre-rendered HTML pages (SEO / AdSense)

const SITE_DIR = path.join(ROOT, 'site');
const TEMPLATE = path.join(ROOT, 'templates', 'page.html');
const siteUrl = (site) => (site.url || 'https://example.com').replace(/\/+$/, '');
const href = (p) => (p ? `/${p}/` : '/');
const pad2 = (n) => String(n).padStart(2, '0');

function prerender(catalog, chapterHtml, pageHtml) {
  const site = catalog.site || {};
  const base = siteUrl(site);
  const name = site.name || 'DevNotes';
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const liveTopics = catalog.tracks.flatMap((tr) => tr.topics.filter((tp) => tp.status === 'live' && tp.chapters.length).map((tp) => ({ track: tr, topic: tp })));

  // Remove previously generated pages (only directories this script owns).
  const owned = [...catalog.tracks.map((t) => t.id), ...catalog.pages.map((p) => p.slug), 'support'];
  for (const d of owned) if (!['assets', 'data'].includes(d)) fs.rmSync(path.join(SITE_DIR, d), { recursive: true, force: true });
  for (const f of ['index.html', '404.html', 'sitemap.xml', 'robots.txt', 'ads.txt']) fs.rmSync(path.join(SITE_DIR, f), { force: true });

  const nav = `<a class="nav-link" href="/">Home</a>` + catalog.tracks.map((t) => `<a class="nav-link" href="${href(t.id)}">${esc(t.name)}</a>`).join('');
  const sidebar = `<div class="side-head"><div class="side-title">Backend Notes</div><div class="side-sub">${esc(site.tagline || '')}</div></div>` +
    catalog.tracks.map((track) => `<div class="side-label">${esc(track.name)}</div>` + track.topics.map((topic) => {
      if (topic.status !== 'live' || !topic.chapters.length) return `<div class="side-topic is-soon"><span>${esc(topic.name)}</span><span class="chip">Soon</span></div>`;
      return `<a class="side-topic" href="${href(`${track.id}/${topic.id}`)}"><span>${esc(topic.name)}</span><span class="chip chip-live">${topic.chapters.length}</span></a>` +
        `<div class="side-chapters">${topic.chapters.map((c, i) => `<a class="chapter-link" href="${href(`${track.id}/${topic.id}/${c.slug}`)}"><span class="num">${pad2(i + 1)}</span><span>${esc(c.title)}</span></a>`).join('')}</div>`;
    }).join('')).join('');
  const footer = `<footer class="site-footer"><span>© ${new Date().getFullYear()} ${esc(name)} · Notes for learning and interview prep</span>` +
    `<nav class="footer-links" aria-label="Site">${catalog.pages.map((p) => `<a href="${href(p.slug)}">${esc(p.title)}</a>`).join('')}${site.support ? '<a href="/support/">Support</a>' : ''}</nav>` +
    `<span>Updated ${esc(catalog.builtAt)}</span></footer>`;

  const headExtra = [];
  if (site.googleSiteVerification) headExtra.push(`  <meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">`);
  if (site.adsenseClient) {
    headExtra.push(`  <meta name="google-adsense-account" content="${esc(site.adsenseClient)}">`);
    headExtra.push(`  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(site.adsenseClient)}" crossorigin="anonymous"></script>`);
  }
  const ogImage = site.ogImage
    ? `  <meta property="og:image" content="${esc(/^https?:/.test(site.ogImage) ? site.ogImage : base + '/' + site.ogImage.replace(/^\/+/, ''))}">\n  <meta name="twitter:card" content="summary_large_image">`
    : '  <meta name="twitter:card" content="summary">';

  const sitemap = [];
  let count = 0;
  function write(route, { title, description, main, ogType = 'website', jsonLd = null, index = true, file = null }) {
    const url = base + href(route);
    const html = template
      .replace(/\{\{title\}\}/g, esc(title))
      .replace(/\{\{description\}\}/g, esc(description || site.tagline || ''))
      .replace(/\{\{robots\}\}/g, index ? 'index, follow' : 'noindex, follow')
      .replace(/\{\{canonical\}\}/g, esc(url))
      .replace(/\{\{siteName\}\}/g, esc(name))
      .replace(/\{\{ogType\}\}/g, ogType)
      .replace('{{ogImage}}', ogImage)
      .replace('{{headExtra}}', headExtra.concat(jsonLd ? [`  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`] : []).join('\n'))
      .replace('{{nav}}', nav)
      .replace('{{sidebar}}', sidebar)
      .replace('{{route}}', esc(route))
      .replace('{{main}}', main);
    const out = file ? path.join(SITE_DIR, file) : path.join(SITE_DIR, ...route.split('/').filter(Boolean), 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    if (index && !file) sitemap.push(url);
    count++;
  }
  const crumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([n, r], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: base + href(r) })) });
  const chapterCardHtml = (track, topic, c, i) => `<a class="chapter-card" href="${href(`${track.id}/${topic.id}/${c.slug}`)}">` +
    `<div class="card-num"><span>CHAPTER ${pad2(i + 1)}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p>` +
    `<div class="card-foot"><span>${c.readMin} min · ${c.questions} Q&amp;A · ${c.examples} examples</span><span class="arrow" aria-hidden="true">→</span></div></a>`;

  // Home
  const homeTitle = `${name} — ${site.tagline || 'Tech notes'}`;
  write('', {
    title: homeTitle,
    description: site.description || site.tagline,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name, url: base + '/', description: site.description || site.tagline },
    main: `<div class="page"><section class="hero"><div class="eyebrow">${esc(name)}</div><h1>Master modern backend technologies</h1>` +
      `<p>${esc(site.description || site.tagline || '')}</p></section>` +
      catalog.tracks.map((tr) => `<section><h2><a href="${href(tr.id)}">${esc(tr.name)}</a></h2><p>${esc(tr.description || '')}</p><ul>` +
        tr.topics.map((tp) => `<li><a href="${href(`${tr.id}/${tp.id}`)}">${esc(tp.name)}</a>${tp.status === 'live' && tp.chapters.length ? ` — ${tp.chapters.length} chapters` : ' — coming soon'}</li>`).join('') + '</ul></section>').join('') +
      `</div>${footer}`,
  });

  for (const track of catalog.tracks) {
    write(track.id, {
      title: `${track.name} · ${name}`,
      description: track.description,
      index: track.topics.some((tp) => tp.status === 'live' && tp.chapters.length),   // no thin "coming soon" pages in Google
      jsonLd: { '@context': 'https://schema.org', ...crumbs([['Home', ''], [track.name, track.id]]) },
      main: `<div class="page"><section class="hero"><div class="eyebrow">Track</div><h1>${esc(track.name)}</h1><p>${esc(track.description || '')}</p></section>` +
        `<div class="chapter-grid">${track.topics.map((tp) => `<a class="chapter-card" href="${href(`${track.id}/${tp.id}`)}"><h3>${esc(tp.name)}</h3><p>${esc(tp.description || '')}</p></a>`).join('')}</div></div>${footer}`,
    });
    for (const topic of track.topics) {
      const live = topic.status === 'live' && topic.chapters.length;
      write(`${track.id}/${topic.id}`, {
        title: `${topic.name} · ${name}`,
        description: topic.description,
        index: !!live,
        jsonLd: { '@context': 'https://schema.org', ...crumbs([['Home', ''], [track.name, track.id], [topic.name, `${track.id}/${topic.id}`]]) },
        main: `<div class="page"><section class="hero"><div class="eyebrow">${esc(track.name)}${live ? ` · ${topic.chapters.length} chapters` : ''}</div><h1>${esc(topic.name)}</h1><p>${esc(topic.description || '')}</p></section>` +
          (live ? `<div class="chapter-grid">${topic.chapters.map((c, i) => chapterCardHtml(track, topic, c, i)).join('')}</div>` : '<p>This topic is coming soon.</p>') + `</div>${footer}`,
      });
      topic.chapters.forEach((c, i) => {
        const key = `${track.id}/${topic.id}/${c.slug}`;
        const prev = topic.chapters[i - 1], next = topic.chapters[i + 1];
        const navCard = (ch, dir) => ch ? `<a class="footer-nav ${dir}" href="${href(`${track.id}/${topic.id}/${ch.slug}`)}"><small>${dir === 'prev' ? '← Previous' : 'Next →'}</small><b>${esc(ch.title)}</b></a>` : '';
        write(key, {
          title: `${c.title} · ${topic.name} · ${name}`,
          description: c.subtitle,
          ogType: 'article',
          jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'TechArticle', headline: c.title, description: c.subtitle, dateModified: catalog.builtAt, inLanguage: 'en', url: base + href(key),
                author: { '@type': 'Organization', name }, publisher: { '@type': 'Organization', name }, isPartOf: { '@type': 'Course', name: topic.name } },
              crumbs([['Home', ''], [track.name, track.id], [topic.name, `${track.id}/${topic.id}`], [c.title, key]]),
            ],
          },
          main: `<div class="reader"><article class="reader-main">` +
            `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${href(track.id)}">${esc(track.name)}</a><span class="sep">/</span><a href="${href(`${track.id}/${topic.id}`)}">${esc(topic.name)}</a><span class="sep">/</span><b>${esc(c.title)}</b></nav>` +
            `<header class="reader-head"><div><div class="eyebrow">${esc(topic.name)} · Chapter ${pad2(i + 1)}</div><h1>${esc(c.title)}</h1><p class="subtitle">${esc(c.subtitle)}</p>` +
            `<div class="meta"><span>◷ ${c.readMin} min read</span><span>§ ${c.sections} sections</span><span>? ${c.questions} interview questions</span><span>{ } ${c.examples} code examples</span></div></div></header>` +
            `<div class="content" id="content">${chapterHtml[key]}</div>` +
            `<nav class="chapter-footer" aria-label="Chapter navigation">${navCard(prev, 'prev')}${navCard(next, 'next')}</nav></article></div>${footer}`,
        });
      });
    }
  }

  for (const p of catalog.pages) {
    write(p.slug, {
      title: `${p.title} · ${name}`,
      description: p.description,
      main: `<div class="page legal-page"><article class="legal"><h1>${esc(p.title)}</h1><p class="legal-updated">Last updated: ${esc(p.updated)}</p>` +
        `<div class="content" id="content">${pageHtml[p.slug]}</div></article></div>${footer}`,
    });
  }

  if (site.support) {
    write('support', {
      title: `Support · ${name}`,
      description: `Support ${name} with any amount via UPI — no minimum.`,
      main: `<div class="page support-page"><section class="support-hero"><div class="eyebrow">Support ${esc(name)}</div><h1>Help keep learning free for the next person</h1>` +
        `<p>${esc(name)} has no paywalls and no sign-ups. If the notes have helped you, you can contribute any amount by UPI to <b>${esc(site.support.upi)}</b>.</p></section></div>${footer}`,
    });
  }

  write('404', {
    file: '404.html',
    title: `Page not found · ${name}`,
    description: 'This page does not exist.',
    index: false,
    main: `<div class="page"><div class="empty-state"><div class="eyebrow">404</div><h1>Page not found</h1><p>That note doesn't exist (yet). Try search, or head back home.</p><a class="btn btn-primary" href="/">Go home</a></div></div>${footer}`,
  });

  fs.writeFileSync(path.join(SITE_DIR, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemap.map((loc) => `  <url><loc>${esc(loc)}</loc><lastmod>${catalog.builtAt}</lastmod></url>`).join('\n') + `\n</urlset>\n`);
  fs.writeFileSync(path.join(SITE_DIR, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  if (site.adsenseClient) {
    fs.writeFileSync(path.join(SITE_DIR, 'ads.txt'), `google.com, ${site.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  }
  return count;
}

build();
