"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useCallback } from "react";
import { ExternalLink, ChevronDown, ChevronUp, BookOpen, Loader2, ArrowLeft, Search, X, Calendar } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

interface Article {
  article_id: string;
  url: string;
  title: string;
  source_name: string;
  division: string;
  language: string;
  sentiment: string;
  summary: string;
  content_preview: string;
  word_count: number;
  published_date: string;
  scraped_at: string;
}

interface FullArticle extends Article {
  full_content?: string;
  content_source?: string;
}

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e", negative: "#ef4444", mixed: "#f59e0b", neutral: "#737373",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/* ── Full Article Reader ─────────────────────────────────────── */

function ArticleReader({ articleId, onBack }: { articleId: string; onBack: () => void }) {
  const [article, setArticle] = useState<FullArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/article/${articleId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArticle(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  // Load on mount
  useState(() => { load(); });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        <p className="text-xs text-[var(--muted-foreground)]">Fetching full article... This may take a moment if scraping is needed.</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="space-y-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft size={14} /> Back to list
        </button>
        <p className="text-sm text-[var(--muted-foreground)]">Failed to load article: {error}</p>
      </div>
    );
  }

  const content = article.full_content || article.content_preview || "";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft size={14} /> Back to list
      </button>

      <article>
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: SENTIMENT_COLORS[article.sentiment] || "#737373" }}
            />
            <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
              {article.source_name} · {DIV_LABELS[article.division] || article.division}
            </span>
          </div>
          <h1 className="text-xl font-bold leading-tight">{article.title}</h1>
          {article.summary && (
            <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{article.summary}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--muted-foreground)]">
            {article.published_date && <span>{article.published_date}</span>}
            <span>{article.word_count.toLocaleString()} words</span>
            {article.content_source && (
              <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--muted)] text-[9px]">
                {article.content_source === "cached" ? "Cached" : article.content_source === "scraped_and_cleaned" ? "Freshly scraped" : article.content_source}
              </span>
            )}
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--foreground)]">
              <ExternalLink size={10} /> Source
            </a>
          </div>
        </header>

        <div className="border-t border-[var(--border)] pt-6">
          <div className="mir-article text-sm leading-relaxed">
            {renderMarkdown(content)}
          </div>
        </div>
      </article>
    </div>
  );
}

/** Simple markdown-to-JSX renderer (no library needed) */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="text-sm font-semibold mt-5 mb-2">{formatInline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-6 mb-2">{formatInline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-6 mb-3">{formatInline(line.slice(2))}</h2>);
    }
    // Blockquote
    else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-[var(--border)] pl-4 my-3 text-[var(--muted-foreground)] italic">
          {formatInline(line.slice(2))}
        </blockquote>
      );
    }
    // List items
    else if (line.match(/^[-*] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside my-3 space-y-1">
          {items.map((item, j) => <li key={j}>{formatInline(item)}</li>)}
        </ul>
      );
      continue;
    }
    // Numbered list
    else if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside my-3 space-y-1">
          {items.map((item, j) => <li key={j}>{formatInline(item)}</li>)}
        </ol>
      );
      continue;
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="my-4 border-[var(--border)]" />);
    }
    // Empty line
    else if (line.trim() === "") {
      // skip
    }
    // Regular paragraph
    else {
      elements.push(<p key={i} className="my-2">{formatInline(line)}</p>);
    }

    i++;
  }

  return <>{elements}</>;
}

/** Inline formatting: **bold**, *italic*, [link](url) */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    const matches = [
      boldMatch && { type: "bold", index: boldMatch.index!, match: boldMatch },
      italicMatch && { type: "italic", index: italicMatch.index!, match: italicMatch },
      linkMatch && { type: "link", index: linkMatch.index!, match: linkMatch },
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === "bold") {
      parts.push(<strong key={key++}>{first.match![1]}</strong>);
      remaining = remaining.slice(first.index + first.match![0].length);
    } else if (first.type === "italic") {
      parts.push(<em key={key++}>{first.match![1]}</em>);
      remaining = remaining.slice(first.index + first.match![0].length);
    } else if (first.type === "link") {
      parts.push(
        <a key={key++} href={first.match![2]} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--foreground)]">
          {first.match![1]}
        </a>
      );
      remaining = remaining.slice(first.index + first.match![0].length);
    }
  }

  return <>{parts}</>;
}

/* ── Article Card (list view) ───────────────────────────────── */

function ArticleCard({ article, onReadFull }: { article: Article; onReadFull: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: SENTIMENT_COLORS[article.sentiment] || "#737373" }}
                title={article.sentiment}
              />
              <h3 className="text-xs font-semibold truncate">{article.title}</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] flex-wrap">
              <span>{article.source_name}</span>
              <span>{DIV_LABELS[article.division] || article.division}</span>
              {article.published_date && (
                <span className="flex items-center gap-1" title="Published date">
                  <Calendar size={9} />
                  {formatDate(article.published_date)}
                </span>
              )}
              {article.scraped_at && (
                <span className="text-[var(--muted-foreground)]/60" title="Collected date">
                  collected {formatDate(article.scraped_at)}
                </span>
              )}
              <span>{article.word_count.toLocaleString()} words</span>
              {article.language && <span className="uppercase">{article.language}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onReadFull}
              className="p-1.5 rounded border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
              title="Read full article"
            >
              <BookOpen size={12} />
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
              title="Open source"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {article.summary && (
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)] leading-relaxed">{article.summary}</p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Collapse" : "Read excerpt"}
        </button>
      </div>

      {expanded && article.content_preview && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <div className="text-[11px] text-[var(--muted-foreground)] leading-relaxed whitespace-pre-line max-h-64 overflow-auto">
            {article.content_preview}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab Component ──────────────────────────────────────────── */

interface ArticlesData {
  articles?: Article[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface ArticlesTabProps {
  data: ArticlesData | null;
  loading?: boolean;
  onPageChange: (page: number) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  dateType?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onDateTypeChange?: (value: string) => void;
}

export function ArticlesTab({ data, loading, onPageChange, search, onSearchChange, dateFrom, dateTo, dateType, onDateFromChange, onDateToChange, onDateTypeChange }: ArticlesTabProps) {
  const [readingId, setReadingId] = useState<string | null>(null);
  const articles = data?.articles ?? [];

  if (readingId) {
    return <ArticleReader articleId={readingId} onBack={() => setReadingId(null)} />;
  }

  const hasFilters = !!(search || dateFrom || dateTo);

  return (
    <div>
      {/* Filters bar */}
      <div className="mb-4 space-y-2">
        {/* Search */}
        {onSearchChange && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search articles — title, summary, source, content..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Date filters */}
        {onDateFromChange && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dateType ?? "published"}
              onChange={(e) => onDateTypeChange?.(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option value="published">Published date</option>
              <option value="scraped">Collected date</option>
            </select>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-[var(--muted-foreground)]">From</label>
              <input
                type="date"
                value={dateFrom ?? ""}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-[var(--muted-foreground)]">To</label>
              <input
                type="date"
                value={dateTo ?? ""}
                onChange={(e) => onDateToChange?.(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { onDateFromChange(""); onDateToChange?.(""); }}
                className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results info */}
      {hasFilters && data && (
        <div className="mb-3 text-[11px] text-[var(--muted-foreground)]">
          {data.total === 0 ? "No articles found" : `${data.total?.toLocaleString()} article${data.total === 1 ? "" : "s"} found`}
          {search ? ` for "${search}"` : ""}
          {dateFrom || dateTo ? ` · ${dateFrom || "∞"} → ${dateTo || "today"}` : ""}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">
          {search ? "No articles match your search." : "No articles available."}
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <ArticleCard key={a.article_id} article={a} onReadFull={() => setReadingId(a.article_id)} />
          ))}
        </div>
      )}

      <Pagination
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 50}
        total={data?.total ?? 0}
        onPageChange={onPageChange}
      />
    </div>
  );
}
