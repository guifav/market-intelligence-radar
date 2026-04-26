"use client";
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from "react";
import { useDivision } from "./division";

export function useIntelligence(tab: string, pageSize = 30, extraParams?: Record<string, string>) {
  const { division } = useDivision();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const extraParamsKey = JSON.stringify(extraParams ?? {});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab });
      if (division) params.set("division", division);
      if (tab !== "overview") {
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
      }
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
      }
      const res = await apiFetch(`/api/intelligence?${params}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tab, division, page, pageSize, extraParamsKey]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [division, pageSize, extraParamsKey]);

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return { data, loading, page, handlePageChange, refetch: fetchData };
}
