"use client";

import { ExternalLink } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

interface Signal {
  signal_type: string;
  capital_action: string;
  portfolio_strategy: string;
  investment_strategy: string;
  description: string;
  impact: string;
  affected_sectors: string;
  division: string;
  article_url: string;
  article_title: string;
  source_name: string;
  extracted_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  regulatory: "Regulatory",
  policy: "Policy",
  market_shift: "Market Shift",
  new_development: "New Development",
  technology: "Technology",
  sustainability: "Sustainability",
  risk: "Risk",
};

const IMPACT_BAR: Record<string, { width: string; bg: string }> = {
  high: { width: "100%", bg: "bg-neutral-100 dark:bg-neutral-300" },
  medium: { width: "60%", bg: "bg-neutral-300 dark:bg-neutral-500" },
  low: { width: "30%", bg: "bg-neutral-500 dark:bg-neutral-700" },
};

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

const ALL_TYPES = ["all", "regulatory", "policy", "risk", "market_shift", "new_development", "technology", "sustainability"];
const ALL_IMPACTS = ["all", "high", "medium", "low"];
const ALL_ACTIONS = ["all", "acquisition", "deployment", "capital_allocation", "fundraising", "development", "strategic_partnership", "platform_build", "strategic_quote", "mandate", "none"];

const ACTION_LABELS: Record<string, string> = {
  acquisition: "Acquisition",
  deployment: "Deployment",
  capital_allocation: "Capital Allocation",
  fundraising: "Fundraising",
  development: "Development",
  strategic_partnership: "Partnership",
  platform_build: "Platform Build",
  strategic_quote: "Quote/Appt",
  mandate: "Mandate",
  none: "No Action",
};

function parseSectors(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

interface SignalsData {
  signals?: Signal[];
  total?: number;
  unfilteredTotal?: number;
  typeCounts?: Record<string, number>;
  impactCounts?: Record<string, number>;
  actionCounts?: Record<string, number>;
  page?: number;
  pageSize?: number;
}

export function SignalsTab({
  data,
  onPageChange,
  typeFilter,
  impactFilter,
  actionFilter = "all",
  onTypeFilterChange,
  onImpactFilterChange,
  onActionFilterChange,
}: {
  data: SignalsData | null;
  onPageChange: (page: number) => void;
  typeFilter: string;
  impactFilter: string;
  actionFilter?: string;
  onTypeFilterChange: (value: string) => void;
  onImpactFilterChange: (value: string) => void;
  onActionFilterChange?: (value: string) => void;
}) {
  const signals = data?.signals ?? [];
  const unfilteredTotal = data?.unfilteredTotal ?? data?.total ?? signals.length;
  const typeCounts = data?.typeCounts ?? {};
  const impactCounts = data?.impactCounts ?? {};
  const actionCounts = data?.actionCounts ?? {};

  if (unfilteredTotal === 0) {
    return <div className="text-sm text-[var(--muted-foreground)]">No signals data available.</div>;
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted-foreground)] mr-1">Type:</span>
          {ALL_TYPES.map((t) => {
            const count = t === "all" ? unfilteredTotal : (typeCounts[t] || 0);
            if (t !== "all" && count === 0 && typeFilter !== t) return null;
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => onTypeFilterChange(t)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] hover:border-[var(--foreground)]"
                }`}
              >
                {t === "all" ? "All" : TYPE_LABELS[t] || t} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted-foreground)] mr-1">Impact:</span>
          {ALL_IMPACTS.map((imp) => {
            const count = imp === "all" ? unfilteredTotal : (impactCounts[imp] || 0);
            const active = impactFilter === imp;
            return (
              <button
                key={imp}
                onClick={() => onImpactFilterChange(imp)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] hover:border-[var(--foreground)]"
                }`}
              >
                {imp === "all" ? "All" : imp.charAt(0).toUpperCase() + imp.slice(1)} ({count})
              </button>
            );
          })}
        </div>
        {onActionFilterChange && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-[var(--muted-foreground)] mr-1">Action:</span>
            {ALL_ACTIONS.map((a) => {
              const count = a === "all" ? unfilteredTotal : (actionCounts[a] || 0);
              if (a !== "all" && count === 0 && actionFilter !== a) return null;
              const active = actionFilter === a;
              return (
                <button
                  key={a}
                  onClick={() => onActionFilterChange(a)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    active
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--border)] hover:border-[var(--foreground)]"
                  }`}
                >
                  {a === "all" ? "All" : ACTION_LABELS[a] || a} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Signals table */}
      <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
        <table className="w-full text-[11px] min-w-[700px]">
          <thead>
            <tr className="bg-[var(--foreground)] text-[var(--background)]">
              <th className="text-left px-3 py-2 font-medium w-24">Type</th>
              <th className="text-left px-3 py-2 font-medium w-24">Action</th>
              <th className="text-left px-3 py-2 font-medium w-16">Impact</th>
              <th className="text-left px-3 py-2 font-medium">Signal</th>
              <th className="text-left px-3 py-2 font-medium w-32">Sectors</th>
              <th className="text-left px-3 py-2 font-medium w-20">Division</th>
              <th className="text-left px-3 py-2 font-medium w-28">Source</th>
              <th className="text-left px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s, i) => {
              const sectors = parseSectors(s.affected_sectors);
              const bar = IMPACT_BAR[s.impact] || IMPACT_BAR.low;
              return (
                <tr key={i} className={i % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--muted)]"}>
                  <td className="px-3 py-2">
                    <span className="text-[10px] font-medium">{TYPE_LABELS[s.signal_type] || s.signal_type}</span>
                  </td>
                  <td className="px-3 py-2">
                    {s.capital_action && s.capital_action !== "none" ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--foreground)]/10 text-[var(--foreground)] font-medium whitespace-nowrap">
                        {ACTION_LABELS[s.capital_action] || s.capital_action}
                      </span>
                    ) : (
                      <span className="text-[9px] text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div className={`h-full rounded-full ${bar.bg}`} style={{ width: bar.width }} />
                      </div>
                      <span className="text-[9px] text-[var(--muted-foreground)]">{s.impact}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)] leading-relaxed">{s.description}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {sectors.slice(0, 3).map((sec, j) => (
                        <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] whitespace-nowrap">{sec}</span>
                      ))}
                      {sectors.length > 3 && <span className="text-[9px] text-[var(--muted-foreground)]">+{sectors.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-[var(--muted-foreground)]">{DIV_LABELS[s.division] || s.division}</td>
                  <td className="px-3 py-2 text-[10px] text-[var(--muted-foreground)] whitespace-nowrap">{s.source_name}</td>
                  <td className="px-3 py-2">
                    {s.article_url && (
                      <a href={s.article_url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title={s.article_title || "Open article"}>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {signals.length === 0 && (
        <div className="text-center py-6 text-[11px] text-[var(--muted-foreground)]">No signals match the selected filters.</div>
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
