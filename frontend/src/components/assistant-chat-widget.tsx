import { useMemo, useRef, useState } from "react";
import {
  Bot,
  HelpCircle,
  Loader2,
  Maximize2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type BreakdownItem = {
  label: string;
  value: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  items?: Record<string, any>[];
  breakdown?: BreakdownItem[];
  suggestions?: string[];
};

const DEFAULT_SUGGESTIONS = [
  "Break down learner ID ",
  "Which module has the most high-risk learners?",
  "Which region has the highest support workload?",
  "How many false negatives did the selected model produce?",
  "Why was Gradient Boosting selected?",
  "What action should staff take for high-risk learners?",
];

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

function isGreeting(input: string) {
  const cleaned = input.toLowerCase().replace(/[^a-z\s]/g, "").trim();

  return [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
    "morning",
    "afternoon",
    "evening",
    "yo",
  ].includes(cleaned);
}

function looksLikeLearnerId(input: string) {
  return /\b\d{4,}\b/.test(input);
}

function looksRelevant(input: string) {
  const value = input.toLowerCase();

  if (isGreeting(input)) return true;
  if (looksLikeLearnerId(input)) return true;

  const keywords = [
    "student",
    "learner",
    "id",
    "breakdown",
    "risk",
    "module",
    "course",
    "region",
    "intervention",
    "support",
    "assessment",
    "missing",
    "late",
    "submission",
    "engagement",
    "click",
    "vle",
    "model",
    "gradient",
    "boosting",
    "random forest",
    "logistic",
    "accuracy",
    "precision",
    "recall",
    "false negative",
    "fail",
    "withdraw",
    "overview",
    "cohort",
  ];

  return keywords.some((keyword) => value.includes(keyword));
}

async function askAssistant(question: string) {
  const res = await fetch(`${API_BASE_URL}/assistant/query`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    throw new Error("Assistant request failed");
  }

  return res.json();
}

function MiniResults({ items }: { items?: Record<string, any>[] }) {
  const rows = Array.isArray(items) ? items.slice(0, 5) : [];

  if (!rows.length) return null;

  const keys = Object.keys(rows[0]).slice(0, 4);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {keys.map((key) => (
              <th key={key} className="px-3 py-2 text-left font-semibold capitalize">
                {key.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index}>
              {keys.map((key) => (
                <td key={key} className="px-3 py-2 text-slate-700">
                  {String(row[key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownCard({ breakdown }: { breakdown?: BreakdownItem[] }) {
  const rows = Array.isArray(breakdown) ? breakdown : [];

  if (!rows.length) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Learner breakdown
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {item.label}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-800">
              {String(item.value || "—")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssistantChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hello. I can help with learner risk, interventions, model evaluation and overview analytics.",
      suggestions: DEFAULT_SUGGESTIONS,
    },
  ]);

  const latestSuggestions = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((msg) => msg.role === "assistant");
    return lastAssistant?.suggestions?.length ? lastAssistant.suggestions : DEFAULT_SUGGESTIONS;
  }, [messages]);

  function closeChat() {
    setOpen(false);
    setExpanded(false);
  }

  async function sendMessage(text?: string) {
    const question = String(text ?? input).trim();

    if (!question || busy) return;

    setInput("");
    setShowQuestions(false);

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: question,
      },
    ]);

    if (isGreeting(question)) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Hello. I can help you with learner risk, intervention priorities, model evaluation and overview insights. Tap “Show questions” whenever you need examples.",
          suggestions: DEFAULT_SUGGESTIONS,
        },
      ]);
      return;
    }

    if (!looksRelevant(question)) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Sorry, I can only help with this Student Early Warning Portal. Tap “Show questions” to see examples of what I can help with.",
          suggestions: DEFAULT_SUGGESTIONS,
        },
      ]);
      return;
    }

    try {
      setBusy(true);

      const response = await askAssistant(question);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            response?.answer ||
            "I could not generate a useful answer for that question.",
          suggestions: response?.suggestions || DEFAULT_SUGGESTIONS,
          items: response?.items || [],
          breakdown: response?.breakdown || [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Sorry, I could not reach the portal assistant service. Confirm the backend is running.",
          suggestions: DEFAULT_SUGGESTIONS,
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <>
      {open ? (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl",
            expanded
              ? "inset-6 rounded-3xl"
              : "right-8 top-1/2 h-[calc(100vh-96px)] max-h-[760px] w-[580px] max-w-[calc(100vw-32px)] -translate-y-1/2 rounded-3xl",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <Bot className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-semibold">Portal Assistant</p>
                <p className="text-xs text-slate-300">
                  Learner risk, models and support actions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowQuestions((value) => !value)}
                className="hidden rounded-full px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                {showQuestions ? "Hide questions" : "Show questions"}
              </button>

              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Resize assistant"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={closeChat}
                className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showQuestions ? (
            <div className="border-b border-slate-200 bg-white px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Quick questions
                </p>

                <button
                  type="button"
                  onClick={() => setShowQuestions(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Hide
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {latestSuggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      if (suggestion.toLowerCase().includes("learner id")) {
                        setInput("Break down learner ID ");
                        setShowQuestions(false);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      } else {
                        sendMessage(suggestion);
                      }
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-medium leading-4 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-5 py-5">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 shadow-sm",
                  )}
                >
                  <p>{message.text}</p>

                  {message.role === "assistant" ? (
                    <>
                      <BreakdownCard breakdown={message.breakdown} />
                      <MiniResults items={message.items} />
                    </>
                  ) : null}
                </div>
              </div>
            ))}

            {busy ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking portal data...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            {!showQuestions ? (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuestions(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Show questions
                </button>
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage();
                }}
                placeholder="Ask about a learner ID, risk, models or interventions..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={busy || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => {
            if (open) {
              closeChat();
            } else {
              setOpen(true);
              setShowQuestions(true);
              setTimeout(() => inputRef.current?.focus(), 80);
            }
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl hover:bg-slate-800"
          aria-label={open ? "Close portal assistant" : "Open portal assistant"}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>

        {!open ? (
          <div className="pointer-events-none absolute bottom-16 right-0 hidden w-max rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-lg lg:block">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Ask the portal assistant
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
