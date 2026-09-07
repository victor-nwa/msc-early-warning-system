
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, Database, GraduationCap, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login, saveSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login · Student Early Warning Portal" },
      {
        name: "description",
        content: "Secure login for the student early warning analytics portal.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(email, password);
      saveSession(response);
      await navigate({ to: "/" });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden bg-[#07111f] px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.25),_transparent_34%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <GraduationCap className="h-6 w-6 text-blue-200" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide">Student Early Warning Portal</p>
                <p className="text-xs text-slate-300">Learning analytics and intervention intelligence</p>
              </div>
            </div>

            <div className="mt-24 max-w-2xl">
              <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
                MSc Data Science and Artificial Intelligence Project
              </p>
              <h1 className="text-5xl font-semibold leading-tight tracking-tight">
                Identify learner risk early and support timely intervention.
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300">
                A secure analytics portal for reviewing risk predictions, learner profiles,
                model performance, explainability results and recommended support actions.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid max-w-3xl grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <Database className="h-5 w-5 text-cyan-200" />
              <p className="mt-3 text-sm font-medium">SQLite Data Layer</p>
              <p className="mt-1 text-xs text-slate-300">Structured portal records</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <BarChart3 className="h-5 w-5 text-amber-200" />
              <p className="mt-3 text-sm font-medium">Model Evaluation</p>
              <p className="mt-1 text-xs text-slate-300">Comparison across models</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
              <p className="mt-3 text-sm font-medium">Intervention Support</p>
              <p className="mt-1 text-xs text-slate-300">Risk-based action guidance</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <Card className="w-full max-w-md border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="mb-8">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-blue-700">Secure access</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Sign in to the portal
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your authorised account details to continue to the early warning dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-700">Email address</label>
                <Input
                  className="mt-2 h-11"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Input
                  className="mt-2 h-11"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="h-11 w-full bg-blue-700 hover:bg-blue-800" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              Student Early Warning Portal · OULAD Analytics
            </p>
          </Card>
        </section>
      </div>
    </main>
  );
}
