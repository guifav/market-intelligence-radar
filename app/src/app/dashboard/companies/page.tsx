"use client";

import { useState, useMemo } from "react";
import { useIntelligence } from "@/lib/use-intelligence";
import { CompaniesTab } from "@/components/tabs/companies";
import { DevBanner } from "@/components/ui/dev-banner";

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debounceRef = useMemo(() => ({ timer: null as ReturnType<typeof setTimeout> | null }), []);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.timer) clearTimeout(debounceRef.timer);
    debounceRef.timer = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const extraParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    return Object.keys(p).length > 0 ? p : undefined;
  }, [debouncedSearch, dateFrom, dateTo]);

  const { data, loading, handlePageChange } = useIntelligence("companies", 30, extraParams);

  return (
    <>
    <DevBanner />
    <CompaniesTab
      data={data}
      loading={loading}
      onPageChange={handlePageChange}
      search={search}
      onSearchChange={handleSearch}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
    />
    </>
  );
}
