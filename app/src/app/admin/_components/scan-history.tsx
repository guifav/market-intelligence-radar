"use client";

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

interface ScanRow { division: string; source_name: string; articles: number; last_scraped: string }

export function ScanHistory({ recentScans }: { recentScans: ScanRow[] }) {
  return (
    <div className="rounded-lg border border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-semibold">Latest Source Activity</h3>
      </div>
      <div className="max-h-[350px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-[11px] min-w-[500px]">
          <thead className="sticky top-0 bg-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2 font-medium">Source</th>
              <th className="text-left px-3 py-2 font-medium">Division</th>
              <th className="text-right px-3 py-2 font-medium">Total Articles</th>
              <th className="text-left px-3 py-2 font-medium">Last Scraped</th>
            </tr>
          </thead>
          <tbody>
            {recentScans.map((s, i) => (
              <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
                <td className="px-4 py-1.5 font-medium">{s.source_name}</td>
                <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{DIV_LABELS[s.division] || s.division}</td>
                <td className="text-right px-3 py-1.5">{s.articles}</td>
                <td className="px-3 py-1.5 text-[var(--muted-foreground)]">
                  {new Date(s.last_scraped).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
