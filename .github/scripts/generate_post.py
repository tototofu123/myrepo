#!/usr/bin/env python3
import os
import re
import json
import html
import markdown

title = os.environ.get('ISSUE_TITLE', 'Untitled')
body = os.environ.get('ISSUE_BODY', '')
number = os.environ.get('ISSUE_NUMBER', '0')
date_raw = os.environ.get('ISSUE_DATE', '')
date = date_raw[:10] if date_raw else ''

# ── Parse structured fields from issue body ──────────────────────────────────
# Format expected:
# ## TITLE
# My Post Title
# ## CONTENT
# markdown here...
# ## STYLE
# dark | light | minimal | colorful
# ## IMAGES
# https://example.com/img1.jpg :: Alt text for image
# ## ANIMATIONS
# fade | slide | pop

def extract_section(body_text, section_name):
    pattern = rf'##\s*{section_name}\s*\n(.*?)(?=\n##\s|$)'
    match = re.search(pattern, body_text, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else ''

# If structured format, use parsed fields; otherwise treat entire body as content
has_sections = bool(re.search(r'##\s*(CONTENT|TITLE)', body, re.IGNORECASE))

if has_sections:
    parsed_title = extract_section(body, 'TITLE') or title
    content_md = extract_section(body, 'CONTENT') or body
    style = extract_section(body, 'STYLE').lower() or 'dark'
    images_raw = extract_section(body, 'IMAGES')
    animations_raw = extract_section(body, 'ANIMATIONS').lower()
else:
    parsed_title = title
    content_md = body
    style = 'dark'
    images_raw = ''
    animations_raw = 'fade'

# Use issue title as canonical title
final_title = title  # issue title is always the post title

# ── Images ───────────────────────────────────────────────────────────────────
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

# Inject images into content at [IMAGE_n] placeholders or append at end
for i, img in enumerate(images):
    placeholder = f'[IMAGE_{i+1}]'
    img_html = f'<figure class="post-figure"><img src="{html.escape(img["url"])}" alt="{html.escape(img["alt"])}" loading="lazy" /><figcaption>{html.escape(img["alt"])}</figcaption></figure>'
    if placeholder in content_md:
        content_md = content_md.replace(placeholder, img_html)
    else:
        content_md += f'\n\n{img_html}'

# ── Convert markdown to HTML ─────────────────────────────────────────────────
content_html = markdown.markdown(
    content_md,
    extensions=['fenced_code', 'tables', 'nl2br', 'attr_list']
)

# ── Slug ─────────────────────────────────────────────────────────────────────
slug = re.sub(r'[^a-z0-9]+', '-', final_title.lower()).strip('-')
filename = f'public/posts/{slug}.html'

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

t = themes.get(style, themes['dark'])

# ── Animation presets ─────────────────────────────────────────────────────────
anim_presets = {
    'fade': '''
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.post-wrap { animation: fadeIn 0.5s ease both; }
.post-body h2, .post-body h3 { animation: fadeIn 0.4s ease both; }
''',
    'slide': '''
@keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
.post-wrap { animation: slideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
.post-body p { animation: slideIn 0.35s ease both; }
''',
    'pop': '''
@keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.post-wrap { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.post-body h2 { animation: popIn 0.3s ease both; }
''',
    'none': '',
}

anim_names = [a.strip() for a in animations_raw.replace(',', ' ').split() if a.strip()]
anim_css = '\n'.join(anim_presets.get(a, '') for a in anim_names) or anim_presets['fade']

# ── Intersection observer for section reveals ─────────────────────────────────
scroll_js = '''
<script>
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.post-body h2, .post-body h3, .post-body p, .post-body pre, .post-figure')
    .forEach(el => observer.observe(el));
</script>
'''

title_esc = html.escape(final_title)

post_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title_esc} — lai.codes</title>
  <meta name="description" content="{title_esc} — a post on lai.codes">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{
      --bg: {t["bg"]};
      --surface: {t["surface"]};
      --border: {t["border"]};
      --text: {t["text"]};
      --muted: {t["muted"]};
      --accent: {t["accent"]};
      --heading: {t["heading"]};
      --body-text: {t["body_text"]};
      --code-bg: {t["code_bg"]};
      --pre-bg: {t["pre_bg"]};
    }}
    html {{ scroll-behavior: smooth; }}
    body {{
      font-family: \'Inter\', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.75;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }}
    /* Nav */
    .site-nav {{
      position: sticky; top: 0; z-index: 10;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex; align-items: center; gap: 8px;
    }}
    .site-nav a {{ text-decoration: none; color: var(--muted); font-size: 13px; transition: color 0.15s; }}
    .site-nav a:hover {{ color: var(--text); }}
    .site-nav .sep {{ color: var(--border); }}
    .site-nav .brand {{ color: var(--accent); font-weight: 600; }}
    /* Post layout */
    .post-wrap {{ max-width: 700px; margin: 0 auto; padding: 56px 24px 120px; }}
    .post-meta {{ display: flex; align-items: center; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }}
    .post-date {{ font-size: 12px; color: var(--muted); font-family: \'JetBrains Mono\', monospace; letter-spacing: 0.04em; }}
    .post-tag {{
      font-size: 11px; background: var(--surface); border: 1px solid var(--border);
      color: var(--muted); padding: 2px 8px; border-radius: 4px;
      font-family: \'JetBrains Mono\', monospace; text-transform: uppercase; letter-spacing: 0.06em;
    }}
    .post-tag.style-tag {{ color: var(--accent); border-color: var(--accent); opacity: 0.7; }}
    h1.post-title {{
      font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 700;
      line-height: 1.2; margin-bottom: 36px; letter-spacing: -0.02em; color: var(--heading);
    }}
    .divider {{ width: 40px; height: 3px; background: var(--accent); margin: 36px 0; border-radius: 2px; }}
    /* Body styles */
    .post-body h2 {{
      font-size: 1.35rem; font-weight: 600; color: var(--heading);
      margin: 2.2em 0 0.7em; border-bottom: 1px solid var(--border); padding-bottom: 8px;
      letter-spacing: -0.01em;
    }}
    .post-body h3 {{ font-size: 1.1rem; font-weight: 600; color: var(--heading); margin: 1.8em 0 0.5em; }}
    .post-body p {{ margin-bottom: 1.3em; color: var(--body-text); }}
    .post-body ul, .post-body ol {{ margin: 0.8em 0 1.3em 1.6em; color: var(--body-text); }}
    .post-body li {{ margin-bottom: 0.35em; }}
    .post-body strong {{ color: var(--text); font-weight: 600; }}
    .post-body em {{ color: var(--muted); font-style: italic; }}
    .post-body a {{ color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }}
    .post-body a:hover {{ opacity: 0.8; }}
    .post-body code {{
      font-family: \'JetBrains Mono\', monospace;
      background: var(--code-bg); border: 1px solid var(--border);
      padding: 1px 6px; border-radius: 4px; font-size: 0.85em; color: var(--accent);
    }}
    .post-body pre {{
      background: var(--pre-bg); border: 1px solid var(--border);
      border-radius: 8px; padding: 20px; overflow-x: auto; margin: 1.6em 0;
    }}
    .post-body pre code {{ background: none; border: none; padding: 0; color: var(--text); font-size: 0.88em; }}
    .post-body table {{ border-collapse: collapse; width: 100%; margin: 1.5em 0; }}
    .post-body th, .post-body td {{ border: 1px solid var(--border); padding: 8px 12px; text-align: left; font-size: 0.9em; }}
    .post-body th {{ background: var(--surface); color: var(--text); font-weight: 600; }}
    .post-body blockquote {{
      border-left: 3px solid var(--accent); padding: 12px 20px;
      margin: 1.5em 0; background: var(--surface); border-radius: 0 6px 6px 0; color: var(--muted);
    }}
    /* Images */
    .post-figure {{ margin: 2em 0; }}
    .post-figure img {{ width: 100%; border-radius: 8px; border: 1px solid var(--border); display: block; }}
    .post-figure figcaption {{ font-size: 12px; color: var(--muted); margin-top: 8px; text-align: center; font-style: italic; }}
    /* Scroll reveal */
    .post-body h2, .post-body h3, .post-body p, .post-body pre, .post-figure {{
      opacity: 0; transform: translateY(10px);
      transition: opacity 0.45s ease, transform 0.45s ease;
    }}
    .post-body h2.visible, .post-body h3.visible, .post-body p.visible,
    .post-body pre.visible, .post-figure.visible {{
      opacity: 1; transform: translateY(0);
    }}
    /* Back link */
    .back-link {{
      display: inline-flex; align-items: center; gap: 6px; margin-top: 52px;
      font-size: 13px; color: var(--muted); text-decoration: none;
      border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px;
      transition: all 0.15s;
    }}
    .back-link:hover {{ color: var(--text); border-color: var(--accent); }}
    /* Animations */
    {anim_css}
    @media (max-width: 640px) {{
      .post-wrap {{ padding: 32px 16px 80px; }}
      h1.post-title {{ font-size: 1.5rem; }}
    }}
  </style>
</head>
<body>
  <nav class="site-nav">
    <a href="/" class="brand">lai.codes</a>
    <span class="sep">/</span>
    <a href="/blog">blog</a>
    <span class="sep">/</span>
    <span style="color:var(--text);font-size:13px">{title_esc}</span>
  </nav>

  <article class="post-wrap">
    <div class="post-meta">
      <span class="post-date">{date}</span>
      <span class="post-tag">blog</span>
      <span class="post-tag style-tag">{style}</span>
    </div>
    <h1 class="post-title">{title_esc}</h1>
    <div class="divider"></div>
    <div class="post-body">
      {content_html}
    </div>
    <a href="/blog" class="back-link">← All posts</a>
  </article>

  {scroll_js}
</body>
</html>
'''

os.makedirs('public/posts', exist_ok=True)
with open(filename, 'w', encoding='utf-8') as f:
    f.write(post_html)
print(f'Generated: {filename}')

# ── Update index.json ─────────────────────────────────────────────────────────
index_path = 'public/posts/index.json'
posts = []
if os.path.exists(index_path):
    with open(index_path, encoding='utf-8') as f:
        try:
            posts = json.load(f)
        except Exception:
            posts = []

posts = [p for p in posts if p.get('slug') != slug]
posts.insert(0, {
    'slug': slug,
    'title': final_title,
    'date': date,
    'issue': number,
    'style': style,
})

with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(posts, f, indent=2, ensure_ascii=False)
print(f'Index updated: {len(posts)} posts')
