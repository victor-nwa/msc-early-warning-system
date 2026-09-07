
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpenCheck,
  ClipboardCheck,
  MousePointer2,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
  LabelList,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export const Route = createFileRoute("/explainability")({
  head: () => ({
    meta: [
      { title: "Explainability · Student Early Warning Portal" },
      { name: "description", content: "Risk anatomy and behavioural explanation." },
    ],
  }),
  component: ExplainabilityPage,
});

type Row = Record<string, any>;

const RISK_COLORS: Record<string, string> = {
  High: "#dc2626",
  Moderate: "#f59e0b",
  Low: "#16a34a",
};

const SIGNALS = [
  {
    key: "avg_submission_rate",
    label: "Submission Rate",
    short: "Submission",
    icon: ClipboardCheck,
    format: "percent",
    good: "higher",
  },
  {
    key: "avg_score",
    label: "Average Score",
    short: "Score",
    icon: BookOpenCheck,
    format: "number",
    good: "higher",
  },
  {
    key: "avg_clicks",
    label: "VLE Clicks",
    short: "Clicks",
    icon: MousePointer2,
    format: "number",
    good: "higher",
  },
  {
    key: "avg_active_days",
    label: "Active Days",
    short: "Active Days",
    icon: Activity,
    format: "number",
    good: "higher",
  },
  {
    key: "avg_missing_assessments",
    label: "Missing Work",
    short: "Missing",
    icon: TrendingDown,
    format: "number",
    good: "lower",
  },
  {
    key: "avg_late_submissions",
    label: "Late Work",
    short: "Late",
    icon: TrendingDown,
    format: "number",
    good: "lower",
  },
];

function fmt(value: any, format = "number") {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";

  if (format === "percent") return `${Math.round(n * 100)}%`;

  return n.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function pct(value: any) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function featureName(row: Row) {
  return row.feature || row.feature_name || row.variable || row.name || "Feature";
}

function featureImportance(row: Row) {
  return Number(row.importance ?? row.feature_importance ?? row.normalized_importance ?? 0);
}

function prettyFeature(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Vle", "VLE")
    .replace("Avg", "Average")
    .replace("Min", "Minimum")
    .replace("Max", "Maximum")
    .replace("Day 0 30", "Days 0–30")
    .replace("Day 31 60", "Days 31–60")
    .replace("Day 61 90", "Days 61–90");
}

function ProfileCard({ profile }: { profile: Row }) {
  const color = RISK_COLORS[profile.risk_level] || "#64748b";

  return (
    <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white shadow-sm">
      <div className="h-2" style={{ backgroundColor: color }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Risk profile
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {profile.risk_level}
            </h2>
          </div>

          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Learners
            </p>
            <p className="mt-1 text-xl font-bold text-slate-950">
              {Number(profile.learners || 0).toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Probability
            </p>
            <p className="mt-1 text-xl font-bold text-slate-950">
              {pct(profile.avg_probability)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Submission
            </p>
            <p className="mt-1 text-xl font-bold text-slate-950">
              {fmt(profile.avg_submission_rate, "percent")}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Score
            </p>
            <p className="mt-1 text-xl font-bold text-slate-950">
              {fmt(profile.avg_score)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GapTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <div className="mt-2 space-y-1 text-xs text-slate-600">
        {payload.map((item: any) => (
          <div key={item.name} className="flex justify-between gap-8">
            <span style={{ color: item.color }}>{item.name}</span>
            <span className="font-bold text-slate-950">
              {fmt(item.value, item.payload[`${item.name}_format`] || "number")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{row.code_module}</p>
      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-8">
          <span>High-risk share</span>
          <span className="font-bold text-red-700">{fmt(row.high_share, "percent")}</span>
        </div>
        <div className="flex justify-between gap-8">
          <span>Submission</span>
          <span className="font-bold text-slate-950">{fmt(row.avg_submission_rate, "percent")}</span>
        </div>
        <div className="flex justify-between gap-8">
          <span>Avg. score</span>
          <span className="font-bold text-slate-950">{fmt(row.avg_score)}</span>
        </div>
      </div>
    </div>
  );
}

function FeatureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <p className="mt-2 text-xs text-slate-600">
        Weight: <span className="font-bold text-slate-950">{Number(payload[0].value).toFixed(1)}%</span>
      </p>
    </div>
  );
}

function ExplainabilityPage() {
  const query = useQuery({
    queryKey: ["explainability"],
    queryFn: api.getExplainability,
  });

  const data: any = query.data;

  const riskProfiles: Row[] = data?.risk_profiles || [];
  const moduleProfiles: Row[] = data?.module_profiles || [];
  const rawFeatures: Row[] = data?.top_features || data?.feature_importance || [];

  const behaviourData = SIGNALS.map((signal) => {
    const row: Row = {
      signal: signal.short,
    };

    riskProfiles.forEach((profile) => {
      row[profile.risk_level] = Number(profile[signal.key] || 0);
      row[`${profile.risk_level}_format`] = signal.format;
    });

    return row;
  });

  const featureData = useMemo(() => {
    const rows = rawFeatures
      .map((row) => ({
        name: prettyFeature(featureName(row)),
        importance: featureImportance(row),
      }))
      .filter((row) => row.importance > 0)
      .sort((a, b) => b.importance - a.importance);

    const total = rows.reduce((sum, row) => sum + row.importance, 0) || 1;

    return rows.slice(0, 6).map((row) => ({
      name: row.name,
      weight: row.importance <= 1 ? row.importance * 100 : (row.importance / total) * 100,
    }));
  }, [rawFeatures]);

  const moduleRiskMap = moduleProfiles.map((row) => ({
    ...row,
    high_share: Number(row.high_risk || 0) / Math.max(Number(row.learners || 1), 1),
    submission_percent: Number(row.avg_submission_rate || 0) * 100,
  }));

  if (query.isLoading) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <div className="space-y-5">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="" subtitle="" hideHeader>
      <div className="space-y-5">
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {riskProfiles.map((profile) => (
            <ProfileCard key={profile.risk_level} profile={profile} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Behaviour Gap Matrix
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  What separates high, moderate and low risk learners.
                </p>
              </div>
            </div>

            <div className="h-[410px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={behaviourData} margin={{ left: 0, right: 22, top: 10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="signal"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#334155", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <RTooltip content={<GapTooltip />} />
                  <Bar dataKey="High" fill="#dc2626" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Moderate" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Low" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-950">
                Model Driver Strip
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Supporting feature weights.
              </p>
            </div>

            <div className="h-[410px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={featureData}
                  layout="vertical"
                  margin={{ left: 10, right: 60, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={165}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#334155", fontSize: 11 }}
                  />
                  <RTooltip content={<FeatureTooltip />} />
                  <Bar dataKey="weight" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={20}>
                    <LabelList
                      dataKey="weight"
                      position="right"
                      formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                      style={{ fill: "#334155", fontSize: 11, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        <section className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-950">
              Module Risk Map
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Each dot is a course module. Higher position means higher-risk concentration.
            </p>
          </div>

          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 0, right: 22, top: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="submission_percent"
                  name="Submission"
                  type="number"
                  unit="%"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  dataKey="high_share"
                  name="High-risk share"
                  type="number"
                  tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <ZAxis dataKey="learners" range={[120, 420]} />
                <RTooltip cursor={{ strokeDasharray: "3 3" }} content={<ModuleTooltip />} />
                <Scatter data={moduleRiskMap}>
                  {moduleRiskMap.map((row) => (
                    <Cell
                      key={row.code_module}
                      fill={Number(row.high_share) > 0.4 ? "#dc2626" : "#2563eb"}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
