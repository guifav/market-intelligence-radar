"use client";

interface SentimentRow { sentiment: string; cnt: number }

const COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#a3a3a3",
  negative: "#ef4444",
  mixed: "#eab308",
};

export function SentimentChart({ data }: { data: SentimentRow[] }) {
  const total = data.reduce((s, d) => s + d.cnt, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-xs font-semibold mb-3">Sentiment Distribution</h3>
      <div className="flex h-4 rounded-full overflow-hidden bg-[var(--muted)]">
        {data.map((d) => (
          <div
            key={d.sentiment}
            style={{ width: `${(d.cnt / total) * 100}%`, backgroundColor: COLORS[d.sentiment] || "#737373" }}
            title={`${d.sentiment}: ${d.cnt}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {data.map((d) => (
          <div key={d.sentiment} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[d.sentiment] || "#737373" }} />
            <span className="capitalize">{d.sentiment}</span>
            <span className="text-[var(--muted-foreground)]">{d.cnt} ({Math.round((d.cnt / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
