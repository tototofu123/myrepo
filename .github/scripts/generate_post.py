import os
import re
import json
import html

title = os.environ.get('ISSUE_TITLE', '')
body = os.environ.get('ISSUE_BODY', '')
number = os.environ.get('ISSUE_NUMBER', '')
date_raw = os.environ.get('ISSUE_DATE', '')
date = date_raw[:10]

# Generate slug
slug = title.lower()
slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')

filename = f'public/posts/{slug}.html'


def md_to_html(text):
    lines = text.split('\n')
    out = []
    in_code = False
    for line in lines:
        if line.startswith('```'):
            if not in_code:
                out.append('<pre><code>')
                in_code = True
            else:
                out.append('</code></pre>')
                in_code = False
        elif in_code:
            out.append(html.escape(line))
        elif line.startswith('### '):
            out.append(f'<h3>{html.escape(line[4:])}</h3>')
        elif line.startswith('## '):
            out.append(f'<h2>{html.escape(line[3:])}</h2>')
        elif line.startswith('# '):
            out.append(f'<h1>{html.escape(line[2:])}</h1>')
        elif line.startswith('- ') or line.startswith('* '):
            out.append(f'<li>{html.escape(line[2:])}</li>')
        elif line.strip() == '':
            out.append('<br>')
        else:
            escaped = html.escape(line)
            escaped = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', escaped)
            escaped = re.sub(r'\*(.+?)\*', r'<em>\1</em>', escaped)
            escaped = re.sub(r'`(.+?)`', r'<code>\1</code>', escaped)
            out.append(f'<p>{escaped}</p>')
    return '\n'.join(out)


body_html = md_to_html(body)
title_esc = html.escape(title)

post_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title_esc} — repo.lai.codes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{
      --bg: #0f0f0f;
      --surface: #161616;
      --border: #222;
      --text: #e8e8e8;
      --muted: #888;
      --accent: #a8ff78;
      --font: \'Inter\', sans-serif;
      --mono: \'JetBrains Mono\', monospace;
    }}
    html {{ scroll-behavior: smooth; }}
    body {{
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }}
    .site-nav {{
      position: sticky; top: 0; z-index: 10;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .site-nav a {{
      text-decoration: none;
      color: var(--muted);
      font-size: 13px;
      transition: color 0.15s;
    }}
    .site-nav a:hover {{ color: var(--text); }}
    .site-nav .sep {{ color: var(--border); }}
    .site-nav .brand {{ color: var(--accent); font-weight: 500; }}
    .post-wrap {{
      max-width: 680px;
      margin: 0 auto;
      padding: 56px 24px 120px;
    }}
    .post-meta {{
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
    }}
    .post-date {{
      font-size: 12px;
      color: var(--muted);
      font-family: var(--mono);
      letter-spacing: 0.04em;
    }}
    .post-tag {{
      font-size: 11px;
      background: #1a1a1a;
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--mono);
    }}
    h1.post-title {{
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      font-weight: 600;
      line-height: 1.2;
      margin-bottom: 40px;
      letter-spacing: -0.02em;
    }}
    .post-body h1, .post-body h2, .post-body h3 {{
      font-weight: 600;
      margin: 2em 0 0.6em;
      letter-spacing: -0.01em;
    }}
    .post-body h2 {{ font-size: 1.3rem; border-bottom: 1px solid var(--border); padding-bottom: 8px; }}
    .post-body h3 {{ font-size: 1.1rem; color: #ccc; }}
    .post-body p {{ margin-bottom: 1.2em; color: #ccc; }}
    .post-body li {{ margin: 0.3em 0 0.3em 1.4em; color: #ccc; list-style: disc; }}
    .post-body strong {{ color: var(--text); font-weight: 600; }}
    .post-body em {{ color: #aaa; font-style: italic; }}
    .post-body code {{
      font-family: var(--mono);
      background: #1c1c1c;
      border: 1px solid var(--border);
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 0.85em;
      color: var(--accent);
    }}
    .post-body pre {{
      background: #141414;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 20px;
      overflow-x: auto;
      margin: 1.5em 0;
    }}
    .post-body pre code {{
      background: none;
      border: none;
      padding: 0;
      color: #ccc;
      font-size: 0.88em;
    }}
    .divider {{ width: 40px; height: 2px; background: var(--accent); margin: 40px 0; border-radius: 2px; }}
    .back-link {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 48px;
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 6px;
      transition: all 0.15s;
    }}
    .back-link:hover {{ color: var(--text); border-color: #444; }}
  </style>
</head>
<body>
  <nav class="site-nav">
    <a href="/" class="brand">repo.lai.codes</a>
    <span class="sep">/</span>
    <a href="/blog">blog</a>
    <span class="sep">/</span>
    <a href="#" style="color:var(--text)">{title_esc}</a>
  </nav>

  <article class="post-wrap">
    <div class="post-meta">
      <span class="post-date">{date}</span>
      <span class="post-tag">blog</span>
    </div>

    <h1 class="post-title">{title_esc}</h1>
    <div class="divider"></div>

    <div class="post-body">
{body_html}
    </div>

    <a href="/blog" class="back-link">← All posts</a>
  </article>
</body>
</html>'''

with open(filename, 'w') as f:
    f.write(post_html)
print(f'Generated: {filename}')

# Update index.json
index_path = 'public/posts/index.json'
posts = []
if os.path.exists(index_path):
    with open(index_path) as f:
        try:
            posts = json.load(f)
        except Exception:
            posts = []

# Remove duplicate if re-running
posts = [p for p in posts if p.get('slug') != slug]
posts.insert(0, {'slug': slug, 'title': title, 'date': date, 'issue': number})

with open(index_path, 'w') as f:
    json.dump(posts, f, indent=2)
print(f'Index updated: {len(posts)} posts')
