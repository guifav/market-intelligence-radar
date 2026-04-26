"use client";

import { Construction } from "lucide-react";

export function DevBanner() {
  return (
    <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-yellow-500">
      <Construction size={16} className="flex-none" />
      <p className="text-xs font-medium">
        This page is under active development — data and layout may change.
      </p>
    </div>
  );
}
