import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PostMeta {
  slug: string;
  title: string;
  date: string;
  issue: string;
  style?: string;
}

const styleColors: Record<string, string> = {
  dark: '#a8ff78',
  light: '#01696f',
  minimal: '#000000',
  colorful: '#f72585',
};

export default function Blog() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/posts/index.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="blog-page">
      <header className="blog-header">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          blog.<span className="accent">lai.codes</span>
        </motion.h1>
        <p className="subtitle">Notes, projects, and ideas from <a href="https://github.com/tototofu123" target="_blank" rel="noopener noreferrer">@tototofu123</a></p>
      </header>

      {loading && <div className="loader">Loading posts...</div>}

      {!loading && posts.length === 0 && (
        <div className="no-results">No posts yet — check back soon.</div>
      )}

      <motion.div layout className="blog-list">
        {posts.map((post, i) => (
          <motion.a
            key={post.slug}
            href={`/posts/${post.slug}.html`}
            className="blog-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
          >
            <div className="blog-card-top">
              <span
                className="blog-style-dot"
                style={{ background: styleColors[post.style || 'dark'] }}
                title={post.style || 'dark'}
              />
              <span className="blog-date">{post.date}</span>
            </div>
            <h2 className="blog-title">{post.title}</h2>
            <span className="blog-read">Read post →</span>
          </motion.a>
        ))}
      </motion.div>
    </div>
  );
}
