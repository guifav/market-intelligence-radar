"use client";

import { useCallback, useRef } from "react";

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  formatValue?: (v: number) => string;
  /** Color accent class for the active range bar */
  accentClass?: string;
}

export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  formatValue = (v) => String(v),
  accentClass = "bg-blue-500",
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      onChange(Math.min(v, valueMax), valueMax);
    },
    [onChange, valueMax]
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      onChange(valueMin, Math.max(v, valueMin));
    },
    [onChange, valueMin]
  );

  const isDefault = valueMin === min && valueMax === max;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <span className="text-[10px] text-[var(--muted-foreground)] font-medium whitespace-nowrap w-10 shrink-0">
        {label}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <span className={`text-[10px] tabular-nums w-6 text-right ${isDefault ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)] font-medium"}`}>
          {formatValue(valueMin)}
        </span>
        <div className="relative flex-1 h-6 flex items-center" ref={trackRef}>
          {/* Track background */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--muted)]" />
          {/* Active range */}
          <div
            className={`absolute h-1.5 rounded-full ${isDefault ? "bg-[var(--muted-foreground)]/30" : accentClass} transition-all`}
            style={{
              left: `${pct(valueMin)}%`,
              right: `${100 - pct(valueMax)}%`,
            }}
          />
          {/* Min thumb */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={valueMin}
            onChange={handleMinChange}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none
              [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[var(--foreground)] [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-[var(--background)] [&::-webkit-slider-thumb]:shadow-sm
              [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
              [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform
              [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none
              [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[var(--foreground)] [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-[var(--background)] [&::-moz-range-thumb]:cursor-grab"
            style={{ zIndex: valueMin > max - step ? 3 : 1 }}
          />
          {/* Max thumb */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={valueMax}
            onChange={handleMaxChange}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none
              [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[var(--foreground)] [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-[var(--background)] [&::-webkit-slider-thumb]:shadow-sm
              [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
              [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform
              [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none
              [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[var(--foreground)] [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-[var(--background)] [&::-moz-range-thumb]:cursor-grab"
            style={{ zIndex: 2 }}
          />
        </div>
        <span className={`text-[10px] tabular-nums w-6 ${isDefault ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)] font-medium"}`}>
          {formatValue(valueMax)}
        </span>
      </div>
    </div>
  );
}
