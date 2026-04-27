"use client";

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

interface DivRow { division: string; cnt: number; oldest?: string; newest?: string }

export function DivisionBreakdown({
  articles, people, companies, deals, signals,
}: {
  articles: DivRow[]; people: DivRow[]; companies: DivRow[];
  deals: DivRow[]; signals: DivRow[];
}) {
  const lookup = (arr: DivRow[], div: string) => arr.find((r) => r.division === div)?.cnt || 0;
  const allDivisions = Array.from(new Set([
    ...articles.map((r) => r.division),
    ...people.map((r) => r.division),
    ...companies.map((r) => r.division),
    ...deals.map((r) => r.division),
    ...signals.map((r) => r.division),
  ]));

  const sortWeight = (div: string) =>
    lookup(articles, div) * 1_000_000 +
    lookup(people, div) * 10_000 +
    lookup(companies, div) * 100 +
    lookup(deals, div) +
    lookup(signals, div);

  allDivisions.sort((a, b) => sortWeight(b) - sortWeight(a) || a.localeCompare(b));

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-semibold">Division Breakdown</h3>
      </div>
      <table className="w-full text-[11px] min-w-[700px]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
            <th className="text-left px-4 py-2 font-medium">Division</th>
            <th className="text-right px-3 py-2 font-medium">Articles</th>
            <th className="text-right px-3 py-2 font-medium">People</th>
            <th className="text-right px-3 py-2 font-medium">Companies</th>
            <th className="text-right px-3 py-2 font-medium">Deals</th>
            <th className="text-right px-3 py-2 font-medium">Signals</th>
            <th className="text-left px-3 py-2 font-medium">Last Scan</th>
          </tr>
        </thead>
        <tbody>
          {allDivisions.map((division) => {
            const articleRow = articles.find((r) => r.division === division);
            return (
              <tr key={division} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
                <td className="px-4 py-2 font-medium">{DIV_LABELS[division] || division}</td>
                <td className="text-right px-3 py-2">{lookup(articles, division)}</td>
                <td className="text-right px-3 py-2">{lookup(people, division)}</td>
                <td className="text-right px-3 py-2">{lookup(companies, division)}</td>
                <td className="text-right px-3 py-2">{lookup(deals, division)}</td>
                <td className="text-right px-3 py-2">{lookup(signals, division)}</td>
                <td className="px-3 py-2 text-[var(--muted-foreground)]">
                  {articleRow?.newest ? new Date(articleRow.newest).toLocaleDateString() : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
