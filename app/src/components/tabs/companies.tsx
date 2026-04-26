"use client";

import { ExternalLink, Search, X, Calendar, Loader2 } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

interface Company {
  name: string;
  sector: string;
  context: string;
  deal_involvement: boolean;
  source_name: string;
  division: string;
  article_url: string;
  article_title: string;
  extracted_at: string;
}

import { DIVISION_LABELS as DIV_LABELS } from "@/lib/divisions";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

interface CompaniesData {
  companies?: Company[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface CompaniesTabProps {
  data: CompaniesData | null;
  loading?: boolean;
  onPageChange: (page: number) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
}

export function CompaniesTab({ data, loading, onPageChange, search, onSearchChange, dateFrom, dateTo, onDateFromChange, onDateToChange }: CompaniesTabProps) {
  const companies = data?.companies ?? [];
  const hasFilters = !!(search || dateFrom || dateTo);

  return (
    <div>
      {/* Search + Date filters */}
      {onSearchChange && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search companies — name, sector, context, source..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            {search && (
              <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            )}
          </div>
          {onDateFromChange && (
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar size={12} className="text-[var(--muted-foreground)]" />
              <span className="text-[10px] text-[var(--muted-foreground)]">Extracted</span>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-[var(--muted-foreground)]">From</label>
                <input type="date" value={dateFrom ?? ""} onChange={(e) => onDateFromChange(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-[var(--muted-foreground)]">To</label>
                <input type="date" value={dateTo ?? ""} onChange={(e) => onDateToChange?.(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { onDateFromChange(""); onDateToChange?.(""); }}
                  className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline">Clear dates</button>
              )}
            </div>
          )}
          {hasFilters && data && (
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {data.total === 0 ? "No companies found" : `${(data.total ?? 0).toLocaleString()} compan${data.total === 1 ? "y" : "ies"}`}
              {search ? ` for "${search}"` : ""}
              {dateFrom || dateTo ? ` · ${dateFrom || "∞"} → ${dateTo || "today"}` : ""}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">
          {hasFilters ? "No companies match your filters." : "No company data available."}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-[11px] min-w-[700px]">
            <thead>
              <tr className="bg-[var(--foreground)] text-[var(--background)]">
                <th className="text-left px-3 py-2 font-medium">Company</th>
                <th className="text-left px-3 py-2 font-medium">Sector</th>
                <th className="text-left px-3 py-2 font-medium">Context</th>
                <th className="text-left px-3 py-2 font-medium">Deal</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-left px-3 py-2 font-medium">Extracted</th>
                <th className="text-left px-3 py-2 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--muted)]"}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{c.name}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{c.sector}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)] max-w-[300px] truncate" title={c.context}>{c.context}</td>
                  <td className="px-3 py-2 text-center">{c.deal_involvement ? "●" : "○"}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)] whitespace-nowrap">
                    <span title={DIV_LABELS[c.division] || c.division}>{c.source_name}</span>
                  </td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)] whitespace-nowrap">
                    {formatDate(c.extracted_at)}
                  </td>
                  <td className="px-3 py-2">
                    {c.article_url && (
                      <a href={c.article_url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title={c.article_title || "Open article"}>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
