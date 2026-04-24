"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, MessageCircle, Package, ChevronRight, LogOut, Loader2, MapPin, Settings, Bell, CheckCircle } from "lucide-react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { apiFetch } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { useRequiredSession } from "@/lib/session";
import { formatUserCoordinates, formatUserLocation, getUserInitials, useSessionUserProfile } from "@/lib/user-profile";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

interface BuyerOrder {
  id: number;
  farmer: string;
  total: number;
}

export default function ProfilPage() {
  const { lang, text } = useLanguage();
  const { session, ready } = useRequiredSession("acheteur");
  const { user, loading: userLoading } = useSessionUserProfile(session, ready);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const menuItems = [
    { icon: Package, label: text.profMenuOrders, href: "/acheteur/commande", desc: text.profMenuOrdersDesc },
    { icon: Settings, label: text.profMenuSettings, href: "/acheteur/parametres", desc: text.profMenuSettingsDesc },
    { icon: Bell, label: text.profMenuNotif, href: "/acheteur/notifications", desc: text.profMenuNotifDesc },
    { icon: MessageCircle, label: text.profMenuHelp, href: "/acheteur/support", desc: text.profMenuHelpDesc },
  ];

  useEffect(() => {
    if (!ready || !session) return;

    setOrdersLoading(true);
    apiFetch(`/orders/buyer/${session.userId}`)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Buyer profile orders load error", err);
        setOrders([]);
      })
      .finally(() => setOrdersLoading(false));
  }, [ready, session]);

  const stats = useMemo(() => {
    const uniqueFarmers = new Set(orders.map((order) => order.farmer));
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      totalOrders: orders.length,
      farmers: uniqueFarmers.size,
      totalSpent,
    };
  }, [orders]);

  if (!ready || (userLoading && !user) || ordersLoading) {
    return (
      <BuyerLayout title={text.profTitle} subtitle={text.dashLoadingSub}>
        <div className="px-4 py-24 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.profSyncing}</p>
        </div>
      </BuyerLayout>
    );
  }

  const initials = getUserInitials(user?.name, "AC");

  return (
    <BuyerLayout title={text.profTitle} subtitle={formatUserLocation(user)}>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6 pb-24">
        {/* Avatar card */}
        <div className="relative bg-primary rounded-3xl p-8 flex flex-col items-center gap-4 text-center shadow-xl overflow-hidden">
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-black/20 rounded-full blur-3xl opacity-50" />

          <div className="relative z-10 w-24 h-24 rounded-[2rem] bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-4xl shadow-inner border border-white/30 hover:scale-105 transition-transform duration-500">
            {initials}
          </div>
          <div className="space-y-1.5 relative z-10">
            <h1 className="text-2xl font-black text-white tracking-tight">{user?.name || text.profUserDef}</h1>
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">{user?.phone_number || text.profPhoneDef}</p>
          </div>
          <div className="flex gap-3 relative z-10 pt-2">
            <Badge className="bg-green-400 text-green-950 border-0 font-black uppercase tracking-widest text-[9px] px-3 py-1.5 shadow-sm shadow-green-500/20">{text.profVerified}</Badge>
            <Badge className="bg-white/20 text-white backdrop-blur-sm border-white/20 font-black uppercase tracking-widest text-[9px] px-3 py-1.5 shadow-sm">{text.profOrdersCount.replace("{count}", String(stats.totalOrders))}</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: text.profLblOrders, value: String(stats.totalOrders) },
            { label: text.profLblFarmers, value: String(stats.farmers) },
            { label: text.profLblSpent, value: formatBIF(stats.totalSpent) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border shadow-sm rounded-3xl p-5 text-center flex flex-col justify-center items-center min-h-[100px] hover:-translate-y-1 hover:shadow-md transition-all">
              <p className={cn("font-black tracking-tighter", label === text.profLblSpent ? "text-primary text-xl" : "text-foreground text-3xl")}>{value}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Phone info */}
          <div className="bg-card border border-border shadow-sm rounded-3xl p-5 flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 border border-border/50 group-hover:bg-primary/10 transition-colors">
              <Phone className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">{text.profPhoneTitle}</p>
              <p className="text-base font-black text-foreground tracking-tight">{user?.phone_number || text.profPhoneDef}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 opacity-80" />
          </div>

          <div className="bg-card border border-border shadow-sm rounded-3xl p-5 flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 border border-border/50 group-hover:bg-primary/10 transition-colors">
              <MapPin className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{text.profAddressTitle}</p>
              <p className="text-base font-black text-foreground tracking-tight leading-tight">{formatUserLocation(user)}</p>
              <p className="text-[10px] font-bold text-muted-foreground/70 font-mono tracking-tight bg-secondary/50 inline-block px-2 py-0.5 rounded-md">{text.profGps} {formatUserCoordinates(user)}</p>
            </div>
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Menu */}
        <div className="bg-card border border-border shadow-sm rounded-3xl p-2 divide-y divide-border/50">
          {menuItems.map(({ icon: Icon, label, href, desc }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/50 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{label}</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-0.5 uppercase tracking-widest">{desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>

        {/* Sync status */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 relative overflow-hidden text-center space-y-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-sm font-black text-green-800 tracking-tight">{text.profSyncTitle}</p>
          <p className="text-[10px] font-bold text-green-700/80 leading-relaxed uppercase tracking-widest max-w-[250px] mx-auto">
            {text.profSyncDesc}
          </p>
          <div className="pt-2">
            <Link href="/acheteur/parametres" className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-green-800 hover:text-green-900 bg-green-500/20 px-4 py-2 rounded-xl transition-colors">
              {text.profUpdateBtn} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-2 border-destructive/20 text-destructive font-black text-sm uppercase tracking-widest hover:bg-destructive hover:text-white hover:border-destructive transition-colors gap-3">
          <Link href="/deconnexion">
            <LogOut className="w-5 h-5" />
            {text.profLogout}
          </Link>
        </Button>
      </div>
    </BuyerLayout>
  );
}
