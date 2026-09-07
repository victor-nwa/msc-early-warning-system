
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Gauge,
  GraduationCap,
  LifeBuoy,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", to: "/", icon: Gauge },
  { label: "Learners", to: "/learners", icon: Users },
  { label: "Model Evaluation", to: "/model-performance", icon: BarChart3 },
  { label: "Interventions", to: "/interventions", icon: LifeBuoy },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sidebar className="border-r border-slate-800 bg-[#07111f] text-slate-200">
      <SidebarHeader className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-950/30">
            <GraduationCap className="h-6 w-6" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Student Early Warning
            </p>
            <p className="truncate text-xs text-slate-400">
              Analytics Portal
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Menu
        </div>

        <SidebarMenu className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to);

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "h-11 rounded-xl px-3 text-slate-400 transition-colors hover:bg-white/10 hover:text-white",
                    active &&
                      "bg-white text-slate-950 shadow-sm hover:bg-white hover:text-slate-950",
                  )}
                >
                  <Link to={item.to}>
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
