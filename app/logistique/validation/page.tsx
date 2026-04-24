"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Loader2, MapPin, Package, QrCode, ShieldCheck } from "lucide-react";
import { LogisticsLayout } from "@/components/logistics/logistics-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

interface LogisticsMission {
  id: number;
  orderId: string;
  status: string;
  farmer: string;
  address: string;
  items: string;
  distance: string;
  pickupTime: string;
  priority: string;
  buyer: string;
  buyer_address: string;
  pickup_qr: string;
  delivery_otp: string;
}

export default function ValidationPage() {
  const { lang, text } = useLanguage();
  const { session, ready } = useRequiredSession("logistique");
  const [missions, setMissions] = useState<LogisticsMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const priorityConfig = {
    high: { bg: "bg-destructive/10 text-destructive border-destructive/20", label: "Urgent" },
    medium: { bg: "bg-accent/20 text-accent-foreground border-accent/20", label: "Normal" },
    low: { bg: "bg-secondary text-muted-foreground border-border", label: "Bas" },
  } as const;

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    apiFetch("/orders/logistics")
      .then((data) => {
        setMissions(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err: unknown) => {
        logIfNotNetworkError("Logistics validation load error", err);
        setError(getDisplayErrorMessage(err, "Impossible de charger le hub de validation."));
      })
      .finally(() => setLoading(false));
  }, [ready, session]);

  const pickupMissions = useMemo(
    () => missions.filter((mission) => mission.status === "pending"),
    [missions],
  );
  const deliveryMissions = useMemo(
    () => missions.filter((mission) => mission.status === "collected"),
    [missions],
  );

  if (!ready || loading) {
    return (
      <LogisticsLayout title={text.validTitle} subtitle={text.validSubLoading}>
        <div className="py-24 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.validLoading}</p>
        </div>
      </LogisticsLayout>
    );
  }

  return (
    <LogisticsLayout title={text.validTitle} subtitle={text.validSubReady.replace("{count}", String(pickupMissions.length + deliveryMissions.length))}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">

        {/* Info Card */}
        <div className="bg-primary border border-primary/20 shadow-xl shadow-primary/10 rounded-3xl p-6 space-y-4 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner border border-white/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">{text.validHubTitle}</h1>
              <p className="text-sm text-white/80 font-medium leading-relaxed mt-1">
                {text.validHubDesc}
              </p>
            </div>
          </div>
          {error && <p className="text-xs font-bold text-white bg-destructive/80 px-3 py-2 rounded-xl text-center shadow-sm max-w-max relative z-10">{error}</p>}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: text.validQrLabel, value: pickupMissions.length, accent: "text-accent", bg: "bg-accent/5", border: "border-accent/10" },
            { label: text.validOtpLabel, value: deliveryMissions.length, accent: "text-primary", bg: "bg-primary/5", border: "border-primary/10" },
            { label: text.validTotalLabel, value: missions.length, accent: "text-foreground", bg: "bg-card", border: "border-border" },
          ].map((item, i) => (
            <div key={i} className={cn("rounded-2xl p-4 text-center border shadow-sm hover:-translate-y-1 transition-transform cursor-default", item.bg, item.border)}>
              <p className={cn("text-3xl font-black tracking-tighter", item.accent)}>{item.value}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{item.label}</p>
            </div>
          ))}
        </div>

        <Separator className="opacity-50" />

        {/* Pending Pickups (QR) */}
        {pickupMissions.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center shadow-sm">
                <QrCode className="w-4 h-4 text-accent" />
              </div>
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">{text.validQrSection}</h2>
            </div>
            <div className="grid gap-4">
              {pickupMissions.map((mission) => {
                const priority = priorityConfig[mission.priority as keyof typeof priorityConfig] || priorityConfig.medium;
                return (
                  <Link
                    key={mission.id}
                    href={`/logistique/livraison/${mission.id}`}
                    className="block bg-card border border-border shadow-sm rounded-3xl p-5 hover:border-accent/30 hover:shadow-md transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                      <div className="space-y-1 min-w-0">
                        <p className="text-base font-black text-foreground tracking-tight group-hover:text-accent transition-colors">{mission.orderId}</p>
                        <p className="text-xs font-semibold text-muted-foreground"><span className="uppercase tracking-widest text-[9px] opacity-70 mr-1.5">{text.validPickupAt}</span> {mission.farmer}</p>
                      </div>
                      <Badge className="bg-accent text-white border-0 font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 shadow-sm">QR pickup</Badge>
                    </div>
                    <div className="bg-secondary/30 rounded-2xl p-4 space-y-3 relative z-10 border border-border/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-foreground/80">
                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-accent/60 shrink-0" /><span className="truncate">{mission.address}</span></div>
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-accent/60 shrink-0" />{mission.pickupTime}</div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Package className="w-4 h-4 text-accent shrink-0" />
                        <span className="truncate font-bold text-foreground text-xs">{mission.items}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mt-4 relative z-10">
                      <span className="text-muted-foreground"><span className="opacity-60 mr-1">{text.validDestFinal}</span> <span className="text-foreground">{mission.buyer}</span></span>
                      <span className="flex items-center gap-1 text-accent bg-accent/10 px-3 py-1.5 rounded-xl">{text.validOpenMission} <ChevronRight className="w-3.5 h-3.5" /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Deliveries (OTP) */}
        {deliveryMissions.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">{text.validOtpSection}</h2>
            </div>
            <div className="grid gap-4">
              {deliveryMissions.map((mission) => (
                <Link
                  key={mission.id}
                  href={`/logistique/livraison/${mission.id}`}
                  className="block bg-card border border-border shadow-sm rounded-3xl p-5 hover:border-primary/30 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                    <div className="space-y-1 min-w-0">
                      <p className="text-base font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{mission.orderId}</p>
                      <p className="text-xs font-semibold text-muted-foreground"><span className="uppercase tracking-widest text-[9px] opacity-70 mr-1.5">{text.validDeliveryTo}</span> {mission.buyer}</p>
                    </div>
                    <Badge className="bg-primary text-white border-0 font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 shadow-sm">OTP delivery</Badge>
                  </div>
                  <div className="bg-secondary/30 rounded-2xl p-4 space-y-3 relative z-10 border border-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-foreground/80">
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary/60 shrink-0" /><span className="truncate">{mission.buyer_address}</span></div>
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary/60 shrink-0" />{mission.distance}</div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Package className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate font-bold text-foreground text-xs">{mission.items}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mt-4 relative z-10">
                    <span className="text-muted-foreground"><span className="opacity-60 mr-1">{text.validCollectedAt}</span> <span className="text-foreground">{mission.farmer}</span></span>
                    <span className="flex items-center gap-1 text-primary bg-primary/10 px-3 py-1.5 rounded-xl">{text.validConfirmDelivery} <ChevronRight className="w-3.5 h-3.5" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {missions.length === 0 && (
          <div className="bg-card border-2 border-dashed border-border rounded-3xl p-10 text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center border-4 border-background shadow-sm">
              <QrCode className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-black text-foreground tracking-tight">{text.validEmptyTitle}</p>
              <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {text.validEmptyDesc}
              </p>
            </div>
            <Button asChild variant="outline" className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-sm border-border hover:bg-secondary">
              <Link href="/logistique">{text.validBack}</Link>
            </Button>
          </div>
        )}
      </div>
    </LogisticsLayout>
  );
}
