import { useEffect, useState } from 'react';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import './App.css';

interface Repository {
  id: number;
  name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string;
  homepage: string;
  topics: string[];
  owner: { login: string };
  default_branch: string;
}

interface RepoDetails {
  languages: Record<string, number>;
  readme: string;
  tree: Array<{ path: string; type: string }>;
}

function RepoCard({ repo }: { repo: Repository }) {
  const [details, setDetails] = useState<RepoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
        const decoded = atob(readmeData.content);
        readme = sanitizeHtml(await marked(decoded));
      }

      const treeData = treeRes.ok ? await treeRes.json() : { tree: [] };
      const tree = treeData.tree.slice(0, 15); // Show first 15 files

      setDetails({ languages, readme, tree });
    } catch (err) {
      console.error('Failed to fetch details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!expanded) fetchDetails();
    setExpanded(!expanded);
  };

  return (
    <div className={`repo-card ${expanded ? 'expanded' : ''}`} onClick={handleToggle}>
      <div className="card-main">
        <div className="card-top">
          <h3>{repo.name}</h3>
          {repo.homepage && <span className="website-link">🔗 {repo.homepage.replace(/^https?:\/\//, '')}</span>}
        </div>
        <p className="description">{repo.description || 'No description provided.'}</p>
        
        <div className="topics">
          {repo.topics?.map(topic => (
            <span key={topic} className="topic-tag">#{topic}</span>
          ))}
        </div>

        <div className="card-footer">
          <span className="language">{repo.language}</span>
          <span className="stars">⭐ {repo.stargazers_count}</span>
        </div>
      </div>

      {expanded && (
        <div className="card-details" onClick={e => e.stopPropagation()}>
          {loading ? (
            <div className="detail-loader">Polishing the grain...</div>
          ) : (
            <>
              <div className="detail-section">
                <h4>Language Composition</h4>
                <div className="lang-bar">
                  {details && Object.entries(details.languages).map(([lang, val]) => (
                    <div 
                      key={lang} 
                      className="lang-segment" 
                      style={{ width: `${(val / Object.values(details.languages).reduce((a, b) => a + b, 0)) * 100}%` }}
                      title={`${lang}: ${Math.round((val / Object.values(details.languages).reduce((a, b) => a + b, 0)) * 100)}%`}
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
                <div className="readme-content" dangerouslySetInnerHTML={{ __html: details?.readme || '' }} />
              </div>

              <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="github-button">
                View on GitHub
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch('https://api.github.com/users/tototofu123/repos?sort=updated&per_page=100');
        if (!response.ok) throw new Error('Failed to fetch repositories');
        const data = await response.json();
        setRepos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>repo.<span className="accent">lai.codes</span></h1>
        <p className="subtitle">Interactive Showcase for <a href="https://github.com/tototofu123" target="_blank" rel="noopener noreferrer">@tototofu123</a></p>
      </header>

      {loading && <div className="loader">Carving the inventory...</div>}
      {error && <div className="error">Error: {error}</div>}

      <div className="repo-grid">
        {repos.map(repo => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>

      <footer className="footer">
        <p>© {new Date().getFullYear()} repo.lai.codes | Built with React + GitHub API</p>
      </footer>
    </div>
  );
}

export default App;
