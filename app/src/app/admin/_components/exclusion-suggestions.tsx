"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Loader2, Lightbulb, CheckCircle, Users, Plus } from "lucide-react";

interface Suggestion {
  id: string;
  type: "review_rule";
  field: "excluded_titles" | "excluded_sectors" | "excluded_countries";
  field_label: string;
  value: string;
  count: number;
  division: string;
  categories: string[];
  sample_names: string[];
}

import { DIVISION_LABELS as _BASE_LABELS } from "@/lib/divisions";
const DIVISION_LABELS: Record<string, string> = {
  ..._BASE_LABELS,
  global: "Global",
  unclassified: "Unclassified",
};

const CATEGORY_LABELS: Record<string, string> = {
  wrong_seniority: "Wrong seniority",
  not_decision_maker: "Not a decision maker",
  wrong_sector: "Wrong sector",
  wrong_geography: "Wrong geography",
};

export function ExclusionSuggestions({ onRuleCreated }: { onRuleCreated?: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/exclusion/suggestions?threshold=3");
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (suggestion: Suggestion) => {
    setApplying(suggestion.id);
    try {
      const res = await apiFetch("/api/exclusion/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: suggestion.field,
          value: suggestion.value,
          division: suggestion.division,
          count: suggestion.count,
        }),
      });
      if (res.ok) {
        setApplied((prev) => new Set([...prev, suggestion.id]));
        onRuleCreated?.();
      }
    } catch (err) {
      console.error("Failed to apply suggestion:", err);
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" />
          Analysing reproved prospect patterns...
        </div>
      </div>
    );
  }

  const pending = suggestions.filter((suggestion) => !applied.has(suggestion.id));

  return (
    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5">
      <div className="px-4 py-3 border-b border-yellow-500/20 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 text-yellow-500">
            <Lightbulb size={14} />
            Suggested Review Rules
          </h3>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            Repeated reprove patterns that are not yet covered in the division ICP
          </p>
        </div>
        {applied.size > 0 && (
          <span className="text-[10px] text-green-500 flex items-center gap-1">
            <CheckCircle size={10} />
            {applied.size} applied
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
          {applied.size > 0
            ? "All suggestions applied. New review suggestions will appear after more reprovals."
            : "No review-rule suggestions right now."}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {pending.map((suggestion) => (
            <div key={suggestion.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold">{suggestion.field_label}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-[9px] text-[var(--muted-foreground)]">
                    {DIVISION_LABELS[suggestion.division] || suggestion.division}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-[var(--foreground)]">
                  {suggestion.value}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--muted-foreground)]">
                  <Users size={10} />
                  {suggestion.count} reproved prospects
                  {suggestion.categories.length > 0 && (
                    <span className="ml-1">
                      — {suggestion.categories.map((category) => CATEGORY_LABELS[category] || category).join(", ")}
                    </span>
                  )}
                </div>
                {suggestion.sample_names.length > 0 && (
                  <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                    e.g. {suggestion.sample_names.slice(0, 3).join(", ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleApply(suggestion)}
                disabled={applying === suggestion.id}
                className="flex-none h-7 px-3 rounded border border-yellow-500/30 bg-yellow-500/10 text-[10px] text-yellow-500 font-medium flex items-center gap-1 hover:bg-yellow-500/20 disabled:opacity-50 transition-colors"
              >
                {applying === suggestion.id ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Plus size={10} />
                )}
                Apply Rule
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
