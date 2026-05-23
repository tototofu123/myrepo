#!/usr/bin/env node
/**
 * generate-blog.js
 * Reads the GitHub issue body, parses frontmatter + Markdown content,
 * and writes a styled HTML page to public/blogs/<slug>/index.html.
 * It also updates (or creates) public/blogs/index.html with a listing entry.
 */

const fs   = require('fs');
const path = require('path');

// ── 1. Read issue body from env ──────────────────────────────────────────────
const issueBody = process.env.ISSUE_BODY || '';

// ── 2. Parse YAML-ish frontmatter block ─────────────────────────────────────
function parseFrontmatter(text) {
  const fm = {};
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.error('ERROR: Could not find frontmatter block in issue body.');
    process.exit(1);
  }
  const lines = fmMatch[1].split('\n');
  for (const line of lines) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim().replace(/^"|"$/g, '');
    if (m[1] === 'tags') {
      val = val.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/^"|"$/g, ''));
    }
    fm[m[1]] = val;
  }
  return { fm, rest: text.slice(fmMatch[0].length).trim() };
}

const { fm, rest: mdContent } = parseFrontmatter(issueBody);

const { title, slug, date, summary = '', tags = [] } = fm;
if (!slug) { console.error('Missing slug in frontmatter'); process.exit(1); }
if (!title) { console.error('Missing title in frontmatter'); process.exit(1); }

const tagList = Array.isArray(tags) ? tags : [tags];

// ── 3. Convert Markdown to HTML (basic renderer) ────────────────────────────
// We use a minimal inline converter so the action has zero extra deps.
function mdToHtml(md) {
  return md
    // Fenced code blocks
    .replace(/```([\w]*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang || 'text'}">${escHtml(code.trimEnd())}</code></pre>`)
    // Headings
    .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links and images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Blockquotes
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Unordered lists (simple, single-level)
    .replace(/((?:^[-*+]\s+.+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*+]\s+/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    })
    // Ordered lists (simple, single-level)
    .replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    })
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p>$1</p>')
    .replace(/<\/p>\n<p>/g, '</p>\n<p>')
    // Clean up extra blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const htmlContent = mdToHtml(mdContent);

// ── 4. Build HTML page ───────────────────────────────────────────────────────
const tagBadges = tagList.filter(Boolean).map(t =>
  `<span class="tag">${t}</span>`).join('');

const pageHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escHtml(summary)}">
  <title>${escHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
  <style>
    /* ── Design tokens ── */
    :root, [data-theme="light"] {
      --font-display: 'Instrument Serif', Georgia, serif;
      --font-body: 'Work Sans', 'Helvetica Neue', sans-serif;
      --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
      --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 1rem);
      --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
      --text-lg: clamp(1.125rem, 1rem + 0.75vw, 1.5rem);
      --text-xl: clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem);
      --text-2xl: clamp(2rem, 1.2rem + 2.5vw, 3.5rem);
      --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
      --space-4: 1rem; --space-6: 1.5rem; --space-8: 2rem;
      --space-10: 2.5rem; --space-12: 3rem; --space-16: 4rem;
      --color-bg: #f7f6f2;
      --color-surface: #f9f8f5;
      --color-surface-2: #fbfbf9;
      --color-divider: #dcd9d5;
      --color-border: #d4d1ca;
      --color-text: #28251d;
      --color-text-muted: #7a7974;
      --color-text-faint: #bab9b4;
      --color-primary: #01696f;
      --color-primary-hover: #0c4e54;
      --color-primary-highlight: #cedcd8;
      --radius-sm: 0.375rem; --radius-md: 0.5rem;
      --radius-lg: 0.75rem; --radius-full: 9999px;
      --shadow-sm: 0 1px 2px oklch(0.2 0.01 80 / 0.06);
      --shadow-md: 0 4px 12px oklch(0.2 0.01 80 / 0.08);
      --transition: 180ms cubic-bezier(0.16, 1, 0.3, 1);
      --content-narrow: 680px;
    }
    [data-theme="dark"] {
      --color-bg: #171614; --color-surface: #1c1b19;
      --color-surface-2: #201f1d; --color-divider: #262523;
      --color-border: #393836; --color-text: #cdccca;
      --color-text-muted: #797876; --color-text-faint: #5a5957;
      --color-primary: #4f98a3; --color-primary-hover: #227f8b;
      --color-primary-highlight: #313b3b;
      --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.2);
      --shadow-md: 0 4px 12px oklch(0 0 0 / 0.3);
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme]) {
        --color-bg: #171614; --color-surface: #1c1b19;
        --color-surface-2: #201f1d; --color-divider: #262523;
        --color-border: #393836; --color-text: #cdccca;
        --color-text-muted: #797876; --color-text-faint: #5a5957;
        --color-primary: #4f98a3; --color-primary-hover: #227f8b;
        --color-primary-highlight: #313b3b;
      }
    }

    /* ── Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
    body {
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-text);
      background: var(--color-bg);
      min-height: 100dvh;
      line-height: 1.7;
      transition: background var(--transition), color var(--transition);
    }
    img { display: block; max-width: 100%; height: auto; }
    a { color: var(--color-primary); text-decoration: underline;
        text-underline-offset: 3px; transition: color var(--transition); }
    a:hover { color: var(--color-primary-hover); }
    ::selection { background: oklch(from var(--color-primary) l c h / 0.2); }
    :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px;
                     border-radius: var(--radius-sm); }

    /* ── Site header ── */
    .site-header {
      position: sticky; top: 0; z-index: 100;
      background: color-mix(in oklab, var(--color-bg) 85%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid oklch(from var(--color-text) l c h / 0.08);
      padding: var(--space-3) var(--space-6);
      display: flex; align-items: center; justify-content: space-between;
    }
    .site-logo {
      font-family: var(--font-display); font-size: var(--text-lg);
      color: var(--color-text); text-decoration: none; letter-spacing: -0.02em;
    }
    .site-logo:hover { color: var(--color-primary); }
    .header-actions { display: flex; align-items: center; gap: var(--space-3); }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
      font-size: var(--text-sm); color: var(--color-text-muted);
      text-decoration: none; background: none; border: none; cursor: pointer;
      transition: background var(--transition), color var(--transition);
    }
    .btn-ghost:hover { background: var(--color-surface-2); color: var(--color-text); }
    #theme-toggle { width: 36px; height: 36px; display: flex; align-items: center;
                    justify-content: center; border-radius: var(--radius-full);
                    color: var(--color-text-muted); }
    #theme-toggle:hover { color: var(--color-text); background: var(--color-surface-2); }

    /* ── Main layout ── */
    main {
      max-width: var(--content-narrow);
      margin-inline: auto;
      padding: var(--space-12) var(--space-6) var(--space-16);
    }

    /* ── Post header ── */
    .post-header { margin-bottom: var(--space-10); }
    .post-meta {
      display: flex; align-items: center; flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
      font-size: var(--text-sm); color: var(--color-text-muted);
      margin-bottom: var(--space-4);
    }
    .tag {
      display: inline-block;
      padding: 2px var(--space-3);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: 500;
      background: var(--color-primary-highlight);
      color: var(--color-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    [data-theme="dark"] .tag { color: var(--color-primary); }
    h1.post-title {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      line-height: 1.1;
      letter-spacing: -0.03em;
      color: var(--color-text);
      margin-bottom: var(--space-4);
    }
    .post-summary {
      font-size: var(--text-lg);
      color: var(--color-text-muted);
      line-height: 1.5;
    }
    .post-divider {
      border: none;
      border-top: 1px solid var(--color-divider);
      margin: var(--space-8) 0;
    }

    /* ── Article body ── */
    .post-body { color: var(--color-text); }
    .post-body h1, .post-body h2, .post-body h3,
    .post-body h4, .post-body h5, .post-body h6 {
      font-family: var(--font-display);
      line-height: 1.2; letter-spacing: -0.02em;
      margin-top: var(--space-10); margin-bottom: var(--space-3);
      color: var(--color-text);
    }
    .post-body h2 { font-size: var(--text-xl); }
    .post-body h3 { font-size: var(--text-lg); }
    .post-body p { margin-bottom: var(--space-6); max-width: 72ch; }
    .post-body ul, .post-body ol {
      margin: 0 0 var(--space-6) var(--space-6); }
    .post-body li { margin-bottom: var(--space-2); }
    .post-body blockquote {
      border-left: 3px solid var(--color-primary);
      padding: var(--space-3) var(--space-6);
      margin: var(--space-6) 0;
      background: var(--color-surface);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
      color: var(--color-text-muted); font-style: italic;
    }
    .post-body code {
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.88em;
      background: var(--color-surface-2);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      border: 1px solid oklch(from var(--color-text) l c h / 0.1);
    }
    .post-body pre {
      background: #1c1b19;
      color: #cdccca;
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      overflow-x: auto;
      margin: var(--space-6) 0;
      font-size: var(--text-sm);
      line-height: 1.6;
      box-shadow: var(--shadow-md);
    }
    .post-body pre code {
      background: none; border: none; padding: 0;
      font-size: inherit; color: inherit;
    }
    .post-body hr { border: none; border-top: 1px solid var(--color-divider);
                    margin: var(--space-8) 0; }
    .post-body img {
      border-radius: var(--radius-lg); margin: var(--space-6) auto;
      box-shadow: var(--shadow-md);
    }
    .post-body strong { font-weight: 600; }
    .post-body em { font-style: italic; }

    /* ── Footer ── */
    .site-footer {
      text-align: center;
      padding: var(--space-8) var(--space-6);
      border-top: 1px solid var(--color-divider);
      font-size: var(--text-sm);
      color: var(--color-text-faint);
    }
    .site-footer a { color: var(--color-text-muted); }

    /* ── Scroll reveal ── */
    .reveal { opacity: 0; transform: translateY(16px);
              transition: opacity 0.5s ease, transform 0.5s ease; }
    .reveal.visible { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .reveal { opacity: 1; transform: none; }
    }

    /* ── Mobile ── */
    @media (max-width: 640px) {
      main { padding: var(--space-8) var(--space-4) var(--space-12); }
    }
  </style>
</head>
<body>

<a href="#main-content" class="sr-only">Skip to content</a>

<header class="site-header">
  <a href="/" class="site-logo">✦ Blog</a>
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
        <time datetime="${escHtml(date)}">${escHtml(date)}</time>
        ${tagBadges}
      </div>
      <h1 class="post-title">${escHtml(title)}</h1>
      ${summary ? `<p class="post-summary">${escHtml(summary)}</p>` : ''}
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
      t.setAttribute('aria-label', 'Switch to ' + (d === 'dark' ? 'light' : 'dark') + ' mode');
      t.innerHTML = d === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      t.addEventListener('click', () => {
        d = d === 'dark' ? 'light' : 'dark';
        r.setAttribute('data-theme', d);
        t.setAttribute('aria-label', 'Switch to ' + (d === 'dark' ? 'light' : 'dark') + ' mode');
        t.innerHTML = d === 'dark'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      });
    }
  })();

  // Scroll reveal
  (function() {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    els.forEach(el => io.observe(el));
  })();
</script>

</body>
</html>
`;

// ── 5. Write the blog post page ──────────────────────────────────────────────
const outDir = path.join('public', 'blogs', slug);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), pageHtml, 'utf8');
console.log(`✅ Written: public/blogs/${slug}/index.html`);

// ── 6. Update / create blog listing page ────────────────────────────────────
const listingPath = path.join('public', 'blogs', 'index.html');
const entry = `  <li class="post-card" data-date="${date}">
    <a href="/blogs/${slug}/">
      <span class="card-date">${date}</span>
      <span class="card-title">${escHtml(title)}</span>
      ${summary ? `<span class="card-summary">${escHtml(summary)}</span>` : ''}
    </a>
  </li>`;

if (fs.existsSync(listingPath)) {
  let listing = fs.readFileSync(listingPath, 'utf8');
  // Insert entry before the closing </ul>
  listing = listing.replace('</ul>', `${entry}\n</ul>`);
  fs.writeFileSync(listingPath, listing, 'utf8');
  console.log('✅ Updated blog listing.');
} else {
  const listingHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
  <style>
    :root,[data-theme="light"]{--font-display:'Instrument Serif',Georgia,serif;--font-body:'Work Sans','Helvetica Neue',sans-serif;--text-sm:clamp(0.875rem,0.8rem + 0.35vw,1rem);--text-base:clamp(1rem,0.95rem + 0.25vw,1.125rem);--text-lg:clamp(1.125rem,1rem + 0.75vw,1.5rem);--text-2xl:clamp(2rem,1.2rem + 2.5vw,3.5rem);--space-2:0.5rem;--space-3:0.75rem;--space-4:1rem;--space-6:1.5rem;--space-8:2rem;--space-10:2.5rem;--space-12:3rem;--space-16:4rem;--color-bg:#f7f6f2;--color-surface:#f9f8f5;--color-surface-2:#fbfbf9;--color-divider:#dcd9d5;--color-text:#28251d;--color-text-muted:#7a7974;--color-text-faint:#bab9b4;--color-primary:#01696f;--color-primary-hover:#0c4e54;--color-primary-highlight:#cedcd8;--radius-md:0.5rem;--radius-lg:0.75rem;--shadow-sm:0 1px 2px oklch(0.2 0.01 80/0.06);--transition:180ms cubic-bezier(0.16,1,0.3,1)}
    [data-theme="dark"]{--color-bg:#171614;--color-surface:#1c1b19;--color-surface-2:#201f1d;--color-divider:#262523;--color-border:#393836;--color-text:#cdccca;--color-text-muted:#797876;--color-text-faint:#5a5957;--color-primary:#4f98a3;--color-primary-hover:#227f8b;--color-primary-highlight:#313b3b}
    @media(prefers-color-scheme:dark){:root:not([data-theme]){--color-bg:#171614;--color-surface:#1c1b19;--color-text:#cdccca;--color-text-muted:#797876;--color-primary:#4f98a3;--color-primary-hover:#227f8b;--color-primary-highlight:#313b3b;--color-divider:#262523}}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
    body{font-family:var(--font-body);font-size:var(--text-base);color:var(--color-text);background:var(--color-bg);min-height:100dvh;line-height:1.7;transition:background var(--transition),color var(--transition)}
    a{color:var(--color-primary);text-decoration:none;transition:color var(--transition)}
    a:hover{color:var(--color-primary-hover)}
    .site-header{position:sticky;top:0;z-index:100;background:color-mix(in oklab,var(--color-bg) 85%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid oklch(from var(--color-text) l c h/0.08);padding:var(--space-3) var(--space-6);display:flex;align-items:center;justify-content:space-between}
    .site-logo{font-family:var(--font-display);font-size:var(--text-lg);color:var(--color-text)}
    .site-logo:hover{color:var(--color-primary)}
    #theme-toggle{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:9999px;color:var(--color-text-muted);background:none;border:none;cursor:pointer;transition:background var(--transition),color var(--transition)}
    #theme-toggle:hover{color:var(--color-text);background:var(--color-surface-2)}
    main{max-width:720px;margin-inline:auto;padding:var(--space-12) var(--space-6) var(--space-16)}
    .page-title{font-family:var(--font-display);font-size:var(--text-2xl);letter-spacing:-0.03em;margin-bottom:var(--space-2)}
    .page-subtitle{color:var(--color-text-muted);font-size:var(--text-lg);margin-bottom:var(--space-10)}
    .post-list{list-style:none;display:flex;flex-direction:column;gap:var(--space-2)}
    .post-card a{display:grid;grid-template-columns:120px 1fr;gap:var(--space-4) var(--space-6);align-items:baseline;padding:var(--space-4) var(--space-4);border-radius:var(--radius-lg);transition:background var(--transition)}
    .post-card a:hover{background:var(--color-surface);color:inherit}
    .card-date{font-size:var(--text-sm);color:var(--color-text-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
    .card-title{font-weight:500;color:var(--color-text)}
    .card-summary{grid-column:2;font-size:var(--text-sm);color:var(--color-text-muted);margin-top:var(--space-1)}
    .site-footer{text-align:center;padding:var(--space-8) var(--space-6);border-top:1px solid var(--color-divider);font-size:var(--text-sm);color:var(--color-text-faint)}
    .site-footer a{color:var(--color-text-muted)}
    @media(max-width:640px){.post-card a{grid-template-columns:1fr}.card-date{font-size:var(--text-xs)}}
  </style>
</head>
<body>
<a href="#main-content" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden">Skip to content</a>
<header class="site-header">
  <a href="/" class="site-logo">✦ Blog</a>
  <button id="theme-toggle" aria-label="Switch to dark mode">
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
(function(){const t=document.getElementById('theme-toggle');const r=document.documentElement;let d=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';r.setAttribute('data-theme',d);if(t){t.setAttribute('aria-label','Switch to '+(d==='dark'?'light':'dark')+' mode');t.addEventListener('click',()=>{d=d==='dark'?'light':'dark';r.setAttribute('data-theme',d);t.setAttribute('aria-label','Switch to '+(d==='dark'?'light':'dark')+' mode')})}})()
</script>
</body></html>`;
  fs.writeFileSync(listingPath, listingHtml, 'utf8');
  console.log('✅ Created blog listing page.');
}
