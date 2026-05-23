#!/usr/bin/env node
/**
 * generate-blog.js  v2
 * Reads GitHub issue body → parses frontmatter + Markdown
 * → writes  public/blogs/<slug>/<slug>.html  (named file, not index.html)
 * → updates public/blogs/index.html  listing
 *
 * References: public/blogs/blog-styles.css  (external stylesheet)
 *             public/blogs/convert.json     (conversion spec, human-readable)
 */

const fs   = require('fs');
const path = require('path');

// ── 1. Read issue body from env ──────────────────────────────────────────────
const issueBody = process.env.ISSUE_BODY || '';

// ── 2. Parse YAML-ish frontmatter ───────────────────────────────────────────
function parseFrontmatter(text) {
  const fm = {};
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) { console.error('ERROR: no frontmatter block found.'); process.exit(1); }
  for (const line of m[1].split('\n')) {
    const p = line.match(/^(\w+):\s*(.*)$/);
    if (!p) continue;
    let val = p[2].trim().replace(/^"|"$/g, '');
    if (p[1] === 'tags') val = val.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/^"|"$/g, ''));
    fm[p[1]] = val;
  }
  return { fm, rest: text.slice(m[0].length).trim() };
}

const { fm, rest: mdContent } = parseFrontmatter(issueBody);
const { title, slug, date, summary = '', tags = [] } = fm;
if (!slug)  { console.error('Missing slug');  process.exit(1); }
if (!title) { console.error('Missing title'); process.exit(1); }
const tagList = Array.isArray(tags) ? tags : [tags];

// ── 3. Markdown → HTML ───────────────────────────────────────────────────────
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function mdToHtml(md) {
  let out = md;
  // Fenced code blocks (before anything else)
  out = out.replace(/```([\w]*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang||'text'}">${esc(code.trimEnd())}</code></pre>`);
  // Headings
  out = out
    .replace(/^#{6}\s+(.*)$/gm,'<h6>$1</h6>')
    .replace(/^#{5}\s+(.*)$/gm,'<h5>$1</h5>')
    .replace(/^#{4}\s+(.*)$/gm,'<h4>$1</h4>')
    .replace(/^###\s+(.*)$/gm,'<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm,'<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm,'<h1>$1</h1>');
  // Bold / italic
  out = out
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>');
  // Inline code
  out = out.replace(/`([^`]+)`/g,'<code>$1</code>');
  // Images with optional *caption* on next line → <figure>
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)\n\*([^*]+)\*/g,
    (_, alt, src, cap) =>
      `<figure><img src="${src}" alt="${esc(alt)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`);
  // Plain images
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) => `<img src="${src}" alt="${esc(alt)}" loading="lazy">`);
  // Links
  out = out.replace(/\[([^\]]*)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Blockquotes
  out = out.replace(/^>\s+(.*)$/gm,'<blockquote>$1</blockquote>');
  // HR
  out = out.replace(/^---+$/gm,'<hr>');
  // Tables (GFM) — header + separator + rows
  out = out.replace(
    /((?:^\|.*\|\n?)+)/gm,
    (block) => {
      const rows = block.trim().split('\n').filter(r => !/^\|[-|:\s]+\|$/.test(r));
      if (rows.length < 1) return block;
      const [head, ...body] = rows;
      const ths = head.split('|').filter((_,i,a) => i>0 && i<a.length-1)
                      .map(c => `<th>${c.trim()}</th>`).join('');
      const trs = body.map(r => {
        const tds = r.split('|').filter((_,i,a) => i>0 && i<a.length-1)
                       .map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    }
  );
  // Unordered lists
  out = out.replace(/((?:^[-*+]\s+.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l=>`<li>${l.replace(/^[-*+]\s+/,'')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  // Ordered lists
  out = out.replace(/((?:^\d+\.\s+.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\.\s+/,'')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  // Paragraphs
  out = out.replace(/^(?!<[a-zA-Z/])(.*\S.*)$/gm,'<p>$1</p>');
  out = out.replace(/\n{3,}/g,'\n\n').trim();
  return out;
}

const htmlContent = mdToHtml(mdContent);

// ── 4. Assemble page ─────────────────────────────────────────────────────────
const tagBadges = tagList.filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('');

// Stylesheet is one level up from /blogs/<slug>/
const cssPath = '../blog-styles.css';

const pageHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${esc(summary)}">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${cssPath}">
</head>
<body>

<a href="#main-content" class="sr-only">Skip to content</a>

<header class="site-header">
  <a href="/" class="site-logo">✶ Blog</a>
  <div class="header-actions">
    <a href="/blogs/" class="btn-ghost">All posts</a>
    <button id="theme-toggle" aria-label="Switch to dark mode" data-theme-toggle>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  </div>
</header>

<main id="main-content">
  <article>
    <header class="post-header reveal">
      <div class="post-meta">
        <time datetime="${esc(date)}">${esc(date)}</time>
        ${tagBadges}
      </div>
      <h1 class="post-title">${esc(title)}</h1>
      ${summary ? `<p class="post-summary">${esc(summary)}</p>` : ''}
    </header>
    <hr class="post-divider">
    <div class="post-body reveal">
      ${htmlContent}
    </div>
  </article>
</main>

<footer class="site-footer">
  <p>&larr; <a href="/blogs/">Back to all posts</a></p>
</footer>

<script>
  // Theme toggle
  (function(){
    const t = document.querySelector('[data-theme-toggle]');
    const r = document.documentElement;
    let d = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    r.setAttribute('data-theme', d);
    if (t) {
      const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      const update = () => {
        r.setAttribute('data-theme', d);
        t.setAttribute('aria-label', 'Switch to ' + (d==='dark'?'light':'dark') + ' mode');
        t.innerHTML = d === 'dark' ? moonSvg : sunSvg;
      };
      update();
      t.addEventListener('click', () => { d = d==='dark'?'light':'dark'; update(); });
    }
  })();

  // Scroll reveal
  (function(){
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    els.forEach(el => io.observe(el));
  })();
</script>

</body>
</html>
`;

// ── 5. Write named HTML file ─────────────────────────────────────────────────
const outDir = path.join('public', 'blogs', slug);
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${slug}.html`);
fs.writeFileSync(outFile, pageHtml, 'utf8');
console.log(`✅ Written: public/blogs/${slug}/${slug}.html`);

// ── 6. Update / create blog listing page ────────────────────────────────────
const listingPath = path.join('public', 'blogs', 'index.html');
const entry = `  <li class="post-card" data-date="${esc(date)}">
    <a href="/blogs/${slug}/${slug}.html">
      <span class="card-date">${esc(date)}</span>
      <span class="card-title">${esc(title)}</span>
      ${summary ? `<span class="card-summary">${esc(summary)}</span>` : ''}
    </a>
  </li>`;

if (fs.existsSync(listingPath)) {
  let listing = fs.readFileSync(listingPath, 'utf8');
  listing = listing.replace('</ul>', `${entry}\n</ul>`);
  fs.writeFileSync(listingPath, listing, 'utf8');
  console.log('✅ Updated blog listing.');
} else {
  const listHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./blog-styles.css">
  <style>
    main{max-width:720px;margin-inline:auto;padding:var(--space-12) var(--space-6) var(--space-16)}
    .page-title{font-family:var(--font-display);font-size:var(--text-2xl);letter-spacing:-0.03em;margin-bottom:var(--space-2)}
    .page-subtitle{color:var(--color-text-muted);font-size:var(--text-lg);margin-bottom:var(--space-10)}
    .post-list{list-style:none;display:flex;flex-direction:column;gap:var(--space-2)}
    .post-card a{display:grid;grid-template-columns:120px 1fr;gap:var(--space-4) var(--space-6);align-items:baseline;padding:var(--space-4);border-radius:var(--radius-lg);text-decoration:none;transition:background var(--transition)}
    .post-card a:hover{background:var(--color-surface)}
    .card-date{font-size:var(--text-sm);color:var(--color-text-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
    .card-title{font-weight:500;color:var(--color-text)}
    .card-summary{grid-column:2;font-size:var(--text-sm);color:var(--color-text-muted);margin-top:var(--space-1)}
    @media(max-width:640px){.post-card a{grid-template-columns:1fr}.card-date{font-size:var(--text-xs)}}
  </style>
</head>
<body>
<a href="#main-content" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden">Skip to content</a>
<header class="site-header">
  <a href="/" class="site-logo">✶ Blog</a>
  <button id="theme-toggle" aria-label="Switch to dark mode" data-theme-toggle>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  </button>
</header>
<main id="main-content">
  <h1 class="page-title">Blog</h1>
  <p class="page-subtitle">Notes, projects, and ideas.</p>
  <ul class="post-list">
${entry}
  </ul>
</main>
<footer class="site-footer">&larr; <a href="/">Home</a></footer>
<script>
(function(){const t=document.querySelector('[data-theme-toggle]');const r=document.documentElement;let d=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';r.setAttribute('data-theme',d);if(t){const sun='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';const moon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';const upd=()=>{r.setAttribute('data-theme',d);t.setAttribute('aria-label','Switch to '+(d==='dark'?'light':'dark')+' mode');t.innerHTML=d==='dark'?moon:sun};upd();t.addEventListener('click',()=>{d=d==='dark'?'light':'dark';upd()})}})()
</script>
</body></html>`;
  fs.writeFileSync(listingPath, listHtml, 'utf8');
  console.log('✅ Created blog listing page.');
}
