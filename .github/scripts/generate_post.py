#!/usr/bin/env python3
"""
Generate blog post HTML from queued GitHub issues.

Expects either:
  - Legacy single-issue env vars (ISSUE_TITLE, ISSUE_BODY, ISSUE_NUMBER)
  - New batch mode env var ISSUES_JSON (JSON array of {number, title, body})

Publish date always comes from PUBLISH_DATE_DISPLAY (e.g. "June 22, 2026")
and PUBLISH_DATE_ISO (e.g. "2026-06-22") — never from issue created_at.
"""
import os
import re
import json
import html
import markdown

# ── Load issues to process ────────────────────────────────────────────────────
issues_json = os.environ.get('ISSUES_JSON', '')
publish_date_display = os.environ.get('PUBLISH_DATE_DISPLAY', '')
publish_date_iso = os.environ.get('PUBLISH_DATE_ISO', '')

if issues_json:
    issues = json.loads(issues_json)
else:
    issues = [{
        'number': os.environ.get('ISSUE_NUMBER', '0'),
        'title':  os.environ.get('ISSUE_TITLE', 'Untitled'),
        'body':   os.environ.get('ISSUE_BODY', ''),
    }]
    if not publish_date_display:
        publish_date_display = os.environ.get('ISSUE_DATE', '')[:10]
    if not publish_date_iso:
        publish_date_iso = os.environ.get('ISSUE_DATE', '')[:10]

# ── Meta-section headers (the ONLY boundaries extract_section respects) ───────
META_SECTIONS = {'CONTENT', 'STYLE', 'ANIMATIONS', 'IMAGES', 'TITLE'}

def extract_section(body_text, section_name):
    """
    Extract text between ## SECTION_NAME and the next meta-section header.
    Only ## CONTENT / STYLE / ANIMATIONS / IMAGES / TITLE act as boundaries.
    Any ## headings inside the post body pass through cleanly.
    """
    # Build alternation of meta section names for the lookahead
    meta_pattern = '|'.join(META_SECTIONS)
    pattern = rf'##\s*{re.escape(section_name)}\s*\n(.*?)(?=\n##\s*(?:{meta_pattern})\s*\n|$)'
    match = re.search(pattern, body_text, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else ''

# ── Style themes ─────────────────────────────────────────────────────────────
themes = {
    'dark': {
        'bg': '#0f0f0f', 'surface': '#161616', 'border': '#222',
        'text': '#e8e8e8', 'muted': '#888', 'accent': '#a8ff78',
        'heading': '#ffffff', 'body_text': '#cccccc', 'code_bg': '#1c1c1c',
        'pre_bg': '#141414',
    },
    'light': {
        'bg': '#f7f6f2', 'surface': '#ffffff', 'border': '#e0ddd8',
        'text': '#28251d', 'muted': '#7a7974', 'accent': '#01696f',
        'heading': '#28251d', 'body_text': '#4a4742', 'code_bg': '#f0eeeb',
        'pre_bg': '#f0eeeb',
    },
    'minimal': {
        'bg': '#ffffff', 'surface': '#fafafa', 'border': '#ebebeb',
        'text': '#111111', 'muted': '#999999', 'accent': '#000000',
        'heading': '#000000', 'body_text': '#333333', 'code_bg': '#f5f5f5',
        'pre_bg': '#f5f5f5',
    },
    'colorful': {
        'bg': '#0d0221', 'surface': '#14033a', 'border': '#2d1b69',
        'text': '#f0e6ff', 'muted': '#9b8ec4', 'accent': '#f72585',
        'heading': '#ffffff', 'body_text': '#d4c5f0', 'code_bg': '#1a0a40',
        'pre_bg': '#150730',
    },
}

# ── Animation presets ─────────────────────────────────────────────────────────
anim_presets = {
    'fade': '''
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.post-wrap { animation: fadeIn 0.5s ease both; }
''',
    'slide': '''
@keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
.post-wrap { animation: slideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
''',
    'pop': '''
@keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.post-wrap { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
''',
    'none': '',
}

# ── Read existing index ───────────────────────────────────────────────────────
index_path = 'public/posts/index.json'
posts = []
if os.path.exists(index_path):
    with open(index_path, encoding='utf-8') as f:
        try:
            posts = json.load(f)
        except Exception:
            posts = []

os.makedirs('public/posts', exist_ok=True)

# ── Process each issue ────────────────────────────────────────────────────────
for issue in issues:
    number = str(issue.get('number', '0'))
    title  = issue.get('title', 'Untitled')
    body   = issue.get('body', '')

    has_sections = bool(re.search(r'##\s*(CONTENT|TITLE)', body, re.IGNORECASE))

    if has_sections:
        content_md     = extract_section(body, 'CONTENT') or body
        style          = extract_section(body, 'STYLE').lower() or 'dark'
        images_raw     = extract_section(body, 'IMAGES')
        animations_raw = extract_section(body, 'ANIMATIONS').lower()
    else:
        content_md     = body
        style          = 'dark'
        images_raw     = ''
        animations_raw = 'fade'

    # Images
    images = []
    for line in images_raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if '::' in line:
            url, alt = [x.strip() for x in line.split('::', 1)]
        else:
            url, alt = line, 'Image'
        if url.startswith('http'):
            images.append({'url': url, 'alt': alt})

    for i, img in enumerate(images):
        placeholder = f'[IMAGE_{i+1}]'
        img_html = (f'<figure class="post-figure">'
                    f'<img src="{html.escape(img["url"])}" alt="{html.escape(img["alt"])}" loading="lazy" />'
                    f'<figcaption>{html.escape(img["alt"])}</figcaption></figure>')
        if placeholder in content_md:
            content_md = content_md.replace(placeholder, img_html)
        else:
            content_md += f'\n\n{img_html}'

    # Split content into intro (first paragraph) and rest for show-more
    paragraphs = content_md.strip().split('\n\n')
    intro_md = paragraphs[0] if paragraphs else content_md
    rest_md  = '\n\n'.join(paragraphs[1:]) if len(paragraphs) > 1 else ''

    intro_html = markdown.markdown(
        intro_md,
        extensions=['fenced_code', 'tables', 'nl2br', 'attr_list']
    )
    rest_html = markdown.markdown(
        rest_md,
        extensions=['fenced_code', 'tables', 'nl2br', 'attr_list']
    ) if rest_md else ''

    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    t = themes.get(style, themes['dark'])

    anim_names = [a.strip() for a in animations_raw.replace(',', ' ').split() if a.strip()]
    anim_css   = '\n'.join(anim_presets.get(a, '') for a in anim_names) or anim_presets['fade']

    title_esc    = html.escape(title)
    date_display = publish_date_display

    show_more_block = ''
    if rest_html:
        show_more_block = f'''
    <div class="expand-wrap" id="expand-wrap">
      <button class="show-more-btn" id="show-more-btn" onclick="toggleExpand()" aria-expanded="false">
        <span class="dots"><span>.</span><span>.</span><span>.</span></span>
        <span class="chevron">&#8964;</span>
      </button>
      <div class="expandable" id="expandable" hidden>
        {rest_html}
      </div>
    </div>
    <script>
      function toggleExpand() {{
        var btn = document.getElementById('show-more-btn');
        var body = document.getElementById('expandable');
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        if (expanded) {{
          body.hidden = true;
          btn.setAttribute('aria-expanded', 'false');
          btn.querySelector('.chevron').style.transform = 'rotate(0deg)';
        }} else {{
          body.hidden = false;
          btn.setAttribute('aria-expanded', 'true');
          btn.querySelector('.chevron').style.transform = 'rotate(180deg)';
        }}
      }}
    </script>
'''

    # ── Write .md ────────────────────────────────────────────────────────────
    md_path = f'public/posts/{slug}.md'
    full_content_md = content_md  # full, unsplit version for the .md file
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f'# {title}\n\n')
        f.write(f'*Published: {date_display}*\n\n')
        f.write(full_content_md)
    print(f'Generated MD: {md_path}')

    # ── Write .html ──────────────────────────────────────────────────────────
    html_path = f'public/posts/{slug}.html'
    html_doc = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title_esc}</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: {t['bg']};
      color: {t['text']};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1rem;
      line-height: 1.7;
      padding: 2rem 1rem 4rem;
    }}
    .post-wrap {{
      max-width: 720px;
      margin: 0 auto;
      background: {t['surface']};
      border: 1px solid {t['border']};
      border-radius: 4px;
      padding: 2.5rem 2rem;
    }}
    .post-meta {{
      font-size: 0.8rem;
      color: {t['muted']};
      margin-bottom: 2rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }}
    h1 {{
      font-size: clamp(1.6rem, 4vw, 2.4rem);
      color: {t['heading']};
      line-height: 1.2;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }}
    h2, h3, h4 {{
      color: {t['heading']};
      margin: 2rem 0 0.75rem;
      line-height: 1.3;
    }}
    h2 {{ font-size: 1.4rem; }}
    h3 {{ font-size: 1.15rem; }}
    p {{ color: {t['body_text']}; margin-bottom: 1.2rem; max-width: 68ch; }}
    a {{ color: {t['accent']}; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    code {{
      background: {t['code_bg']};
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.88em;
      font-family: 'Fira Code', 'Cascadia Code', monospace;
    }}
    pre {{
      background: {t['pre_bg']};
      border: 1px solid {t['border']};
      border-radius: 4px;
      padding: 1.2rem;
      overflow-x: auto;
      margin: 1.5rem 0;
    }}
    pre code {{ background: none; padding: 0; }}
    blockquote {{
      border-left: 2px solid {t['accent']};
      padding: 0.5rem 0 0.5rem 1.2rem;
      margin: 1.5rem 0;
      color: {t['muted']};
      font-style: italic;
    }}
    ul, ol {{ padding-left: 1.5rem; margin-bottom: 1.2rem; color: {t['body_text']}; }}
    li {{ margin-bottom: 0.4rem; }}
    hr {{ border: none; border-top: 1px solid {t['border']}; margin: 2rem 0; }}
    table {{ width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }}
    th, td {{ padding: 0.6rem 0.8rem; border: 1px solid {t['border']}; text-align: left; }}
    th {{ background: {t['code_bg']}; color: {t['heading']}; }}
    .post-figure {{ margin: 1.5rem 0; }}
    .post-figure img {{ width: 100%; border-radius: 4px; border: 1px solid {t['border']}; }}
    .post-figure figcaption {{ font-size: 0.78rem; color: {t['muted']}; margin-top: 0.4rem; }}
    .back-link {{
      display: inline-block;
      margin-bottom: 1.5rem;
      font-size: 0.85rem;
      color: {t['muted']};
      text-decoration: none;
    }}
    .back-link:hover {{ color: {t['accent']}; }}
    .show-more-btn {{
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: none;
      border: 1px solid {t['border']};
      border-radius: 4px;
      color: {t['muted']};
      font-size: 0.9rem;
      padding: 0.4rem 1rem;
      cursor: pointer;
      margin: 1.5rem 0;
      transition: color 0.2s, border-color 0.2s;
    }}
    .show-more-btn:hover {{ color: {t['accent']}; border-color: {t['accent']}; }}
    .dots span {{
      animation: bounce 1.2s infinite;
      display: inline-block;
    }}
    .dots span:nth-child(2) {{ animation-delay: 0.15s; }}
    .dots span:nth-child(3) {{ animation-delay: 0.3s; }}
    @keyframes bounce {{
      0%, 80%, 100% {{ transform: translateY(0); }}
      40% {{ transform: translateY(-4px); }}
    }}
    .chevron {{
      display: inline-block;
      transition: transform 0.3s ease;
      font-size: 1.1rem;
      line-height: 1;
    }}
    .expandable {{
      animation: fadeIn 0.35s ease both;
    }}
    {anim_css}
  </style>
</head>
<body>
  <div class="post-wrap">
    <a class="back-link" href="/#blog">← Back to blog</a>
    <h1>{title_esc}</h1>
    <p class="post-meta">{date_display}</p>
    {intro_html}
    {show_more_block}
  </div>
</body>
</html>'''

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_doc)
    print(f'Generated HTML: {html_path}')

    posts = [p for p in posts if p.get('slug') != slug]
    posts.insert(0, {{
        'slug':  slug,
        'title': title,
        'date':  date_display,
        'issue': number,
        'style': style,
    }})
    print(f'Index entry added for: {slug}')

# ── Write updated index ───────────────────────────────────────────────────────
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(posts, f, indent=2, ensure_ascii=False)
print(f'Index written: {{len(posts)}} total posts')
