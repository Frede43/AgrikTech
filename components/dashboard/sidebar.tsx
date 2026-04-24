"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  Wallet,
  CloudSun,
  Star,
  LogOut,
  Leaf,
  Bell,
  Settings,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";

interface SidebarProps {
  mobile?: boolean;
}

export function Sidebar({ mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { session, ready } = useRequiredSession("fermier");
  const [user, setUser] = useState<{ name: string; province?: string | null } | null>(null);
  const { lang, text } = useLanguage();

  const navItems = [
    { href: "/fermier", label: text.sideDashboard, icon: LayoutDashboard },
    { href: "/produits/ajouter", label: text.sideAddProduct, icon: Package },
    { href: "/stock", label: text.sideStock, icon: Boxes },
    { href: "/transactions", label: text.sideTransactions, icon: ArrowLeftRight },
    { href: "/portefeuille", label: text.sideWallet, icon: Wallet },
    { href: "/meteo", label: text.sideWeather, icon: CloudSun },
    { href: "/fermier/temoignages", label: lang === "fr" ? "Mes témoignages" : "Ivyagiriza vyanje", icon: Star },
  ];

  useEffect(() => {
    if (!ready || !session) return;

    apiFetch(`/users/${session.userId}`)
      .then((data) => setUser(data))
      .catch((err) => {
        console.error("Farmer sidebar load error", err);
      });
  }, [ready, session]);

  const initials = (user?.name || text.sideFarmerProfile)
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className={cn(
      "flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
      mobile ? "flex" : "hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto",
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
          <Leaf className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none">AgriConnect</p>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">Burundi</p>
        </div>
      </div>

      {/* Farmer profile */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.name || text.sideFarmerProfile}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.province || text.sideProvinceNotSet}</p>
          </div>
          {!user && ready && session && <Loader2 className="ml-auto w-4 h-4 animate-spin text-sidebar-foreground/60" />}
          <Badge className="ml-auto shrink-0 bg-sidebar-primary/20 text-sidebar-primary border-0 text-xs">
            Pro
          </Badge>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Navigation principale">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/fermier" && pathname.startsWith(`${href}/`));
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
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <Link href="/fermier/notifications" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Bell className="w-4 h-4" />
          {text.sideNotifications}
        </Link>
        <Link href="/fermier/parametres" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Settings className="w-4 h-4" />
          {text.sideSettings}
        </Link>
        <Link href="/fermier/support" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <MessageCircle className="w-4 h-4" />
          {text.sideHelp}
        </Link>
        <Link href="/deconnexion" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut className="w-4 h-4" />
          {text.sideLogout}
        </Link>
      </div>
    </aside>
  );
}
