import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  GraduationCap,
  MousePointerClick,
  CalendarDays,
  FileText,
  AlertCircle,
  Sparkles,
  MapPin,
} from "lucide-react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/risk-badge";
import { api } from "@/lib/api";

export const Route = createFileRoute("/learners/$key")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.key} · Learner Profile` },
      { name: "description", content: "Detailed learner risk profile and recommended interventions." },
    ],
  }),
  component: LearnerProfilePage,
});

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-teal-600" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function LearnerProfilePage() {
  const { key } = Route.useParams();
  const { data: r, isLoading, error } = useQuery({
    queryKey: ["student", key],
    queryFn: () => api.getStudent(key),
  });

  const probabilityPct = r ? Math.round(r.predicted_risk_probability * 100) : 0;
  const gaugeColor = probabilityPct >= 70 ? "#e11d48" : probabilityPct >= 40 ? "#f59e0b" : "#10b981";

  const clicksData = r
    ? [
        { name: "Day 0–30", clicks: r.clicks_day_0_30 },
        { name: "Day 31–60", clicks: r.clicks_day_31_60 },
        { name: "Day 61–90", clicks: r.clicks_day_61_90 },
      ]
    : [];

  return (
    <AppShell title="Learner Profile" subtitle="Predicted risk profile and recommended interventions">
      <Link to="/learners">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" /> Back to learners</Button>
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error || !r ? (
        <Card className="p-8 text-center text-muted-foreground">Learner not found.</Card>
      ) : (
        <>
          {/* Header */}
          <Card className="p-6 mb-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                  <User className="h-7 w-7 text-teal-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/60">Learner Record</p>
                  <h2 className="text-xl font-semibold font-mono">{r.student_record_key}</h2>
                  <p className="text-sm text-white/70 mt-1">
                    {r.code_module} · {r.code_presentation} · ID {r.id_student}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex flex-wrap gap-3 lg:justify-end">
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-[11px] uppercase text-white/60">Predicted</p>
                  <p className="text-sm font-semibold">{r.predicted_risk_level}</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-[11px] uppercase text-white/60">Final Result</p>
                  <p className="text-sm font-semibold">{r.final_result}</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-[11px] uppercase text-white/60">Actual</p>
                  <p className="text-sm font-semibold">{r.risk_status}</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Risk gauge */}
            <Card className="p-6 lg:col-span-1">
              <SectionTitle icon={AlertCircle} title="Predicted Risk Probability" />
              <div className="h-[220px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: probabilityPct, fill: gaugeColor }]} startAngle={210} endAngle={-30}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background={{ fill: "#f1f5f9" }} dataKey="value" cornerRadius={20} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-4xl font-bold tabular-nums" style={{ color: gaugeColor }}>{probabilityPct}%</p>
                  <RiskBadge level={r.predicted_risk_level} className="mt-1" />
                </div>
              </div>
            </Card>

            {/* Demographics & Context */}
            <Card className="p-6 lg:col-span-2">
              <SectionTitle icon={MapPin} title="Contextual Background" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Gender" value={r.gender} />
                <Stat label="Age Band" value={r.age_band} />
                <Stat label="Region" value={r.region} />
                <Stat label="IMD Band" value={r.imd_band} />
                <Stat label="Education" value={r.highest_education} />
                <Stat label="Disability" value={r.disability} />
                <Stat label="Prev. Attempts" value={r.num_of_prev_attempts} />
                <Stat label="Credits" value={r.studied_credits} />
              </div>
            </Card>

            {/* Assessment behavior */}
            <Card className="p-6 lg:col-span-1">
              <SectionTitle icon={FileText} title="Assessment Behaviour" />
              <div className="space-y-3">
                <Stat label="Early Submission Rate" value={`${(r.early_submission_rate * 100).toFixed(0)}%`} sub={`${r.early_assessments_submitted} submitted · ${r.early_missing_assessments} missing`} />
                <Stat label="Early Avg Score" value={r.early_avg_score} />
                <Stat label="Late Submissions" value={r.early_late_submissions} />
              </div>
            </Card>

            {/* VLE engagement */}
            <Card className="p-6 lg:col-span-2">
              <SectionTitle icon={MousePointerClick} title="VLE Engagement (first 90 days)" />
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Total Clicks" value={r.early_total_clicks} />
                <Stat label="Active Days" value={r.early_active_days} sub={<><CalendarDays className="inline h-3 w-3 mr-1" />out of 90</> as any} />
                <Stat label="Clicks / Active Day" value={r.early_avg_clicks_per_active_day.toFixed(1)} />
              </div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clicksData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                    <RTooltip />
                    <Bar dataKey="clicks" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Observed factors */}
            <Card className="p-6 lg:col-span-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <SectionTitle icon={AlertCircle} title="Observed Risk Factors" />
                  <ul className="space-y-2">
                    {(r.observed_risk_factors || "").split(";").filter(Boolean).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        <span className="text-foreground/90">{f.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <SectionTitle icon={GraduationCap} title="Recommended Interventions" />
                  <ul className="space-y-2">
                    {(r.recommended_interventions || "").split(";").filter(Boolean).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-foreground/90">{f.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>

            {/* AI summary */}
            <Card className="p-6 lg:col-span-3 bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-100">
              <SectionTitle icon={Sparkles} title="AI Support Summary" />
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.ai_support_summary}</p>
              <div className="mt-4 flex gap-2">
                <Link to="/assistant" search={{ key: r.student_record_key } as any}>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                    <Sparkles className="h-4 w-4 mr-1.5" /> Ask AI Assistant
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}