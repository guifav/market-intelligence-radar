"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-[10px] text-[var(--muted-foreground)]">
        {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--accent)] transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--accent)] transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
