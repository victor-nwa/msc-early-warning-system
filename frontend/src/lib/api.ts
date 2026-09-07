const BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "http://127.0.0.1:8000";

export const API_BASE_URL = BASE_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("early_warning_token")
      : null;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export interface SummaryResponse {
  total_learners: number;
  predicted_at_risk: number;
  high_predicted_risk: number;
  moderate_predicted_risk: number;
  low_predicted_risk: number;
  actual_at_risk: number;
  average_predicted_risk_probability: number;
}

export interface StudentRecord {
  student_record_key: string;
  code_module: string;
  code_presentation: string;
  id_student: number;
  gender: string;
  region: string;
  highest_education: string;
  imd_band: string;
  age_band: string;
  num_of_prev_attempts: number;
  studied_credits: number;
  disability: string;
  final_result: string;
  risk_status: string;
  risk_label: number;
  predicted_risk_probability: number;
  predicted_risk_status: string;
  predicted_risk_level: string;
  early_submission_rate: number;
  early_assessments_submitted: number;
  early_missing_assessments: number;
  early_avg_score: number;
  early_late_submissions: number;
  early_total_clicks: number;
  clicks_day_0_30: number;
  clicks_day_31_60: number;
  clicks_day_61_90: number;
  early_active_days: number;
  early_avg_clicks_per_active_day: number;
  observed_risk_factors: string;
  recommended_interventions: string;
  ai_support_summary: string;
}

export interface StudentsResponse {
  total: number;
  limit: number;
  offset: number;
  records: StudentRecord[];
}

export interface ModelPerformanceRecord {
  dataset: string;
  model_name: string;
  accuracy: number;
  precision_at_risk: number;
  recall_at_risk: number;
  f1_at_risk: number;
  roc_auc: number;
  true_negative: number;
  false_positive: number;
  false_negative: number;
  true_positive: number;
  number_of_input_features: number;
}

export interface ExplainabilityResponse {
  feature_importance: { feature: string; importance: number }[];
  feature_family_importance: { feature_family: string; importance: number }[];
}

export interface InterventionSummaryResponse {
  risk_level_summary: {
    predicted_risk_level: string;
    students: number;
    average_probability: number;
    actual_at_risk_students: number;
    actual_at_risk_rate: number;
  }[];
  prediction_status_distribution: {
    predicted_risk_status: string;
    students: number;
    percentage: number;
  }[];
}

export interface AssistantResponse {
  student_record_key: string;
  question: string;
  mode: string;
  answer: string;
  student: Record<string, unknown>;
}

export const api = {
  getHealth: () => request<{ status: string }>("/health"),
  getSummary: () => request<SummaryResponse>("/summary"),
  getStudents: (params: { limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request<StudentsResponse>(`/students${q ? `?${q}` : ""}`);
  },
  getStudent: (key: string) => request<StudentRecord>(`/students/${encodeURIComponent(key)}`),
  getModelPerformance: () => request<{ records: ModelPerformanceRecord[] }>("/model-performance"),
  getExplainability: () => request<ExplainabilityResponse>("/explainability"),
  getInterventionSummary: () => request<InterventionSummaryResponse>("/intervention-summary"),
  refreshCache: () => request<{ status: string }>("/refresh-cache", { method: "POST" }),
  askAssistant: (payload: { student_record_key: string; question: string }) =>
    request<AssistantResponse>("/assistant", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
