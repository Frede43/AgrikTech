"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  Truck,
  CheckCircle,
  Leaf,
  Bell,
  Settings,
  LogOut,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { formatUserLocation, getUserInitials, useSessionUserProfile } from "@/lib/user-profile";

export function LogisticsSidebar() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("logistique");
  const { user, loading } = useSessionUserProfile(session, ready);
  const [orders, setOrders] = useState<Array<{ status: string }>>([]);
  const copy = {
    fr: {
      missions: "Mes collectes",
      validation: "Validation livraison",
      space: "Espace Livreur",
      account: "Compte livreur",
      activeMissions: "{count} missions actives",
      collected: "{count} collectées",
      navAria: "Navigation livreur",
      notifications: "Notifications",
      settings: "Paramètres",
      support: "Aide & Support",
      logout: "Déconnexion",
    },
    ki: {
      missions: "Ivyo kwegeranya",
      validation: "Kwemeza ishikanwa",
      space: "Ikibanza c'Umushikiriza",
      account: "Konti y'umushikiriza",
      activeMissions: "Ingendo {count} ziriko zirakorwa",
      collected: "{count} vyegeranijwe",
      navAria: "Ugucungera kw'umushikiriza",
      notifications: "Amenyesha",
      settings: "Amagenamiterere",
      support: "Imfashanyo n'ubufasha",
      logout: "Gusohoka",
    },
  }[lang];
  const navItems = [
    { href: "/logistique", label: copy.missions, icon: List },
    { href: "/logistique/validation", label: copy.validation, icon: CheckCircle },
  ];

  useEffect(() => {
    if (!ready || !session) return;
    // On récupère les missions assignées au livreur pour les compteurs
    apiFetch(`/orders/logistics?mode=mine&driver_id=${session.userId}`)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Logistics sidebar load error", err));
  }, [ready, session]);

  const initials = getUserInitials(user?.name, "LV");
  const activeCount = orders.filter((order) => ["READY_FOR_PICKUP", "PENDING"].includes(order.status.toUpperCase())).length;
  const collectedCount = orders.filter((order) => ["PICKED_UP", "COLLECTED"].includes(order.status.toUpperCase())).length;

  return (
    <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
          <Leaf className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none">AgriConnect</p>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">{copy.space}</p>
        </div>
      </div>

      {/* Driver profile card */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary shrink-0 font-bold text-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.name || copy.account}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{formatUserLocation(user)}</p>
          </div>
          {loading && ready && session && <Loader2 className="ml-auto w-4 h-4 animate-spin text-sidebar-foreground/60" />}
        </div>
        <div className="flex items-center gap-3 mt-3 px-1 text-xs text-sidebar-foreground/60">
          <span className="flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            {copy.activeMissions.replace("{count}", String(activeCount))}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
            {copy.collected.replace("{count}", String(collectedCount))}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label={copy.navAria}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/logistique" && pathname.startsWith(href));
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



      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <Link href="/logistique/notifications" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Bell className="w-4 h-4" />
          {copy.notifications}
        </Link>
        <Link href="/logistique/parametres" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Settings className="w-4 h-4" />
          {copy.settings}
        </Link>
        <Link href="/logistique/support" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <MessageCircle className="w-4 h-4" />
          {copy.support}
        </Link>
        <Link href="/deconnexion" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut className="w-4 h-4" />
          {copy.logout}
        </Link>
      </div>
    </aside>
  );
}
