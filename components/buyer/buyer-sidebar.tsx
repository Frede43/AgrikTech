"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  ShoppingCart,
  Package,
  User,
  Star,
  Leaf,
  Bell,
  Settings,
  LogOut,
  MessageCircle,
  CloudSun,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { formatUserLocation, getUserInitials, useSessionUserProfile } from "@/lib/user-profile";

interface BuyerSidebarProps {
  mobile?: boolean;
}

export function BuyerSidebar({ mobile = false }: BuyerSidebarProps) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("acheteur");
  const { user, loading } = useSessionUserProfile(session, ready);
  const initials = getUserInitials(user?.name, "AC");
  const copy = {
    fr: {
      home: "Accueil",
      search: "Recherche",
      cart: "Panier",
      orders: "Commandes",
      profile: "Mon profil",
      testimonials: "Mes témoignages",
      messages: "Messagerie",
      space: "Espace Acheteur",
      account: "Compte acheteur",
      navAria: "Navigation acheteur",
      notifications: "Notifications",
      settings: "Paramètres",
      support: "Aide & Support",
      guide: "Guide d'utilisation",
      logout: "Déconnexion",
    },
    ki: {
      home: "Intango",
      search: "Kurondera",
      cart: "Igitebo",
      orders: "Ivyatumwe",
      profile: "Umwirondoro",
      testimonials: "Ivyagiriza vyanje",
      messages: "Ubutumwa",
      space: "Ikibanza c'Umuguzi",
      account: "Konti y'umuguzi",
      navAria: "Ugucungera kw'umuguzi",
      notifications: "Amenyesha",
      settings: "Amagenamiterere",
      support: "Imfashanyo n'ubufasha",
      guide: "Ubuyobozi bwo gukoresha",
      logout: "Gusohoka",
    },
  }[lang];
  const navItems = [
    { href: "/acheteur", label: copy.home, icon: Home },
    { href: "/acheteur/recherche", label: copy.search, icon: Search },
    { href: "/acheteur/panier", label: copy.cart, icon: ShoppingCart },
    { href: "/acheteur/commande", label: copy.orders, icon: Package },
    { href: "/meteo", label: lang === "fr" ? "Météo & Conseils" : "Ibihe & Inama", icon: CloudSun },
    { href: "/acheteur/temoignages", label: copy.testimonials, icon: Star },
    { href: "/acheteur/messages", label: copy.messages, icon: MessageCircle },
    { href: "/acheteur/profil", label: copy.profile, icon: User },
  ];

  return (
    <aside className={cn(
      "flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
      mobile ? "flex h-full overflow-y-auto" : "hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto",
    )}>
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

      {/* Buyer profile card */}
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label={copy.navAria}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/acheteur" && pathname.startsWith(`${href}/`));
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
        <Link href="/acheteur/notifications" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Bell className="w-4 h-4" />
          {copy.notifications}
        </Link>
        <Link href="/acheteur/parametres" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <Settings className="w-4 h-4" />
          {copy.settings}
        </Link>
        <Link href="/acheteur/guide" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <BookOpen className="w-4 h-4" />
          {copy.guide}
        </Link>
        <Link href="/acheteur/support" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
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
