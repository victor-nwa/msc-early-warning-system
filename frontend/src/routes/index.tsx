
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Activity,
  ClipboardCheck,
  Layers3,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  LabelList,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Overview · Student Early Warning Portal" }],
  }),
  component: OverviewPage,
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

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
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function pct(value: any) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function riskPercent(count: any, total: any) {
  const c = Number(count || 0);
  const t = Math.max(Number(total || 0), 1);
  return `${Math.round((c / t) * 100)}%`;
}

function tileTone(tone: "slate" | "red" | "amber" | "green") {
  return {
    slate: "border-slate-200 bg-white text-slate-950",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-green-200 bg-green-50 text-green-800",
  }[tone];
}

function MetricTile({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: any;
  helper: string;
  icon: any;
  tone: "slate" | "red" | "amber" | "green";
}) {
  return (
    <Card className={cn("rounded-2xl border p-5 shadow-sm", tileTone(tone))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold">{fmt(value)}</p>
          <p className="mt-1 text-xs opacity-70">{helper}</p>
        </div>
        <Icon className="h-5 w-5 opacity-75" />
      </div>
    </Card>
  );
}

function OverviewPage() {
  const query = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });

  const data: any = query.data || {};
  const cohort = data.cohort || {};
  const riskSnapshot: Row[] = Array.isArray(data.risk_snapshot) ? data.risk_snapshot : [];
  const heatRows: Row[] = Array.isArray(data.module_presentation_risk) ? data.module_presentation_risk : [];
  const engagement: Row[] = Array.isArray(data.engagement_trend) ? data.engagement_trend : [];
  const submissionFlags: Row[] = Array.isArray(data.submission_flags) ? data.submission_flags : [];

  const total = Number(cohort.total_learners || 0);

  const moduleRows = heatRows.slice(0, 12).map((row) => ({
    label: `${row.code_module} ${row.code_presentation}`,
    atRiskRate: Math.round(Number(row.at_risk_rate || 0) * 100),
    atRiskLearners: row.at_risk_learners,
  }));

  if (query.isLoading) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <div className="space-y-6">
          <Skeleton className="h-[220px] rounded-3xl" />
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
      </AppShell>
    );
  }

  if (query.isError) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <Card className="rounded-3xl border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Overview could not load.</p>
              <p className="mt-1 text-sm">Check that /overview is working on the backend.</p>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="" subtitle="" hideHeader>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Institutional Overview
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Cohort risk snapshot
              </h1>

            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-950">{fmt(total)}</span>
              <span className="ml-1 text-slate-500">learner records</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
            <MetricTile label="Total Learners" value={cohort.total_learners} helper="All learner records" icon={Users} tone="slate" />
            <MetricTile label="High Risk" value={cohort.high_risk} helper={riskPercent(cohort.high_risk, total)} icon={AlertTriangle} tone="red" />
            <MetricTile label="Moderate Risk" value={cohort.moderate_risk} helper={riskPercent(cohort.moderate_risk, total)} icon={TrendingUp} tone="amber" />
            <MetricTile label="Low Risk" value={cohort.low_risk} helper={riskPercent(cohort.low_risk, total)} icon={Activity} tone="green" />
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Risk distribution</span>
              <span>{pct(cohort.avg_risk_probability)} average probability</span>
            </div>

            <div className="flex h-5 overflow-hidden rounded-full bg-slate-100">
              {riskSnapshot.map((row) => {
                const width = `${(Number(row.learners || 0) / Math.max(total, 1)) * 100}%`;
                const color =
                  row.risk_level === "High"
                    ? "#dc2626"
                    : row.risk_level === "Moderate"
                      ? "#f59e0b"
                      : "#16a34a";

                return (
                  <div
                    key={row.risk_level}
                    className="h-full"
                    style={{ width, backgroundColor: color }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-slate-500" />
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Where is risk concentrated?
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Highest at-risk module and presentation combinations.
                </p>
              </div>
            </div>

            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={moduleRows}
                  layout="vertical"
                  margin={{ left: 10, right: 54, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={90} tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                  <RTooltip />
                  <Bar dataKey="atRiskRate" fill="#dc2626" radius={[0, 8, 8, 0]} barSize={22}>
                    <LabelList dataKey="atRiskRate" position="right" formatter={(value: any) => `${value}%`} style={{ fill: "#334155", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-slate-950">
                Is engagement dropping?
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Average VLE clicks by early learning window.
              </p>
            </div>

            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagement} margin={{ left: 4, right: 24, top: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="window" tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <RTooltip />
                  <Line type="monotone" dataKey="at_risk" name="At Risk" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="not_at_risk" name="Not At Risk" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-slate-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Submission health
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Missing and late assessment signals across the cohort.
              </p>
            </div>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={submissionFlags} margin={{ left: 0, right: 34, top: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="flag" tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <RTooltip />
                <Bar dataKey="learners" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={60}>
                  <LabelList dataKey="learners" position="top" style={{ fill: "#334155", fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
