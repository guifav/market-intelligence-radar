"use client";

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

interface TopSourceRow { source_name: string; division: string; articles: number }

export function TopSources({ data }: { data: TopSourceRow[] }) {
  const maxArticles = Math.max(...data.map((d) => d.articles), 1);

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-xs font-semibold mb-3">Top Sources by Article Count</h3>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {data.slice(0, 20).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-4 text-right text-[10px] text-[var(--muted-foreground)] shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{d.source_name}</span>
                <span className="text-[9px] text-[var(--muted-foreground)] shrink-0">{DIV_LABELS[d.division] || d.division}</span>
              </div>
              <div className="h-1 mt-0.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--foreground)]" style={{ width: `${(d.articles / maxArticles) * 100}%`, opacity: 0.6 }} />
              </div>
            </div>
            <span className="text-[10px] font-mono w-6 text-right shrink-0">{d.articles}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
