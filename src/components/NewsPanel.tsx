import { useEffect, useState } from "react";
import type { ContractSpec, NewsArticleHeadline } from "../types";

interface NewsPanelProps {
  label: string | null;
  spec: ContractSpec | null;
  connected: boolean;
  fetchNews: (spec: ContractSpec, days: number) => Promise<NewsArticleHeadline[]>;
  fetchNewsArticle: (providerCode: string, articleId: string) => Promise<string>;
}

function formatTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

export function NewsPanel({ label, spec, connected, fetchNews, fetchNewsArticle }: NewsPanelProps) {
  const [articles, setArticles] = useState<NewsArticleHeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [articleBody, setArticleBody] = useState<string | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  useEffect(() => {
    if (!spec || !connected) {
      setArticles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpandedId(null);
    fetchNews(spec, 7)
      .then((result) => !cancelled && setArticles(result))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [spec, connected, fetchNews]);

  const toggle = async (article: NewsArticleHeadline) => {
    if (expandedId === article.articleId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(article.articleId);
    setArticleBody(null);
    setArticleLoading(true);
    try {
      const body = await fetchNewsArticle(article.providerCode, article.articleId);
      setArticleBody(body);
    } catch (e) {
      setArticleBody(`Failed to load article: ${String(e)}`);
    } finally {
      setArticleLoading(false);
    }
  };

  return (
    <div className="panel news-panel">
      <div className="panel-header">
        <span>News {label ? `— ${label}` : ""}</span>
      </div>
      {!spec && <div className="empty-state">Select a symbol to see headlines</div>}
      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-banner">Loading headlines…</div>}
      <div className="news-list">
        {spec && !loading && articles.length === 0 && <div className="empty-row">No recent headlines</div>}
        {articles.map((a) => (
          <div key={a.articleId} className="news-item">
            <button className="news-headline" onClick={() => toggle(a)}>
              <span className="news-time">{formatTime(a.time)}</span>
              <span>{a.headline}</span>
            </button>
            {expandedId === a.articleId && (
              <div className="news-body">
                {articleLoading ? "Loading…" : articleBody}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
