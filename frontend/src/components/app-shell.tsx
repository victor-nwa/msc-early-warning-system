
import { type ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, RefreshCw, UserCircle, Wifi, WifiOff } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { api } from "@/lib/api";
import { getStoredUser, getToken, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AssistantChatWidget } from "@/components/assistant-chat-widget";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function AppShell({ title, subtitle, children, actions, hideHeader = false }: AppShellProps) {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }

    setUser(getStoredUser());
  }, []);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000,
    retry: 1,
  });

  const connected = health.isSuccess;

  if (!getToken()) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-[#f5f7fb] text-slate-950">
        <div className="flex min-h-screen w-full">
          <AppSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
              <div className="flex h-16 items-center gap-4 px-4 md:px-7">
                <SidebarTrigger className="-ml-1 text-slate-600" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="truncate text-base font-semibold tracking-tight text-slate-950 md:text-lg">
                      Student Early Warning Portal
                    </h1>

                    <span
                      className={cn(
                        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium md:inline-flex",
                        connected
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700",
                      )}
                    >
                      {connected ? (
                        <>
                          <Wifi className="h-3.5 w-3.5" />
                          Backend online
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3.5 w-3.5" />
                          Backend offline
                        </>
                      )}
                    </span>
                  </div>

                  <p className="truncate text-xs text-slate-500">
                    OULAD learning analytics, risk prediction and intervention intelligence
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {actions}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => health.refetch()}
                    className="hidden border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:inline-flex"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>

                  {user ? (
                    <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm md:flex">
                      <UserCircle className="h-4 w-4 text-slate-500" />
                      <span className="max-w-[150px] truncate">{user.full_name}</span>
                    </div>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      logout();
                      window.location.href = "/login";
                    }}
                    className="text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="hidden md:inline">Logout</span>
                  </Button>
                </div>
              </div>
            </header>

            <main className="flex-1 px-4 py-6 md:px-7 md:py-7">
              <div className="mx-auto w-full max-w-[1500px]">
                <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {title}
                    </h2>
                    {subtitle ? (
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>

                {children}
          <AssistantChatWidget />
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
