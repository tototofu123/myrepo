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
    # Legacy single-issue fallback
    issues = [{
        'number': os.environ.get('ISSUE_NUMBER', '0'),
        'title':  os.environ.get('ISSUE_TITLE', 'Untitled'),
        'body':   os.environ.get('ISSUE_BODY', ''),
    }]
    if not publish_date_display:
        publish_date_display = os.environ.get('ISSUE_DATE', '')[:10]
    if not publish_date_iso:
        publish_date_iso = os.environ.get('ISSUE_DATE', '')[:10]

# ── Helpers ───────────────────────────────────────────────────────────────────
def extract_section(body_text, section_name):
    pattern = rf'##\s*{section_name}\s*\n(.*?)(?=\n##\s|$)'
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
        content_md   = extract_section(body, 'CONTENT') or body
        style        = extract_section(body, 'STYLE').lower() or 'dark'
        images_raw   = extract_section(body, 'IMAGES')
        animations_raw = extract_section(body, 'ANIMATIONS').lower()
    else:
        content_md   = body
        style        = 'dark'
        images_raw   = ''
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

    content_html = markdown.markdown(
        content_md,
        extensions=['fenced_code', 'tables', 'nl2br', 'attr_list']
    )

    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    filename = f'public/posts/{slug}.md'

    t = themes.get(style, themes['dark'])

    anim_names = [a.strip() for a in animations_raw.replace(',', ' ').split() if a.strip()]
    anim_css   = '\n'.join(anim_presets.get(a, '') for a in anim_names) or anim_presets['fade']

    title_esc = html.escape(title)
    date_display = publish_date_display  # actual live date, not issue created_at

    # Write the raw markdown file (for SPA inline rendering via Blog.tsx)
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f'# {title}\n\n')
        f.write(f'*Published: {date_display}*\n\n')
        f.write(content_md)
    print(f'Generated: {filename}')

    # Update index.json — remove any existing entry for this slug, prepend new
    posts = [p for p in posts if p.get('slug') != slug]
    posts.insert(0, {
        'slug':  slug,
        'title': title,
        'date':  date_display,
        'issue': number,
        'style': style,
    })
    print(f'Index entry added for: {slug}')

# ── Write updated index ───────────────────────────────────────────────────────
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(posts, f, indent=2, ensure_ascii=False)
print(f'Index written: {len(posts)} total posts')
