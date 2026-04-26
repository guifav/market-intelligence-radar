"use client";

import { ExternalLink, ArrowRight } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

interface Deal {
  deal_type: string;
  parties: string;
  value: string;
  description: string;
  stage: string;
  division: string;
  article_url: string;
  article_title: string;
  source_name: string;
  extracted_at: string;
}

const STAGE_STYLES: Record<string, string> = {
  completed: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
  announced: "bg-neutral-200/40 text-neutral-700 dark:bg-neutral-600/50 dark:text-neutral-200",
  planned: "bg-neutral-100/20 text-neutral-500 dark:bg-neutral-500/30 dark:text-neutral-400",
  rumoured: "bg-neutral-100/10 text-neutral-400 dark:bg-neutral-500/10 dark:text-neutral-500",
};

const TYPE_LABELS: Record<string, string> = {
  acquisition: "Acquisition",
  investment: "Investment",
  jv: "Joint Venture",
  fundraising: "Fundraising",
  ipo: "IPO",
  development: "Development",
  lease: "Lease",
  sale: "Sale",
  other: "Other",
};

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

function parseParties(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return raw ? [raw] : []; }
}

function formatValue(raw: string): string | null {
  if (!raw) return null;
  // Already formatted like "USD 500M" — just clean up
  const cleaned = raw.trim();
  if (!cleaned) return null;
  return cleaned;
}

interface DealsData {
  deals?: Deal[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export function DealsTab({ data, onPageChange }: { data: DealsData | null; onPageChange: (page: number) => void }) {
  const deals = data?.deals ?? [];

  if (deals.length === 0) {
    return <div className="text-sm text-[var(--muted-foreground)]">No deals data available.</div>;
  }

  return (
    <div>
      <div className="space-y-3">
        {deals.map((d, i) => {
          const parties = parseParties(d.parties);
          const value = formatValue(d.value);
          return (
            <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-[var(--muted)]">
                  {TYPE_LABELS[d.deal_type] || d.deal_type}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${STAGE_STYLES[d.stage] || STAGE_STYLES.planned}`}>
                  {d.stage}
                </span>
                {value && (
                  <span className="text-sm font-bold ml-auto font-mono">{value}</span>
                )}
              </div>

              {/* Parties */}
              {parties.length > 0 && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {parties.map((party, j) => (
                    <span key={j} className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--muted)]">
                        {party}
                      </span>
                      {j < parties.length - 1 && (
                        <ArrowRight size={12} className="text-[var(--muted-foreground)]" />
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">{d.description}</p>

              {/* Footer */}
              <div className="flex items-center gap-3 mt-3 text-[10px] text-[var(--muted-foreground)]">
                <span>{DIV_LABELS[d.division] || d.division}</span>
                {d.source_name && <span>{d.source_name}</span>}
                {d.article_url && (
                  <a
                    href={d.article_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[var(--foreground)] transition-colors ml-auto"
                    title={d.article_title || "Open source article"}
                  >
                    Source <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Pagination
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 50}
        total={data?.total ?? 0}
        onPageChange={onPageChange}
      />
    </div>
  );
}
