import { useEffect, useState, useMemo } from 'react';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { motion, AnimatePresence } from 'framer-motion';
import Blog from './Blog';
import './App.css';

interface Repository {
  id: number;
  name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  homepage: string | null;
  topics: string[];
  owner: { login: string };
  default_branch: string;
}

interface RepoDetails {
  languages: Record<string, number>;
  readme: string;
  tree: Array<{ path: string; type: string }>;
}

function RepoCard({
  repo,
  isExpanded,
  onToggle
}: {
  repo: Repository;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [details, setDetails] = useState<RepoDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = async () => {
    if (details || loading) return;
    setLoading(true);
    try {
      const [langRes, readmeRes, treeRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/languages`),
        fetch(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/readme`),
        fetch(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/git/trees/${repo.default_branch}?recursive=1`)
      ]);

      const languages = langRes.ok ? await langRes.json() : {};

      let readme = 'No README found.';
      if (readmeRes.ok) {
        const readmeData = await readmeRes.json();
        const binaryString = atob(readmeData.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const decoded = new TextDecoder('utf-8').decode(bytes);
        readme = sanitizeHtml(await marked(decoded));
      }

      const treeData = treeRes.ok ? await treeRes.json() : { tree: [] };
      setDetails({ languages, readme, tree: treeData.tree.slice(0, 15) });
    } catch (err) {
      console.error('Failed to fetch details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    if (!isExpanded) fetchDetails();
    onToggle();
  };

  const displayLanguage = repo.language ||
    (details?.tree.some(f => f.path.endsWith('.md')) ? 'Markdown' :
     details?.tree.some(f => f.path.endsWith('.txt')) ? 'Text' : 'Other');

  const totalLangSize = details
    ? Object.values(details.languages).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`repo-card ${isExpanded ? 'expanded' : ''}`}
      onClick={handleCardClick}
    >
      <div className="card-main">
        <div className="card-top">
          <h3>{repo.name}</h3>
        </div>
        {repo.homepage && (
          <div className="website-row">
            <a
              href={repo.homepage.startsWith('http') ? repo.homepage : `https://${repo.homepage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="website-link"
              onClick={e => e.stopPropagation()}
            >
              🔗 {repo.homepage.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        <p className="description">{repo.description || 'No description provided.'}</p>
        <div className="topics">
          {repo.topics?.map(topic => (
            <span key={topic} className="topic-tag">#{topic}</span>
          ))}
        </div>
        <div className="card-footer">
          <span className="language">{displayLanguage}</span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="card-details"
            onClick={e => e.stopPropagation()}
          >
            {loading ? (
              <div className="detail-loader">Polishing the grain...</div>
            ) : (
              <>
                <div className="detail-section">
                  <h4>Language Composition</h4>
                  <div className="lang-stats">
                    {details && Object.entries(details.languages).map(([lang, val]) => {
                      const percentage = Math.round((val / totalLangSize) * 100);
                      return (
                        <div key={lang} className="lang-item">
                          <span className="lang-name">{lang}</span>
                          <span className="lang-pct">{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="lang-bar">
                    {details && Object.entries(details.languages).map(([lang, val]) => (
                      <div
                        key={lang}
                        className="lang-segment"
                        style={{ width: `${(val / totalLangSize) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>File Structure (Partial)</h4>
                  <ul className="tree-list">
                    {details?.tree.map(node => (
                      <li key={node.path} className={node.type === 'tree' ? 'folder' : 'file'}>
                        {node.type === 'tree' ? '📁' : '📄'} {node.path}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="detail-section readme-section">
                  <h4>README</h4>
                  <div
                    className="readme-content"
                    dangerouslySetInnerHTML={{ __html: details?.readme || '' }}
                  />
                </div>

                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="github-button"
                >
                  View on GitHub
                </a>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RepoShowcase() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch('https://api.github.com/users/tototofu123/repos?sort=updated&per_page=100');
        if (!response.ok) throw new Error('Failed to fetch repositories');
        const data: Repository[] = await response.json();
        const filteredData = data
          .filter(repo =>
            !repo.name.toLowerCase().includes('design.md') &&
            !repo.name.toLowerCase().includes('design-md')
          )
          .map(repo => {
            if (repo.name === 'hk-bus-fetch' || repo.name === 'hkbus')
              return { ...repo, homepage: 'https://tototofu123.github.io/hk-bus-fetch/' };
            return repo;
          });
        setRepos(filteredData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    const checkScroll = () => setShowScroll(window.pageYOffset > 400);
    window.addEventListener('scroll', checkScroll);
    fetchRepos();
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  const filteredRepos = useMemo(() =>
    repos.filter(repo =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      (repo.language && repo.language.toLowerCase().includes(search.toLowerCase())) ||
      (repo.description && repo.description.toLowerCase().includes(search.toLowerCase()))
    ),
    [repos, search]
  );

  return (
    <div className="app-container">
      <header className="header">
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          repo.<span className="accent">lai.codes</span>
        </motion.h1>
        <p className="subtitle">Interactive Showcase for{' '}
          <a href="https://github.com/tototofu123" target="_blank" rel="noopener noreferrer">@tototofu123</a>
        </p>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search projects by name, language, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </header>

      {loading && <div className="loader">Carving the inventory...</div>}
      {error && <div className="error">Error: {error}</div>}

      <motion.div layout className="repo-grid">
        {filteredRepos.map(repo => (
          <RepoCard
            key={repo.id}
            repo={repo}
            isExpanded={expandedId === repo.id}
            onToggle={() => setExpandedId(expandedId === repo.id ? null : repo.id)}
          />
        ))}
      </motion.div>

      {filteredRepos.length === 0 && !loading && (
        <div className="no-results">No matches found in the woodpile.</div>
      )}

      <footer className="footer">
        <p>© {new Date().getFullYear()} lai.codes | Built with React + Framer Motion + GitHub API</p>
      </footer>

      <AnimatePresence>
        {showScroll && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="scroll-top"
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Simple hash-based router ──────────────────────────────────────────────────
function App() {
  const [route, setRoute] = useState(window.location.hash || '#repo');

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#repo');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <nav className="top-nav">
        <a href="#repo" className={route === '#repo' ? 'active' : ''}>repos</a>
        <span className="nav-sep">/</span>
        <a href="#blog" className={route === '#blog' ? 'active' : ''}>blog</a>
      </nav>
      {route === '#blog' ? <Blog /> : <RepoShowcase />}
    </>
  );
}

export default App;
