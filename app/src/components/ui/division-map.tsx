"use client";

import dynamic from "next/dynamic";
import { DIVISION_LABELS } from "@/lib/divisions";
/* eslint-disable @typescript-eslint/no-explicit-any */

const WorldMap = dynamic(() => import("react-svg-worldmap"), { ssr: false });

// Division → color mapping
const DIVISION_COLORS: Record<string, string> = {
  technology: "#3b82f6",
  finance: "#22c55e",
  healthcare: "#f59e0b",
  energy: "#f97316",
};

// Representative countries per division (for illustrative purposes)
const DIVISION_COUNTRIES: Record<string, string[]> = {
  technology: ["us", "gb", "de", "jp", "kr", "in", "se", "il"],
  finance: ["us", "gb", "sg", "hk", "ch", "lu"],
  healthcare: ["us", "de", "ch", "jp", "fr", "dk"],
  energy: ["us", "sa", "no", "ae", "br", "au"],
};

// Build lookup: country code → color
const countryColorMap = new Map<string, { color: string; division: string }>();
for (const [division, countries] of Object.entries(DIVISION_COUNTRIES)) {
  const color = DIVISION_COLORS[division] || "#666";
  for (const cc of countries) {
    if (!countryColorMap.has(cc)) {
      countryColorMap.set(cc, { color, division });
    }
  }
}

// Build data array for the map
const mapData: any[] = [];
for (const cc of countryColorMap.keys()) {
  mapData.push({ country: cc, value: 1 });
}

export function DivisionMap() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-2 overflow-hidden">
      <WorldMap
        color="#3b82f6"
        backgroundColor="transparent"
        borderColor="var(--border)"
        size="responsive"
        data={mapData}
        styleFunction={(ctx: any) => {
          const entry = countryColorMap.get(ctx.countryCode?.toLowerCase());
          if (entry) {
            return {
              fill: entry.color,
              stroke: entry.color,
              strokeWidth: 0.5,
              strokeOpacity: 0.8,
              fillOpacity: 0.7,
              cursor: "default",
            };
          }
          return {
            fill: "var(--muted-foreground)",
            fillOpacity: 0.08,
            stroke: "var(--border)",
            strokeWidth: 0.3,
            cursor: "default",
          };
        }}
        tooltipTextFunction={(ctx: any) => {
          const entry = countryColorMap.get(ctx.countryCode?.toLowerCase());
          if (entry) {
            return `${ctx.countryName} — ${DIVISION_LABELS[entry.division] || entry.division}`;
          }
          return ctx.countryName;
        }}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center mt-2 px-2">
        {Object.entries(DIVISION_COLORS).map(([div, color]) => (
          <div key={div} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">{DIVISION_LABELS[div] || div}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
