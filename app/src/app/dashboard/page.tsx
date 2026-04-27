"use client";

import { useIntelligence } from "@/lib/use-intelligence";
import { OverviewTab } from "@/components/tabs/overview";

export default function OverviewPage() {
  const { data, loading } = useIntelligence("overview");

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm">Loading intelligence data...</div>;
  }

  return <OverviewTab data={data} />;
}
