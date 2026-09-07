
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardCheck,
  LifeBuoy,
  MapPin,
  School,
  TimerReset,
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
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interventions")({
  head: () => ({
    meta: [{ title: "Interventions · Student Early Warning Portal" }],
  }),
  component: InterventionsPage,
});

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type Row = Record<string, any>;

const REASON_COLORS: Record<string, string> = {
  "Missing assessments": "#dc2626",
  "Low submission rate": "#2563eb",
  "Low early score": "#16a34a",
  "Low engagement": "#f59e0b",
  "Late submissions": "#7c3aed",
};

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

async function fetchInterventions() {
  const res = await fetch(`${API_BASE_URL}/interventions`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Could not load interventions");
  }

  return res.json();
}

function fmt(value: any) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function riskClass(level: string) {
  if (level === "High") return "border-red-200 bg-red-50 text-red-700";
  if (level === "Moderate") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function splitTags(value: string) {
  return String(value || "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function tagIcon(tag: string) {
  if (tag.includes("Missing")) return ClipboardCheck;
  if (tag.includes("submission")) return TimerReset;
  if (tag.includes("score")) return BookOpenCheck;
  return AlertTriangle;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-xs text-slate-600">
        Learners: <span className="font-bold text-slate-950">{fmt(payload[0].value)}</span>
      </p>
    </div>
  );
}

function ChartPanel({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-2.5">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-950">{title}</h3>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

const PLAYBOOK_TIERS: Array<{
  title: string;
  timing: string;
  tone: "red" | "amber" | "green";
  items: string[];
}> = [
  {
    title: "High risk",
    timing: "Act today",
    tone: "red",
    items: [
      "Contact the learner directly",
      "Refer to an academic adviser",
      "Review missed or late assessments",
      "Follow up weekly",
    ],
  },
  {
    title: "Moderate risk",
    timing: "Act this week",
    tone: "amber",
    items: [
      "Send a check-in message",
      "Monitor engagement trend",
      "Point to learning support resources",
    ],
  },
  {
    title: "Low risk",
    timing: "Routine",
    tone: "green",
    items: ["Continue normal monitoring", "Escalate only if behaviour drops"],
  },
];

const TONE_STYLES = {
  red: { bar: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
  amber: { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  green: { bar: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
} as const;

function PlaybookColumn({ title, timing, tone, items }: (typeof PLAYBOOK_TIERS)[number]) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", styles.badge)}>
          {timing}
        </span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-700">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", styles.bar)} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InterventionsPage() {
  const query = useQuery({
    queryKey: ["interventions-action-centre"],
    queryFn: fetchInterventions,
  });

  const data: any = query.data || {};

  const queue: Row[] = Array.isArray(data.priority_queue) ? data.priority_queue : [];

  const reasons: Row[] = Array.isArray(data.reason_summary)
    ? data.reason_summary.filter((row: Row) => Number(row.learners) > 0)
    : [];

  const byModule: Row[] = Array.isArray(data.workload_by_module)
    ? data.workload_by_module.slice(0, 7)
    : [];

  const byRegion: Row[] = Array.isArray(data.workload_by_region)
    ? data.workload_by_region.slice(0, 8)
    : [];

  if (query.isLoading) {
    return (
      <AppShell title="" subtitle="" hideHeader>
        <div className="space-y-8">
          <Skeleton className="h-[420px] rounded-3xl" />
          <Skeleton className="h-[180px] rounded-3xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-[320px] rounded-3xl" />
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
              <p className="font-semibold">Interventions could not load.</p>
              <p className="mt-1 text-sm">
                Confirm the backend is running and that /interventions returns JSON.
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
        {/* Page intro — stated once, not repeated as a card per section */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Support Action Centre
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Who needs action first, and why?
          </h2>
        </div>

        {/* Priority queue — full width, given room to breathe */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-950">Priority queue</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              Sorted by risk probability, highest first
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Learner</th>
                  <th className="px-6 py-3 text-left font-semibold">Course context</th>
                  <th className="px-6 py-3 text-left font-semibold">Risk</th>
                  <th className="px-6 py-3 text-left font-semibold">Reason tags</th>
                  <th className="px-6 py-3 text-left font-semibold">Next support action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {queue.slice(0, 15).map((row, index) => {
                  const tags = splitTags(row.reason_tags);
                  const displayTags = tags.length ? tags : ["Review required"];

                  return (
                    <tr key={row.student_record_key} className="align-top hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                            {String(index + 1).padStart(2, "0")}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-950">{row.id_student}</p>
                            <p className="text-xs text-slate-500">{row.student_record_key}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{row.code_module}</p>
                        <p className="text-xs text-slate-500">
                          {row.code_presentation} · {row.region || "No region"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
                            riskClass(row.risk_level),
                          )}
                        >
                          {row.risk_level}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex max-w-[240px] flex-wrap gap-1.5">
                          {displayTags.map((tag) => {
                            const Icon = tagIcon(tag);

                            return (
                              <span
                                key={`${row.student_record_key}-${tag}`}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                              >
                                <Icon className="h-3 w-3 shrink-0" />
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="max-w-[320px] px-6 py-4 text-slate-700">
                        {row.recommended_action ||
                          row.recommended_interventions ||
                          "Assign support review."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Action playbook — a horizontal reference strip, not a cramped sidebar */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2.5">
            <LifeBuoy className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Standing policy
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950">
                What support fits each risk tier
              </h3>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            {PLAYBOOK_TIERS.map((tier) => (
              <PlaybookColumn key={tier.title} {...tier} />
            ))}
          </div>
        </section>

        {/* Why the queue looks the way it does + where workload concentrates */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ChartPanel eyebrow="Root causes" title="Why learners enter the queue">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasons} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis type="category" dataKey="reason" width={140} tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                  <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="learners" radius={[0, 8, 8, 0]} barSize={20}>
                    {reasons.map((row) => (
                      <Cell key={row.reason} fill={REASON_COLORS[row.reason] || "#64748b"} />
                    ))}
                    <LabelList dataKey="learners" position="right" style={{ fill: "#334155", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel eyebrow="Workload" title="Which modules need the most support" icon={School}>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byModule} margin={{ left: 0, right: 20, top: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="code_module" tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="high_risk_learners" fill="#dc2626" radius={[8, 8, 0, 0]} barSize={30}>
                    <LabelList dataKey="high_risk_learners" position="top" style={{ fill: "#334155", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel eyebrow="Workload" title="Where support is concentrated" icon={MapPin}>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byRegion} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis type="category" dataKey="region" width={100} tickLine={false} axisLine={false} tick={{ fill: "#334155", fontSize: 12 }} />
                  <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="high_risk_learners" fill="#7c3aed" radius={[0, 8, 8, 0]} barSize={16}>
                    <LabelList dataKey="high_risk_learners" position="right" style={{ fill: "#334155", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </section>
      </div>
    </AppShell>
  );
}

