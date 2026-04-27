"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useIntelligence } from "@/lib/use-intelligence";
import { PeopleTab } from "@/components/tabs/people";

const DEFAULT_FILTER = "new_contacts";

export default function PeoplePage() {
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Score & ICP range filters (debounced for slider drag)
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [icpMin, setIcpMin] = useState("");
  const [icpMax, setIcpMax] = useState("");
  const [debouncedScoreMin, setDebouncedScoreMin] = useState("");
  const [debouncedScoreMax, setDebouncedScoreMax] = useState("");
  const [debouncedIcpMin, setDebouncedIcpMin] = useState("");
  const [debouncedIcpMax, setDebouncedIcpMax] = useState("");

  const sliderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSetFilters = useCallback((sMin: string, sMax: string, iMin: string, iMax: string) => {
    if (sliderDebounce.current) clearTimeout(sliderDebounce.current);
    sliderDebounce.current = setTimeout(() => {
      setDebouncedScoreMin(sMin);
      setDebouncedScoreMax(sMax);
      setDebouncedIcpMin(iMin);
      setDebouncedIcpMax(iMax);
    }, 300);
  }, []);

  const handleScoreMin = useCallback((v: string) => { setScoreMin(v); debouncedSetFilters(v, scoreMax, icpMin, icpMax); }, [scoreMax, icpMin, icpMax, debouncedSetFilters]);
  const handleScoreMax = useCallback((v: string) => { setScoreMax(v); debouncedSetFilters(scoreMin, v, icpMin, icpMax); }, [scoreMin, icpMin, icpMax, debouncedSetFilters]);
  const handleIcpMin = useCallback((v: string) => { setIcpMin(v); debouncedSetFilters(scoreMin, scoreMax, v, icpMax); }, [scoreMin, scoreMax, icpMax, debouncedSetFilters]);
  const handleIcpMax = useCallback((v: string) => { setIcpMax(v); debouncedSetFilters(scoreMin, scoreMax, icpMin, v); }, [scoreMin, scoreMax, icpMin, debouncedSetFilters]);
  const handleClearFilters = useCallback(() => {
    setScoreMin(""); setScoreMax(""); setIcpMin(""); setIcpMax("");
    setDebouncedScoreMin(""); setDebouncedScoreMax(""); setDebouncedIcpMin(""); setDebouncedIcpMax("");
  }, []);

  const debounceRef = useMemo(() => ({ timer: null as ReturnType<typeof setTimeout> | null }), []);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.timer) clearTimeout(debounceRef.timer);
    debounceRef.timer = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const extraParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filter) p.people_filter = filter;
    if (debouncedSearch) p.search = debouncedSearch;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    if (debouncedScoreMin) p.score_min = debouncedScoreMin;
    if (debouncedScoreMax) p.score_max = debouncedScoreMax;
    if (debouncedIcpMin) p.icp_min = debouncedIcpMin;
    if (debouncedIcpMax) p.icp_max = debouncedIcpMax;
    return Object.keys(p).length > 0 ? p : {};
  }, [filter, debouncedSearch, dateFrom, dateTo, debouncedScoreMin, debouncedScoreMax, debouncedIcpMin, debouncedIcpMax]);

  const { data, loading, handlePageChange, refetch } = useIntelligence("people", 30, extraParams);

  return (
    <PeopleTab
      data={data}
      loading={loading}
      currentFilter={filter}
      onPageChange={handlePageChange}
      onTabParams={(p) => setFilter(p.people_filter || DEFAULT_FILTER)}
      onRefresh={refetch}
      search={search}
      onSearchChange={handleSearch}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      scoreMin={scoreMin}
      scoreMax={scoreMax}
      icpMin={icpMin}
      icpMax={icpMax}
      onScoreMinChange={handleScoreMin}
      onScoreMaxChange={handleScoreMax}
      onIcpMinChange={handleIcpMin}
      onIcpMaxChange={handleIcpMax}
    />
  );
}
