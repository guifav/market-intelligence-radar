"use client";

import { useIntelligence } from "@/lib/use-intelligence";
import { DealsTab } from "@/components/tabs/deals";
import { DevBanner } from "@/components/ui/dev-banner";

export default function DealsPage() {
  const { data, loading, handlePageChange } = useIntelligence("deals");

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm">Loading deals...</div>;
  }

  return (
    <>
      <DevBanner />
      <DealsTab data={data} onPageChange={handlePageChange} />
    </>
  );
}
