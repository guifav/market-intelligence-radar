"use client";

/**
 * LiveBadge — shows pulsing green dot + "LIVE" when real-time mode is active.
 * Toggle button to enable/disable.
 */

interface LiveBadgeProps {
  isLive: boolean;
  onToggle: () => void;
  loading?: boolean;
  error?: string | null;
}

export function LiveBadge({ isLive, onToggle, loading, error }: LiveBadgeProps) {
  return (
    <button
      onClick={onToggle}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider
        transition-colors cursor-pointer
        ${isLive
          ? "bg-green-500/15 text-green-500 border border-green-500/30"
          : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:border-green-500/50"
        }
      `}
      title={
        error
          ? `Error: ${error}`
          : isLive
          ? "Real-time updates active — click to disable"
          : "Click to enable real-time updates"
      }
    >
      {loading ? (
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      ) : isLive ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full bg-[var(--muted-foreground)]/40" />
      )}
      {isLive ? "LIVE" : "Live"}
      {error && <span className="text-red-400 ml-1">!</span>}
    </button>
  );
}
