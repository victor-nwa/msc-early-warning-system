
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Award, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
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

export const Route = createFileRoute("/model-evaluation")({
  head: () => ({
    meta: [{ title: "Model Evaluation · Student Early Warning Portal" }],
  }),
  component: ModelEvaluationPage,
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

async function fetchModelEvaluation() {
  const res = await fetch(`${API_BASE_URL}/model-evaluation`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Could not load model evaluation");
  }

  return res.json();
}

function pct(value: any, digits = 1) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  const scaled = n <= 1 ? n * 100 : n;
  return `${scaled.toFixed(digits)}%`;
}

function fmt(value: any) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

/* ---------- section shell — plain, no double-boxing ---------- */

function Section({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex items-start gap-2.5">
        {Icon ? <Icon className="mt-1 h-4 w-4 shrink-0 text-slate-400" /> : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-950">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ---------- comparison table — one row per model, not one card per model ---------- */

function ComparisonTable({ models }: { models: Row[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3 text-left font-semibold">Model</th>
            <th className="px-5 py-3 text-right font-semibold">Accuracy</th>
            <th className="px-5 py-3 text-right font-semibold">Precision</th>
            <th className="px-5 py-3 text-right font-semibold">Recall</th>
            <th className="px-5 py-3 text-right font-semibold">F1</th>
            <th className="px-5 py-3 text-right font-semibold">False negatives</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {models.map((model) => (
            <tr key={model.model_id} className={cn(model.selected && "bg-green-50/50")}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      model.selected ? "bg-green-500" : "bg-slate-300",
                    )}
                  />
                  <span
                    className={cn(
                      "font-medium",
                      model.selected ? "text-slate-950" : "text-slate-700",
                    )}
                  >
                    {model.model_name}
                  </span>
                  {model.selected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                      <Award className="h-2.5 w-2.5" />
                      Selected
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-5 py-4 text-right text-slate-700">{pct(model.accuracy)}</td>
              <td className="px-5 py-4 text-right text-slate-700">{pct(model.precision)}</td>
              <td className="px-5 py-4 text-right text-slate-700">{pct(model.recall)}</td>
              <td className="px-5 py-4 text-right text-slate-700">{pct(model.f1_score)}</td>
              <td className="px-5 py-4 text-right">
                <span className={cn("font-semibold", model.selected ? "text-green-700" : "text-red-600")}>
                  {fmt(model.false_negative)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- confusion matrix — plain, minimal, only FN emphasized ---------- */

function ConfusionMatrix({ model }: { model: Row }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p
          className={cn(
            "text-sm font-medium",
            model.selected ? "text-slate-950" : "text-slate-600",
          )}
        >
          {model.model_name}
        </p>
        {model.selected ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700">
            Selected
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 pt-3 text-sm">
        <div>
          <p className="text-lg font-semibold text-slate-800">{fmt(model.true_negative)}</p>
          <p className="text-xs text-slate-400">True negative</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">{fmt(model.false_positive)}</p>
          <p className="text-xs text-slate-400">False positive</p>
        </div>
        <div>
          <p className="text-lg font-bold text-red-600">{fmt(model.false_negative)}</p>
          <p className="text-xs font-medium text-red-500">False negative — missed</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">{fmt(model.true_positive)}</p>
          <p className="text-xs text-slate-400">True positive</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- feature importance tooltip ---------- */

function FeatureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-xs text-slate-600">
        Relative weight:{" "}
        <span className="font-bold text-slate-950">{Number(payload[0].value).toFixed(1)}%</span>
      </p>
    </div>
  );
}

/* ---------- page ---------- */

function ModelEvaluationPage() {
  const query = useQuery({
    queryKey: ["model-evaluation"],
    queryFn: fetchModelEvaluation,
  });

  const data: any = query.data || {};
  const models: Row[] = Array.isArray(data.models) ? data.models : [];
  const selected: Row | null = data.selected_model || null;
  const runnerUp: Row | null = data.runner_up || null;
  const featureImportance: Row[] = Array.isArray(data.feature_importance)
    ? [...data.feature_importance].reverse() // Recharts vertical bars render bottom-up
    : [];
  const selectionNote: string = data.selection_note || "";

  const fnDifference =
    selected && runnerUp ? Number(runnerUp.false_negative) - Number(selected.false_negative) : null;

  if (query.isLoading) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <div className="space-y-10">
          <Skeleton className="h-[220px] rounded-2xl" />
          <Skeleton className="h-[180px] rounded-2xl" />
          <Skeleton className="h-[320px] rounded-2xl" />
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
              <p className="font-semibold">Model evaluation could not load.</p>
              <p className="mt-1 text-sm">
                Confirm the backend is running and that /model-evaluation returns JSON.
              </p>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="" subtitle="" hideHeader>
      <div className="space-y-12">
        {/* Page intro */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Model Evaluation
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Which model can be trusted, and why?
          </h2>
        </div>

        {/* Comparison — one table, selection rationale folded in as a subtitle, not a separate box */}
        <Section
          eyebrow="Model comparison"
          title="Three models were tested"
          subtitle={
            selectionNote && fnDifference !== null && runnerUp
              ? `${selectionNote} It produced ${fmt(fnDifference)} fewer false negatives than ${runnerUp.model_name}.`
              : selectionNote
          }
        >
          <ComparisonTable models={models} />
        </Section>

        {/* Confusion matrices — plain small multiples, only FN carries color */}
        <Section
          eyebrow="Mistakes"
          title="Where each model gets it wrong"
          subtitle="False negatives matter most here — they mean a learner who needed support was never flagged."
        >
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {models.map((model) => (
              <ConfusionMatrix key={model.model_id} model={model} />
            ))}
          </div>
        </Section>

        {/* Feature importance — the portal's one explainability view, scoped to the selected model */}
        <Section
          eyebrow="Explainability"
          title={`What drives ${selected?.model_name || "the selected model"}'s predictions`}
          icon={BarChart3}
        >
          {featureImportance.length ? (
            <div style={{ height: Math.max(featureImportance.length * 32, 200) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={featureImportance}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={160}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#334155", fontSize: 12 }}
                  />
                  <RTooltip content={<FeatureTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="weight" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={14}>
                    <LabelList
                      dataKey="weight"
                      position="right"
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                      style={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No feature importance data available yet.
            </p>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

