"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { getUserInitials, useSessionUserProfile } from "@/lib/user-profile";

interface MinistereSidebarProps {
  mobile?: boolean;
}

export function MinistereSidebar({ mobile = false }: MinistereSidebarProps) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("ministere_agriculture");
  const { user, loading } = useSessionUserProfile(session, ready);
  const copy = {
    fr: {
      stats: "Statistiques agricoles",
      space: "Ministère de l'Agriculture",
      account: "Compte Ministère",
      navAria: "Navigation Ministère",
      logout: "Déconnexion",
    },
    ki: {
      stats: "Imibare y'uburimyi",
      space: "Ubuyobozi bw'Uburimyi",
      account: "Konti y'Ubuyobozi",
      navAria: "Ugucungera kw'Ubuyobozi",
      logout: "Gusohoka",
    },
  }[lang];
  const navItems = [{ href: "/ministere-agriculture", label: copy.stats, icon: BarChart3 }];
  const initials = getUserInitials(user?.name, "MA");

  return (
    <aside className={cn(
      "flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
      mobile ? "flex h-full overflow-y-auto" : "hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto",
    )}>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
          <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none">AgriConnect</p>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">{copy.space}</p>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary shrink-0 font-bold text-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.name || copy.account}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{copy.space}</p>
          </div>
          {loading && ready && session && <Loader2 className="ml-auto w-4 h-4 animate-spin text-sidebar-foreground/60" />}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label={copy.navAria}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <Link href="/deconnexion" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut className="w-4 h-4" />
          {copy.logout}
        </Link>
      </div>
    </aside>
  );
}
