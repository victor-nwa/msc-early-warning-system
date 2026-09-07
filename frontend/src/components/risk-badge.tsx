import { cn } from "@/lib/utils";

export function riskColor(level?: string) {
  const l = (level || "").toLowerCase();
  if (l.includes("high")) return "high";
  if (l.includes("moderate") || l.includes("medium")) return "moderate";
  if (l.includes("low")) return "low";
  return "neutral";
}

const styles: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
};

export function RiskBadge({ level, className }: { level?: string; className?: string }) {
  const variant = riskColor(level);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
    >
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          variant === "high" && "bg-rose-500",
          variant === "moderate" && "bg-amber-500",
          variant === "low" && "bg-emerald-500",
          variant === "neutral" && "bg-slate-400",
        )}
      />
      {level || "Unknown"}
    </span>
  );
}

export function RiskBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const variant = pct >= 70 ? "high" : pct >= 40 ? "moderate" : "low";
  const colors: Record<string, string> = {
    high: "bg-gradient-to-r from-rose-400 to-rose-600",
    moderate: "bg-gradient-to-r from-amber-400 to-orange-500",
    low: "bg-gradient-to-r from-emerald-400 to-teal-500",
  };
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colors[variant])} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground tabular-nums w-10 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
