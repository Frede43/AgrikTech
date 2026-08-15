"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MapPin, Package, Clock, ChevronRight, CheckCircle, Truck, RefreshCw, PlusCircle, Loader2 } from "lucide-react";
import { LogisticsLayout } from "@/components/logistics/logistics-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, getRoleLabel } from "@/lib/api-config";
import { logIfNotNetworkError } from "@/lib/offline";
import { formatUserLocation, getUserInitials } from "@/lib/user-profile";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/LanguageContext";

interface Order {
  id: number;
  orderId: string;
  status: string;
  farmer: string;
  address: string;
  items: Array<{ name: string; qty: number; unit: string }>;
  items_label: string;
  distance: string;
  pickupTime: string;
  priority: string;
  driver_id: number | null;
  driver_name: string | null;
}

export default function LogistiquePage() {
  const { session, ready } = useRequiredSession("logistique");
  const { lang, text } = useLanguage();
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [pool, setPool] = useState<Order[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [acceptMsg, setAcceptMsg] = useState<string | null>(null);

  const priorityConfig = {
    high: { label: text.logiPriorityUrgent, color: "bg-destructive/10 text-destructive border-destructive/20" },
    medium: { label: text.logiPriorityNormal, color: "bg-primary/10 text-primary border-primary/20" },
    low: { label: text.logiPriorityLow, color: "bg-secondary text-muted-foreground border-border" },
  };

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [mineData, poolData, userData] = await Promise.all([
        apiFetch(`/orders/logistics?mode=mine&driver_id=${session.userId}`),
        apiFetch(`/orders/logistics?mode=pool`),
        apiFetch(`/users/${session.userId}`),
      ]);
      setMyOrders(Array.isArray(mineData) ? mineData : []);
      setPool(Array.isArray(poolData) ? poolData : []);
      setUser(userData);
    } catch (err) {
      logIfNotNetworkError("Logistics fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!ready || !session) return;
    void fetchData();
  }, [ready, session, fetchData]);

  const handleAccept = async (orderId: number) => {
    if (!session) return;
    setAccepting(orderId);
    setAcceptMsg(null);
    try {
      await apiFetch(`/orders/${orderId}/accept?driver_id=${session.userId}`, { method: "POST" });
      setAcceptMsg(lang === "fr" ? "✅ Commande acceptée ! Elle apparaît dans vos livraisons." : "✅ Commande yemewe! Iraba mu matangwa yawe.");
      await fetchData();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("409") || msg.toLowerCase().includes("déjà")) {
        setAcceptMsg(lang === "fr" ? "⚠️ Cette commande vient d'être prise par un autre livreur." : "⚠️ Uyu murimo wafashwe n'undi mushoferi.");
      } else {
        setAcceptMsg(lang === "fr" ? "Impossible d'accepter cette commande." : "Ntivyashobotse kwemera uyu murimo.");
      }
    } finally {
      setAccepting(null);
    }
  };

  const pending = myOrders.filter((o) => ["READY_FOR_PICKUP", "PICKED_UP", "pending", "collected"].includes(o.status.toUpperCase()) || o.status === "pending" || o.status === "collected");
  const done = myOrders.filter((o) => o.status.toUpperCase() === "COMPLETED" || o.status.toUpperCase() === "DELIVERED" || o.status === "delivered");
  const driverInitials = getUserInitials(user?.name, "LV");
  const driverRoleLabel = getRoleLabel(user?.role || "logistique", lang);
  const currentZone = formatUserLocation(user);

  return (
    <LogisticsLayout title={text.logiTitle} subtitle={`${text.logiMissions.replace("{count}", String(myOrders.length))} — ${currentZone}`}>
      <div className="px-4 py-8 max-w-2xl mx-auto space-y-6">
        {/* Driver greeting */}
        <div className="bg-primary rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xl shadow-inner border border-white/20">
              {driverInitials}
            </div>
            <div>
              <p className="font-black text-xl tracking-tight">{user ? user.name : text.dashLoading}</p>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1 opacity-80">{driverRoleLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 mt-6 pt-6 border-t border-white/10 relative z-10">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 opacity-70" />
              <span className="text-sm font-bold">{text.logiPendingCount.replace("{count}", String(pending.length))}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 opacity-70" />
              <span className="text-sm font-bold">{text.logiDoneCount.replace("{count}", String(done.length))}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 opacity-70" />
              <span className="text-sm font-bold">{currentZone}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: lang === "fr" ? "Mes missions" : "Imirimo yanje", value: myOrders.length, color: "text-foreground" },
            { label: lang === "fr" ? "Livrées" : "Zatanzwe", value: done.length, color: "text-primary" },
            { label: lang === "fr" ? "Pool dispo" : "Ibikiri mu pool", value: pool.length, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-black tracking-tighter ${color}`}>{loading ? "..." : value}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>

        {acceptMsg && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-bold text-foreground">
            {acceptMsg}
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.dashLoading}</p>
          </div>
        ) : (
          <>
            {/* Mes livraisons en cours */}
            {myOrders.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" />
                  {lang === "fr" ? "Mes livraisons" : "Imirimo yanje"}
                </h2>
                {myOrders.map((col) => {
                  const priority = priorityConfig[col.priority as keyof typeof priorityConfig] || priorityConfig.medium;
                  return (
                    <Link
                      key={col.id}
                      href={`/logistique/livraison/${col.id}`}
                      className="group block bg-card border border-border rounded-2xl p-5 space-y-4 hover:shadow-lg hover:border-primary/20 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{col.farmer}</p>
                          <div className="flex items-center gap-1.5 text-muted-foreground/80">
                            <MapPin className="w-3.5 h-3.5 text-primary/40" />
                            <span className="text-xs font-medium">{col.address}</span>
                          </div>
                        </div>
                        <Badge className={cn("shrink-0 border text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg", priority.color)}>{priority.label}</Badge>
                      </div>
                      <div className="bg-secondary/40 rounded-xl px-4 py-3 flex items-center gap-3 border border-border/50">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground leading-snug">{col.items_label}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-4 text-muted-foreground font-bold text-[10px] uppercase tracking-tight">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary/40" />{col.pickupTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          {text.logiDetails} <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pool disponible */}
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
                <PlusCircle className="w-3.5 h-3.5" />
                {lang === "fr" ? `Commandes disponibles (${pool.length})` : `Imirimo iboneka (${pool.length})`}
              </h2>
              {pool.length === 0 ? (
                <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
                  <p className="text-sm font-bold text-muted-foreground">
                    {lang === "fr" ? "Aucune commande disponible pour le moment." : "Nta murimo uhari ubu."}
                  </p>
                </div>
              ) : (
                pool.map((col) => (
                  <div key={col.id} className="bg-card border border-amber-200 rounded-2xl p-5 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-base font-bold text-foreground">{col.farmer}</p>
                        <div className="flex items-center gap-1.5 text-muted-foreground/80">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-medium">{col.address}</span>
                        </div>
                      </div>
                      <Badge className="shrink-0 border text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border-amber-200">
                        {lang === "fr" ? "Libre" : "Iboneka"}
                      </Badge>
                    </div>
                    <div className="bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-amber-100">
                      <Package className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-foreground leading-snug">{col.items_label}</span>
                    </div>
                    <Button
                      className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2 shadow-sm"
                      disabled={accepting === col.id}
                      onClick={() => handleAccept(col.id)}
                    >
                      {accepting === col.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> {lang === "fr" ? "Acceptation..." : "Kwemera..."}</>
                      ) : (
                        <><PlusCircle className="w-4 h-4" /> {lang === "fr" ? "Accepter cette livraison" : "Kwemera gutanga"}</>
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>

            {myOrders.length === 0 && pool.length === 0 && (
              <div className="py-24 text-center gap-4 flex flex-col items-center bg-card rounded-3xl border border-dashed border-border shadow-sm">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground/20" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">{text.logiMissionNone}</p>
              </div>
            )}
          </>
        )}
      </div>
    </LogisticsLayout>
  );
}
