
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  School,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [{ title: "Overview · Student Early Warning Portal" }],
  }),
  component: OverviewPage,
});

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type Row = Record<string, any>;

function authHeaders() {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("early_warning_token")
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchOverview() {
  const res = await fetch(`${API_BASE_URL}/overview`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Could not load overview");
  }

  return res.json();
}

function fmt(value: any) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function pct(value: any, digits = 0) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function round(value: any) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

/* ---------- shared panel shell, same language as Interventions ---------- */

function ChartPanel({
  eyebrow,
  title,
  icon: Icon,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : null}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {eyebrow}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950">{title}</h3>
          </div>
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

/* ---------- stat tiles ---------- */

const TILE_TONES = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-green-200 bg-green-50 text-green-700",
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <div className={cn("rounded-2xl border p-5", TILE_TONES[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-xs font-medium opacity-70">{sub}</p> : null}
    </div>
  );
}

/* ---------- risk mix stacked bar ---------- */

function RiskMixBar({ high, moderate, low }: { high: number; moderate: number; low: number }) {
  const total = Math.max(high + moderate + low, 1);
  const segments = [
    { label: "High", value: high, color: "#dc2626" },
    { label: "Moderate", value: moderate, color: "#f59e0b" },
    { label: "Low", value: low, color: "#16a34a" },
  ];

  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="font-medium text-slate-700">{seg.label}</span>
            <span className="text-slate-400">
              {fmt(seg.value)} · {pct(seg.value / total, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- risk-by-module heatmap ---------- */

function heatColor(rate: number | null | undefined) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
    return { bg: "#f8fafc", text: "#94a3b8" };
  }
  const clamped = Math.min(Math.max(Number(rate), 0), 1);
  const alpha = 0.1 + clamped * 0.75;
  const text = clamped > 0.55 ? "#ffffff" : "#7f1d1d";
  return { bg: `rgba(220, 38, 38, ${alpha.toFixed(2)})`, text };
}

function RiskHeatmap({ rows }: { rows: Row[] }) {
  const modules = Array.from(new Set(rows.map((r) => r.code_module))).sort();
  const presentations = Array.from(new Set(rows.map((r) => r.code_presentation))).sort();

  const lookup = new Map<string, Row>();
  rows.forEach((r) => lookup.set(`${r.code_module}__${r.code_presentation}`, r));

  if (!modules.length || !presentations.length) {
    return <p className="py-8 text-center text-sm text-slate-400">No module data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: "6px" }}>
        <thead>
          <tr>
            <th className="w-24 text-left text-xs font-semibold text-slate-400" />
            {presentations.map((p) => (
              <th key={p} className="px-2 pb-2 text-center text-xs font-semibold text-slate-500">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((mod) => (
            <tr key={mod}>
              <td className="pr-3 text-sm font-semibold text-slate-700">{mod}</td>
              {presentations.map((p) => {
                const cell = lookup.get(`${mod}__${p}`);
                const rate = cell?.at_risk_rate;
                const { bg, text } = heatColor(rate);

                return (
                  <td key={p} className="p-0">
                    <div
                      className="flex h-16 min-w-[86px] flex-col items-center justify-center rounded-xl"
                      style={{ backgroundColor: bg, color: text }}
                      title={
                        cell
                          ? `${mod} ${p} · ${fmt(cell.total_learners)} learners`
                          : "No learners"
                      }
                    >
                      {cell ? (
                        <>
                          <span className="text-sm font-bold">{pct(rate, 0)}</span>
                          <span className="text-[10px] opacity-80">
                            {fmt(cell.total_learners)} learners
                          </span>
                        </>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- engagement trend legend + chart ---------- */

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="mt-1 text-xs text-slate-600">
          <span className="font-semibold" style={{ color: entry.color }}>
            {entry.dataKey === "at_risk" ? "At risk" : "Not at risk"}
          </span>
          : <span className="font-bold text-slate-950">{round(entry.value)} avg clicks</span>
        </p>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

function OverviewPage() {
  const query = useQuery({
    queryKey: ["overview-cohort-summary"],
    queryFn: fetchOverview,
  });

  const data: any = query.data || {};
  const cohort: Row = data.cohort || {};
  const moduleRisk: Row[] = Array.isArray(data.module_presentation_risk)
    ? data.module_presentation_risk
    : [];
  const engagementTrend: Row[] = Array.isArray(data.engagement_trend) ? data.engagement_trend : [];
  const submissionHealth: Row[] = Array.isArray(data.submission_health) ? data.submission_health : [];
  const submissionFlags: Row[] = Array.isArray(data.submission_flags) ? data.submission_flags : [];

  const totalLearners = Number(cohort.total_learners || 0);
  const submissionTotal = submissionHealth.reduce((sum, row) => sum + Number(row.learners || 0), 0) || 1;

  if (query.isLoading) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[280px] rounded-3xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-[320px] rounded-3xl" />
            <Skeleton className="h-[320px] rounded-3xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (query.isError) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <Card className="rounded-3xl border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Overview could not load.</p>
              <p className="mt-1 text-sm">
                Confirm the backend is running and that /overview returns JSON.
              </p>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="" subtitle="" hideHeader>
      <div className="space-y-8">
        {/* Page intro — stated once */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Overview
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            How is the cohort doing right now?
          </h2>
        </div>

        {/* Cohort snapshot — the one place these counts live */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total learners"
            value={fmt(totalLearners)}
            sub={`Avg risk score ${pct(cohort.avg_risk_probability, 0)}`}
            tone="slate"
          />
          <StatTile
            label="High risk"
            value={fmt(cohort.high_risk)}
            sub={pct(Number(cohort.high_risk || 0) / (totalLearners || 1), 0) + " of cohort"}
            tone="red"
          />
          <StatTile
            label="Moderate risk"
            value={fmt(cohort.moderate_risk)}
            sub={pct(Number(cohort.moderate_risk || 0) / (totalLearners || 1), 0) + " of cohort"}
            tone="amber"
          />
          <StatTile
            label="Low risk"
            value={fmt(cohort.low_risk)}
            sub={pct(Number(cohort.low_risk || 0) / (totalLearners || 1), 0) + " of cohort"}
            tone="green"
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Risk mix
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-950">
            Cohort split by risk level
          </h3>
          <div className="mt-5">
            <RiskMixBar
              high={Number(cohort.high_risk || 0)}
              moderate={Number(cohort.moderate_risk || 0)}
              low={Number(cohort.low_risk || 0)}
            />
          </div>
        </section>

        {/* Risk by module × presentation — where problems cluster */}
        <ChartPanel
          eyebrow="Concentration"
          title="Where is risk concentrated across modules?"
          icon={School}
        >
          <RiskHeatmap rows={moduleRisk} />
        </ChartPanel>

        {/* Engagement trend + submission health, side by side */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartPanel eyebrow="Leading indicator" title="Engagement trend by risk status" icon={Activity}>
            <div className="mb-3 flex items-center gap-5 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" /> At risk
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Not at risk
              </span>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagementTrend} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="window" tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <RTooltip content={<TrendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="at_risk"
                    stroke="#dc2626"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#dc2626" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="not_at_risk"
                    stroke="#94a3b8"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#94a3b8" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel eyebrow="Leading indicator" title="Submission health across the cohort" icon={ClipboardCheck}>
            <div className="space-y-4">
              <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                {submissionHealth.map((row) => {
                  const color =
                    row.status === "Strong submission rate"
                      ? "#16a34a"
                      : row.status === "Partial submission rate"
                        ? "#f59e0b"
                        : "#dc2626";

                  return (
                    <div
                      key={row.status}
                      style={{
                        width: `${(Number(row.learners || 0) / submissionTotal) * 100}%`,
                        backgroundColor: color,
                      }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {submissionHealth.map((row) => (
                  <div key={row.status} className="flex items-center gap-2 text-xs text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          row.status === "Strong submission rate"
                            ? "#16a34a"
                            : row.status === "Partial submission rate"
                              ? "#f59e0b"
                              : "#dc2626",
                      }}
                    />
                    <span className="font-medium text-slate-700">{row.status}</span>
                    <span className="text-slate-400">{fmt(row.learners)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                {submissionFlags.map((row) => (
                  <div
                    key={row.flag}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700">{row.flag}</span>
                    <span className="text-xs font-bold text-slate-950">{fmt(row.learners)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartPanel>
        </section>
      </div>
    </AppShell>
  );
}

