"use client";

import { useState } from "react";
import { useIntelligence } from "@/lib/use-intelligence";
import { SignalsTab } from "@/components/tabs/signals";
import { DevBanner } from "@/components/ui/dev-banner";

export default function SignalsPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const extraParams: Record<string, string> = {};
  if (typeFilter !== "all") extraParams.signalType = typeFilter;
  if (impactFilter !== "all") extraParams.signalImpact = impactFilter;
  if (actionFilter !== "all") extraParams.capitalAction = actionFilter;

  const { data, loading, handlePageChange } = useIntelligence("signals", 30, extraParams);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm">Loading signals...</div>;
  }

  return (
    <>
      <DevBanner />
      <SignalsTab
        data={data}
        onPageChange={handlePageChange}
        typeFilter={typeFilter}
        impactFilter={impactFilter}
        actionFilter={actionFilter}
        onTypeFilterChange={setTypeFilter}
        onImpactFilterChange={setImpactFilter}
        onActionFilterChange={setActionFilter}
      />
    </>
  );
}
