
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  caption?: string;
  icon: LucideIcon;
  tone?: "primary" | "high" | "medium" | "low" | "neutral";
}

const toneMap = {
  primary: "bg-blue-50 text-blue-700",
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-emerald-50 text-emerald-700",
  neutral: "bg-slate-100 text-slate-700",
};

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = "neutral",
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
          {caption ? (
            <p className="mt-1 text-xs text-slate-500">{caption}</p>
          ) : null}
        </div>

        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
