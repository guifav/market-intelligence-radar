"use client";

interface OverviewData {
  stats?: {
    articles?: { total: number; sources: number; divisions: number };
    people?: { total: number; decision_makers: number; c_level: number };
    companies?: { total: number; deal_involved: number };
    deals?: { total: number };
    topics?: { total: number; high_relevance: number };
    signals?: { total: number; high_impact: number };
  };
  topTopics?: { topic: string; category: string; relevance: string; mentions: number }[];
  recentArticles?: { article_id: string; url: string; title: string; source_name: string; division: string; sentiment: string; summary: string; scraped_at: string }[];
  divBreakdown?: { division: string; articles: number }[];
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
      <div className="text-2xl font-bold mt-1">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sub}</div>}
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const color = sentiment === "positive" ? "#22c55e" : sentiment === "negative" ? "#ef4444" : sentiment === "mixed" ? "#f59e0b" : "#737373";
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />;
}

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

const RELEVANCE_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#737373",
};

export function OverviewTab({ data }: { data: OverviewData | null }) {
  if (!data?.stats) return null;
  const { stats, topTopics, recentArticles, divBreakdown } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Articles" value={stats.articles?.total ?? 0} sub={`${stats.articles?.sources ?? 0} sources`} />
        <StatCard label="People" value={stats.people?.total ?? 0} sub={`${stats.people?.c_level ?? 0} C-level`} />
        <StatCard label="Companies" value={stats.companies?.total ?? 0} sub={`${stats.companies?.deal_involved ?? 0} in deals`} />
        <StatCard label="Deals" value={stats.deals?.total ?? 0} />
        <StatCard label="Topics" value={stats.topics?.total ?? 0} sub={`${stats.topics?.high_relevance ?? 0} high relevance`} />
        <StatCard label="Signals" value={stats.signals?.total ?? 0} sub={`${stats.signals?.high_impact ?? 0} high impact`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Division Breakdown */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-xs font-semibold mb-3">Coverage by Division</h3>
          <div className="space-y-2">
            {(divBreakdown ?? []).map((d) => {
              const maxArticles = Math.max(...(divBreakdown ?? []).map((x) => x.articles));
              const pct = maxArticles > 0 ? (d.articles / maxArticles) * 100 : 0;
              return (
                <div key={d.division}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span>{DIV_LABELS[d.division] || d.division}</span>
                    <span className="text-[var(--muted-foreground)]">{d.articles}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full bg-[var(--foreground)]" style={{ width: `${pct}%`, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Topics */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-xs font-semibold mb-3">Trending Topics</h3>
          <div className="space-y-1.5">
            {(topTopics ?? []).slice(0, 12).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RELEVANCE_COLORS[t.relevance] || "#737373" }} />
                <span className="flex-1 truncate">{t.topic}</span>
                <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">{t.category}</span>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)] w-4 text-right">{t.mentions}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Articles */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-xs font-semibold mb-3">Recent Articles</h3>
          <div className="space-y-2.5">
            {(recentArticles ?? []).slice(0, 8).map((a) => (
              <div key={a.article_id} className="text-[11px]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <SentimentDot sentiment={a.sentiment} />
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate hover:underline">{a.title}</a>
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)] pl-3">
                  {a.source_name} — {DIV_LABELS[a.division] || a.division}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
