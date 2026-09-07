
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learners")({
  head: () => ({
    meta: [
      { title: "Learners · Student Early Warning Portal" },
      {
        name: "description",
        content: "Learner-level risk predictions and intervention review.",
      },
    ],
  }),
  component: LearnersPage,
});

const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "http://127.0.0.1:8000";

type Learner = Record<string, any>;

interface StudentsResponse {
  total: number;
  limit: number;
  offset: number;
  records: Learner[];
  students?: Learner[];
  items?: Learner[];
}

const moduleOptions = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG"];

function fmt(n: number | undefined | null) {
  if (n == null || n === "") return "—";
  return Number(n).toLocaleString();
}

function probability(value: number | undefined | null) {
  if (value == null || value === "") return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

function hasValue(value: any) {
  return value !== null && value !== undefined && value !== "" && value !== "—";
}

function cleanRiskLevel(row: Learner) {
  return String(row.risk_level || row.predicted_risk_level || "")
    .replace(" Predicted Risk", "")
    .trim();
}

function riskBadge(level: string) {
  const clean = level.toLowerCase();

  if (clean === "high") return "border-red-200 bg-red-50 text-red-700";
  if (clean === "moderate") return "border-amber-200 bg-amber-50 text-amber-700";
  if (clean === "low") return "border-green-200 bg-green-50 text-green-700";

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusBadge(status: string) {
  if (status === "At Risk") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function outcomeBadge(outcome: string) {
  if (outcome === "Fail" || outcome === "Withdrawn") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (outcome === "Pass" || outcome === "Distinction") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

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

async function fetchStudents(filters: {
  search: string;
  riskLevel: string;
  riskStatus: string;
  module: string;
  limit: number;
  offset: number;
}): Promise<StudentsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.riskLevel) params.set("risk_level", filters.riskLevel);
  if (filters.riskStatus) params.set("risk_status", filters.riskStatus);
  if (filters.module) params.set("module", filters.module);

  const res = await fetch(`${API_BASE_URL}/students?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Could not load learners.");
  }

  const data = await res.json();

  return {
    ...data,
    records: data.records || data.students || data.items || [],
  };
}

async function fetchLearnerDetail(studentRecordKey: string): Promise<Learner> {
  const res = await fetch(`${API_BASE_URL}/students/${encodeURIComponent(studentRecordKey)}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Could not load learner detail.");
  }

  return res.json();
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  if (!hasValue(value)) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function LearnerDetailModal({
  learner,
  loading,
  open,
  onOpenChange,
}: {
  learner: Learner | undefined;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const level = learner ? cleanRiskLevel(learner) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-950">
            {learner ? `Learner Profile: ${learner.id_student}` : "Learner Profile"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : learner ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {hasValue(level) ? (
                <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", riskBadge(level))}>
                  {level} Risk
                </span>
              ) : null}

              {hasValue(learner.predicted_risk_status) ? (
                <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", statusBadge(learner.predicted_risk_status))}>
                  {learner.predicted_risk_status}
                </span>
              ) : null}

              {hasValue(learner.final_result) ? (
                <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", outcomeBadge(learner.final_result))}>
                  Final Result: {learner.final_result}
                </span>
              ) : null}

              {hasValue(learner.predicted_risk_probability) ? (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  Probability: {probability(learner.predicted_risk_probability)}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <DetailItem label="Module" value={learner.code_module} />
              <DetailItem label="Presentation" value={learner.code_presentation} />
              <DetailItem label="Region" value={learner.region} />
              <DetailItem label="Gender" value={learner.gender} />
              <DetailItem label="Age Band" value={learner.age_band} />
              <DetailItem label="Education" value={learner.highest_education} />
              <DetailItem label="IMD Band" value={learner.imd_band} />
              <DetailItem label="Disability" value={learner.disability} />
              <DetailItem label="Previous Attempts" value={learner.num_of_prev_attempts} />
              <DetailItem label="Studied Credits" value={learner.studied_credits} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <DetailItem label="Early Submission Rate" value={probability(learner.early_submission_rate)} />
              <DetailItem
                label="Average Early Score"
                value={hasValue(learner.early_avg_score) ? Math.round(Number(learner.early_avg_score)) : null}
              />
              <DetailItem label="Early VLE Clicks" value={fmt(learner.early_total_clicks)} />
              <DetailItem label="Active Days" value={fmt(learner.early_active_days)} />
              <DetailItem label="Missing Assessments" value={fmt(learner.early_missing_assessments)} />
              <DetailItem label="Late Submissions" value={fmt(learner.early_late_submissions)} />
            </div>

            {hasValue(learner.observed_risk_factors) || hasValue(learner.recommended_interventions) ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {hasValue(learner.observed_risk_factors) ? (
                  <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-950">Observed Risk Factors</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {learner.observed_risk_factors}
                    </p>
                  </Card>
                ) : null}

                {hasValue(learner.recommended_interventions) ? (
                  <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-950">Recommended Support</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {learner.recommended_interventions}
                    </p>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {hasValue(learner.ai_support_summary) ? (
              <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-950">Support Summary</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {learner.ai_support_summary}
                </p>
              </Card>
            ) : null}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            Learner detail could not be loaded.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LearnersPage() {
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [riskStatus, setRiskStatus] = useState("");
  const [module, setModule] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["learners", search, riskLevel, riskStatus, module, pageSize, page],
    queryFn: () =>
      fetchStudents({
        search,
        riskLevel,
        riskStatus,
        module,
        limit: pageSize,
        offset: page * pageSize,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["learner-detail", selectedKey],
    queryFn: () => fetchLearnerDetail(selectedKey as string),
    enabled: Boolean(selectedKey),
  });

  const records = query.data?.records || [];
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentStart = total === 0 ? 0 : page * pageSize + 1;
  const currentEnd = Math.min((page + 1) * pageSize, total);

  function resetFilters() {
    setSearch("");
    setRiskLevel("");
    setRiskStatus("");
    setModule("");
    setPage(0);
  }

  function updateFilter(callback: () => void) {
    callback();
    setPage(0);
  }

  return (
    <AppShell
      title="Learners"
      subtitle="Review learner records, prediction status and historical outcomes."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          className="border-slate-200 bg-white"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reload
        </Button>
      }
    >
      <div className="space-y-5">
        <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_0.55fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="h-10 pl-9"
                placeholder="Search student ID, record key, module or region"
                value={search}
                onChange={(event) => updateFilter(() => setSearch(event.target.value))}
              />
            </div>

            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={riskLevel}
              onChange={(event) => updateFilter(() => setRiskLevel(event.target.value))}
            >
              <option value="">All risk levels</option>
              <option value="High">High risk</option>
              <option value="Moderate">Moderate risk</option>
              <option value="Low">Low risk</option>
            </select>

            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={riskStatus}
              onChange={(event) => updateFilter(() => setRiskStatus(event.target.value))}
            >
              <option value="">All statuses</option>
              <option value="At Risk">At Risk</option>
              <option value="Not At Risk">Not At Risk</option>
            </select>

            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={module}
              onChange={(event) => updateFilter(() => setModule(event.target.value))}
            >
              <option value="">All modules</option>
              {moduleOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={pageSize}
              onChange={(event) => updateFilter(() => setPageSize(Number(event.target.value)))}
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>

            <Button variant="outline" onClick={resetFilters} className="h-10">
              Clear
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Learner Risk Register
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Showing {fmt(currentStart)}–{fmt(currentEnd)} of {fmt(total)} learners.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              Page {page + 1} of {totalPages}
            </div>
          </div>

          {query.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
              <p className="mt-3 text-sm font-medium text-slate-950">
                Learner records could not be loaded.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Check that the backend is running and the SQLite database is available.
              </p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-950">
                No learners match the selected filters.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try clearing the filters or selecting another risk level.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">Student</th>
                      <th className="px-5 py-3 text-left font-semibold">Module</th>
                      <th className="px-5 py-3 text-left font-semibold">Region</th>
                      <th className="px-5 py-3 text-left font-semibold">Risk Level</th>
                      <th className="px-5 py-3 text-left font-semibold">Prediction</th>
                      <th className="px-5 py-3 text-right font-semibold">Probability</th>
                      <th className="px-5 py-3 text-left font-semibold">Final Result</th>
                      <th className="px-5 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {records.map((row) => {
                      const level = cleanRiskLevel(row);
                      const key = row.student_record_key;

                      return (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-medium text-slate-950">
                                {row.id_student}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {key}
                              </p>
                            </div>
                          </td>

                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-800">{row.code_module}</p>
                            <p className="text-xs text-slate-500">{row.code_presentation}</p>
                          </td>

                          <td className="px-5 py-3 text-slate-700">
                            {row.region || "—"}
                          </td>

                          <td className="px-5 py-3">
                            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", riskBadge(level))}>
                              {level || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-3">
                            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", statusBadge(row.predicted_risk_status))}>
                              {row.predicted_risk_status || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-3 text-right font-medium text-slate-800">
                            {probability(row.predicted_risk_probability)}
                          </td>

                          <td className="px-5 py-3">
                            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", outcomeBadge(row.final_result))}>
                              {row.final_result || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedKey(key)}
                              className="h-8 border-slate-200 bg-white text-xs"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing {fmt(currentStart)}–{fmt(currentEnd)} of {fmt(total)}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>

                  <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {page + 1} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <LearnerDetailModal
        learner={detailQuery.data}
        loading={detailQuery.isLoading}
        open={Boolean(selectedKey)}
        onOpenChange={(open) => {
          if (!open) setSelectedKey(null);
        }}
      />
    </AppShell>
  );
}
