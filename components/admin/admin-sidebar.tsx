"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Wallet,
  FileText,
  Star,
  Bell,
  Settings,
  LogOut,
  Leaf as LeafIcon,
  ShieldCheck,
  Loader2,
  Building2,
  Coins,
  IdCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { apiFetch, getRoleLabel } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

interface AdminSidebarProps {
  mobile?: boolean;
}

export function AdminSidebar({ mobile = false }: AdminSidebarProps) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [stats, setStats] = useState<{ open_disputes: number; unread_notifications: number; pending_withdrawals: number } | null>(null);
  const copy = {
    fr: {
      section: "Administration",
      overview: "Vue d'ensemble",
      users: "Utilisateurs",
      disputes: "Litiges",
      withdrawals: "Retraits",
      testimonials: "Témoignages",
      audits: "Audits finance",
      obr: "Conformité OBR",
      credits: "Gestion des Crédits",
      account: "Compte admin",
      loading: "Chargement...",
      navAria: "Navigation admin",
      notifications: "Notifications",
      settings: "Paramètres",
      logout: "Déconnexion",
    },
    ki: {
      section: "Ubuyobozi",
      overview: "Incamake",
      users: "Abakoresha",
      disputes: "Impari",
      withdrawals: "Kubikuza",
      testimonials: "Ivyagiriza",
      audits: "Igenzura ry'imari",
      obr: "Ibijanye n'ikori (OBR)",
      credits: "Ibijanye n'ingane",
      account: "Konti y'admin",
      loading: "Biriko biratangura...",
      navAria: "Ugucungera admin",
      notifications: "Amenyesha",
      settings: "Amagenamiterere",
      logout: "Gusohoka",
    },
  }[lang];

  useEffect(() => {
    if (!ready || !session) return;

    Promise.all([
      apiFetch(`/users/${session.userId}`),
      apiFetch("/stats/admin"),
    ])
      .then(([userData, statsData]) => {
        setUser(userData);
        setStats(statsData);
      })
      .catch((err) => {
        console.error("Admin sidebar load error", err);
      });
  }, [ready, session]);

  const unread = stats?.unread_notifications ?? 0;
  const navItems: AdminNavItem[] = [
    { href: "/admin", label: copy.overview, icon: LayoutDashboard },
    { href: "/admin/litiges", label: copy.disputes, icon: AlertTriangle, badge: stats?.open_disputes ?? 0 },
    { href: "/admin/retraits", label: copy.withdrawals, icon: Wallet, badge: stats?.pending_withdrawals ?? 0 },
    { href: "/admin/temoignages", label: copy.testimonials, icon: Star },
    { href: "/admin/audits-finance", label: copy.audits, icon: FileText },
    { href: "/admin/obr", label: copy.obr, icon: Building2 },
    { href: "/admin/credits", label: copy.credits, icon: Coins },
    { href: "/admin/cooperatives", label: lang === "fr" ? "Coopératives" : "Amashirahamwe", icon: ShieldCheck },
    { href: "/admin/kyc", label: lang === "fr" ? "Vérification KYC" : "Kwemeza uwo bari", icon: IdCard },
    { href: "/admin/utilisateurs", label: copy.users, icon: Users },
  ];

  return (
    <aside className={cn(
      "flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
      mobile ? "h-full overflow-y-auto" : "hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto",
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
          <LeafIcon className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none">AgriConnect</p>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">{copy.section}</p>
        </div>
      </div>

      {/* Admin badge */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {user?.name || copy.account}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user ? getRoleLabel(user.role, lang) : copy.loading}
            </p>
          </div>
          {!stats && ready && session && <Loader2 className="ml-auto w-4 h-4 animate-spin text-sidebar-foreground/60" />}
          {unread > 0 && (
            <Badge className="ml-auto shrink-0 bg-destructive text-destructive-foreground border-0 text-xs">
              {unread}
            </Badge>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label={copy.navAria}>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
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
              {badge != null && badge > 0 && (
                <Badge className="bg-destructive text-destructive-foreground border-0 text-xs px-1.5 py-0.5 h-auto">
                  {badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>



      {/* Bottom */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <Link href="/admin/notifications" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Bell className="w-4 h-4" />
          {copy.notifications}
          {unread > 0 && (
            <span className="ml-auto w-2 h-2 rounded-full bg-destructive" />
          )}
        </Link>
        <Link href="/admin/parametres" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Settings className="w-4 h-4" />
          {copy.settings}
        </Link>
        <Link href="/deconnexion" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut className="w-4 h-4" />
          {copy.logout}
        </Link>
      </div>
    </aside>
  );
}
