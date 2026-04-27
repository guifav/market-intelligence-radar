"use client";

interface Totals {
  articles: number;
  people: number;
  unique_people: number;
  companies: number;
  deals: number;
  signals: number;
  topics: number;
  sources_used: number;
  people_in_sf: number;
  people_enriched: number;
}

export function StatsCards({ totals }: { totals: Totals | null }) {
  if (!totals) return null;
  const cards = [
    { label: "Articles", value: totals.articles },
    { label: "Sources", value: totals.sources_used },
    { label: "Unique People", value: totals.unique_people || totals.people },
    { label: "Companies", value: totals.companies },
    { label: "Enriched", value: totals.people_enriched, accent: true },
    { label: "In CRM", value: totals.people_in_sf, accent: true },
    { label: "Deals", value: totals.deals },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-lg border p-3 ${c.accent ? "border-[var(--foreground)]/20 bg-[var(--accent)]" : "border-[var(--border)]"}`}>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{c.label}</p>
          <p className="text-xl font-bold mt-1">{(c.value || 0).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
