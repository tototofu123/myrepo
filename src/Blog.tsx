import { useEffect, useState } from 'react';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

interface PostMeta {
  slug: string;
  title: string;
  date: string;
  issue: string;
  summary?: string;
  image?: string;
  style?: string;
}

const styleColors: Record<string, string> = {
  dark: '#a8ff78',
  light: '#01696f',
  minimal: '#000000',
  colorful: '#f72585',
};

// ── Post reader (loaded inline via hash, no page navigation) ─────────────────
function PostReader({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/posts/${slug}.md`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(async md => {
        const raw = await marked(md);
        setHtml(sanitizeHtml(raw, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'details', 'summary']),
          allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'width', 'height'], a: ['href', 'target', 'rel'] }
        }));
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [slug]);

  return (
    <div className="post-reader">
      <button className="back-btn" onClick={onBack}>← Back to blog</button>
      {loading && <div className="loader">Loading post...</div>}
      {error && <div className="error">Post not found.</div>}
      {!loading && !error && (
        <article
          className="post-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

// ── Blog list + inline post router ───────────────────────────────────────────
export default function Blog({ postSlug }: { postSlug?: string }) {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/posts/index.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // If a slug is passed we're in post-reader mode
  if (postSlug) {
    return <PostReader slug={postSlug} onBack={() => { window.location.hash = '#blog'; }} />;
  }

  return (
    <div className="blog-page">
      <header className="blog-header">
        <h1>blog.<span className="accent">lai.codes</span></h1>
        <p className="subtitle">Notes, projects, and ideas from <a href="https://github.com/tototofu123" target="_blank" rel="noopener noreferrer">@tototofu123</a></p>
      </header>

      {loading && <div className="loader">Loading posts...</div>}

      {!loading && posts.length === 0 && (
        <div className="no-results">No posts yet — check back soon.</div>
      )}

      <div className="blog-list">
        {posts.map(post => (
          <a
            key={post.slug}
            href={`#blog/${post.slug}`}
            className={`blog-card${post.image ? ' blog-card--has-img' : ''}`}
          >
            {post.image && (
              <div className="blog-card-img-wrap">
                <img
                  src={post.image}
                  alt={post.title}
                  className="blog-card-img"
                  loading="lazy"
                  width={600}
                  height={200}
                />
              </div>
            )}
            <div className="blog-card-body">
              <div className="blog-card-top">
                <span
                  className="blog-style-dot"
                  style={{ background: styleColors[post.style || 'dark'] }}
                  title={post.style || 'dark'}
                />
                <span className="blog-date">{post.date}</span>
              </div>
              <h2 className="blog-title">{post.title}</h2>
              {post.summary && <p className="blog-summary">{post.summary}</p>}
              <span className="blog-read">Read post →</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
