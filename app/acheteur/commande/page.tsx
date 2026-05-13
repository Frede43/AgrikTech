"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone, CheckCircle, Circle, MapPin, Clock, Package, Truck, Home, QrCode, Loader2, AlertTriangle } from "lucide-react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch, buildImageUrl } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

interface BuyerOrderItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
  lineTotal: number;
  image_url?: string | null;
}

interface BuyerOrder {
  id: number;
  orderId: string;
  status: string;
  placedAt: string;
  farmer: string;
  driver: { name: string; phone: string | null } | null;
  items: BuyerOrderItem[];
  total: number;
  totalWeight: string;
  estimatedDelivery: string;
  pickup_qr: string;
  delivery_otp: string;
}

const stepIcons: Record<string, typeof Package> = {
  confirmed: Package,
  preparation: Package,
  pickup: Truck,
  transit: Truck,
  delivered: Home,
};

export default function CommandePage() {
  const { session, ready } = useRequiredSession("acheteur");
  const { lang, text } = useLanguage();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const disputedLabel = lang === "fr" ? "Litige" : "Disputed";

  const statusConfig = {
    pending: {
      label: text.trackStatusPending,
      className: "bg-accent/20 text-accent-foreground border-accent/30",
    },
    collected: {
      label: text.trackStatusCollected,
      className: "bg-primary/10 text-primary border-primary/20",
    },
    delivered: {
      label: text.trackStatusDelivered,
      className: "bg-primary text-primary-foreground border-0",
    },
    disputed: {
      label: disputedLabel,
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    picked_up: {
      label: text.trackStatusCollected,
      className: "bg-primary/10 text-primary border-primary/20",
    },
    completed: {
      label: text.trackStatusDelivered,
      className: "bg-primary text-primary-foreground border-0",
    },
  } as const;

  const loadLatestOrder = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    try {
      const fetchedOrders = await apiFetch(`/orders/buyer/${session.userId}`);
      const nextOrders = Array.isArray(fetchedOrders) ? (fetchedOrders as BuyerOrder[]) : [];
      setOrders(nextOrders);
      setSelectedOrderId((current) => {
        if (current && nextOrders.some((candidate) => candidate.id === current)) {
          return current;
        }
        return nextOrders[0]?.id ?? null;
      });
      setError(null);
    } catch (err: any) {
      console.error("Buyer order fetch error", err);
      setError(err.message || "Impossible de charger le suivi de commande.");
      setOrders([]);
      setSelectedOrderId(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadLatestOrder();
  }, [loadLatestOrder, ready, session]);

  const order = useMemo(() => {
    if (orders.length === 0) return null;
    return orders.find((candidate) => candidate.id === selectedOrderId) ?? orders[0];
  }, [orders, selectedOrderId]);

  const handleCancelOrder = async () => {
    if (!order) return;
    const confirmMsg = lang === "fr" 
      ? "Êtes-vous sûr de vouloir annuler cette commande ? Le stock sera restauré et vous serez remboursé si le paiement a été effectué."
      : "Are you sure you want to cancel this order? Stock will be restored and you will be refunded if payment was made.";
    
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await apiFetch(`/orders/${order.id}/cancel`, { method: "POST" });
      await loadLatestOrder();
      const successMsg = lang === "fr" ? "Commande annulée avec succès." : "Order cancelled successfully.";
      alert(successMsg);
    } catch (err: any) {
      console.error("Cancel order error", err);
      alert(err.message || "Erreur lors de l'annulation.");
    } finally {
      setLoading(false);
    }
  };

  const steps = useMemo(() => {
    if (!order) return [];

    const normalizedStatus = order.status.toLowerCase().replace(/ /g, "_");
    const isDelivered = normalizedStatus === "delivered" || normalizedStatus === "completed";
    const isDisputed = normalizedStatus === "disputed";
    const isCollected = ["collected", "picked_up", "picked up", "in_transit", "in transit"].includes(normalizedStatus);
    
    const currentIndex = isCollected || isDisputed ? 2 : isDelivered ? 3 : 1;

    return [
      {
        key: "confirmed",
        label: text.trackStep1,
        time: order.placedAt,
      },
      {
        key: "preparation",
        label: text.trackStep2,
        time: order.status === "pending" ? order.estimatedDelivery : text.trackStep1Desc,
      },
      {
        key: "transit",
        label: text.trackStep3,
        time:
          order.status === "collected" || isDisputed
            ? order.estimatedDelivery
            : order.status === "delivered"
              ? text.trackStep2Desc
              : text.trackStep3Desc,
      },
      {
        key: "delivered",
        label: text.trackStep4,
        time: order.status === "delivered" ? text.trackStep4Desc1 : text.trackStep4Desc2,
      },
    ].map((step, index) => ({
      ...step,
      done: isDelivered ? true : index < currentIndex,
      current: !isDelivered && index === currentIndex,
    }));
  }, [order, text]);

  if (!ready || loading) {
    return (
      <BuyerLayout title={text.trackTitle} subtitle={text.dashLoadingSub}>
        <div className="px-4 py-24 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.trackLoading}</p>
        </div>
      </BuyerLayout>
    );
  }

  if (!order) {
    return (
      <BuyerLayout title={text.trackTitle} subtitle={text.trackEmpty}>
        <div className="px-4 py-16 space-y-6 text-center max-w-sm mx-auto">
          <div className="w-24 h-24 mx-auto rounded-full bg-secondary flex items-center justify-center border-4 border-background shadow-sm">
            <Package className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-foreground tracking-tight">{text.trackEmpty}</h1>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              {text.trackEmptyDesc}
            </p>
          </div>
          {error && <p className="text-xs font-bold text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
          <Button asChild className="w-full h-14 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20">
            <Link href="/acheteur/recherche">{text.trackDiscover}</Link>
          </Button>
        </div>
      </BuyerLayout>
    );
  }

    const normalizedStatus = order.status.toLowerCase().replace(/ /g, "_");
    const statusBadge = statusConfig[normalizedStatus as keyof typeof statusConfig] || statusConfig.pending;
    const isDisputed = normalizedStatus === "disputed";
  const driverInitials = order.driver?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "--";
  const selectedOrderIndex = orders.findIndex((candidate) => candidate.id === order.id);

  return (
    <BuyerLayout title={text.trackTitle} subtitle={`${order.orderId} — ${order.placedAt}`}>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6 pb-20">
        <div className="bg-card border border-border shadow-sm rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-black text-foreground tracking-tight">{text.trackTitle}</h1>
            <Badge className={cn("px-3 py-1.5 uppercase font-black tracking-widest text-[9px] rounded-lg", statusBadge.className)}>{statusBadge.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-secondary/50 border-border text-foreground font-medium text-xs rounded-md">
              {order.orderId}
            </Badge>
            <p className="text-xs font-semibold text-muted-foreground">
              {text.trackPlacedOn} <span className="text-foreground">{order.placedAt}</span>
            </p>
          </div>
          {error && <p className="text-xs font-bold text-destructive bg-destructive/10 p-3 rounded-lg mt-3">{error}</p>}
        </div>

        {orders.length > 1 && (
          <div className="bg-card border border-border shadow-sm rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-foreground tracking-tight">
                  {lang === "fr" ? "Toutes vos commandes de ce paiement" : "All orders from this checkout"}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {lang === "fr"
                    ? `${orders.length} commandes ont été créées, une par produit.`
                    : `${orders.length} orders were created, one per product.`}
                </p>
              </div>
              <Badge variant="outline" className="rounded-lg bg-secondary/50">
                {selectedOrderIndex + 1}/{orders.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {orders.map((candidate) => {
                const candidateStatus = statusConfig[candidate.status as keyof typeof statusConfig] || statusConfig.pending;
                const isSelected = candidate.id === order.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedOrderId(candidate.id)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground truncate">{candidate.orderId}</p>
                        <p className="text-xs font-medium text-muted-foreground truncate">
                          {(candidate.items ?? [])[0]?.name || text.trackItemsTitle} • {candidate.placedAt}
                        </p>
                      </div>
                      <Badge className={cn("px-2 py-1 text-[9px] uppercase tracking-widest rounded-lg", candidateStatus.className)}>
                        {candidateStatus.label}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isDisputed && (
          <div className="bg-amber-50 border border-amber-200 shadow-sm rounded-3xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-black uppercase tracking-widest text-amber-800">{disputedLabel}</p>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                {lang === "fr"
                  ? "Un litige a été ouvert sur cette commande. Les fonds restent gelés et la livraison est en vérification jusqu’à décision administrative."
                  : "A dispute has been opened for this order. Funds remain frozen and delivery is under review until admin resolution."}
              </p>
            </div>
          </div>
        )}

        {/* Progress tracker */}
        <div className="bg-card border border-border shadow-sm rounded-3xl p-6 space-y-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          {steps.map((step, index) => {
            const Icon = stepIcons[step.key] ?? Circle;
            const isLast = index === steps.length - 1;
            return (
              <div key={step.key} className="flex gap-4 relative z-10">
                {/* Icon + line */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 transition-colors duration-500",
                    step.done ? "bg-primary text-white shadow-lg shadow-primary/20" :
                      step.current ? "bg-accent text-white shadow-lg shadow-accent/20" :
                        "bg-secondary/50 border border-border text-muted-foreground/50"
                  )}>
                    {step.done ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  {!isLast && (
                    <div className={cn(
                      "w-0.5 flex-1 min-h-12 my-2 transition-colors duration-500",
                      step.done ? "bg-primary/50" : "bg-border/50"
                    )} />
                  )}
                </div>
                {/* Text */}
                <div className={cn("pb-6 flex-1 transition-opacity duration-300", !step.done && !step.current && "opacity-50")}>
                  <p className={cn(
                    "text-base font-black tracking-tight leading-tight",
                    step.done || step.current ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  <p className={cn(
                    "text-xs font-semibold mt-1",
                    step.current ? "text-accent" : "text-muted-foreground"
                  )}>
                    {step.current && <span className="uppercase tracking-widest text-[9px] mr-1">{text.trackInProgress}</span>}
                    {step.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delivery OTP */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 bg-primary/10 w-24 h-24 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-primary/10 relative z-10">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1.5 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">{text.trackOtpTitle}</p>
            <p className="text-2xl font-mono font-black text-primary tracking-[0.3em] break-all bg-white/50 p-3 rounded-lg border border-primary/10 text-center select-all">{order.delivery_otp}</p>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed pt-1">
              {text.trackOtpDesc}
            </p>
          </div>
        </div>

        {/* Driver & ETA card combined */}
        <div className="bg-card border border-border shadow-sm rounded-3xl overflow-hidden divide-y divide-border">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{text.trackDriverTitle}</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-foreground font-black text-xl border border-border shrink-0 shadow-inner">
                {driverInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-foreground tracking-tight">{order.driver?.name || text.trackDriverUnassigned}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5 leading-tight">
                  {order.driver?.phone || text.trackDriverPhoneEmpty}
                </p>
              </div>
              {order.driver?.phone && (
                <a href={`tel:${order.driver.phone}`}>
                  <Button size="icon" className="w-12 h-12 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-0 flex-shrink-0">
                    <Phone className="w-5 h-5 fill-current" />
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border bg-secondary/30">
            <div className="p-4 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                <p className="text-[9px] font-black uppercase tracking-widest leading-none">{text.trackEta}</p>
              </div>
              <p className="text-sm font-black text-foreground leading-tight">{order.estimatedDelivery}</p>
            </div>
            <div className="p-4 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-2 text-primary/60">
                <MapPin className="w-4 h-4" />
                <p className="text-[9px] font-black uppercase tracking-widest leading-none">{text.trackFarmer}</p>
              </div>
              <p className="text-sm font-black text-foreground leading-tight truncate">{order.farmer}</p>
            </div>
          </div>
        </div>

        {/* Order details */}
        <div className="bg-card border border-border shadow-sm rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-foreground tracking-tight">{text.trackItemsTitle}</h2>
            <Badge className="bg-secondary text-muted-foreground border-0 font-bold uppercase tracking-widest text-[9px]">
              {text.trackTotalWeight}: {order.totalWeight}
            </Badge>
          </div>

          <div className="space-y-4">
            {(order.items ?? []).map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {item.image_url ? (
                      <img
                        src={buildImageUrl(item.image_url) || item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">{item.name}</p>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      {item.qty} {item.unit} <span className="text-muted-foreground/50 mx-1">×</span> {formatBIF(item.price)}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-black text-foreground shrink-0 tabular-nums">{formatBIF(item.lineTotal)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-5 opacity-50" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-foreground uppercase tracking-widest">{text.trackTotalPaid}</span>
            <span className="text-xl font-black text-primary tracking-tighter">{formatBIF(order.total)}</span>
          </div>

          <div className="space-y-3 mt-4">
            <Button variant="outline" className="w-full h-12 rounded-xl font-bold bg-background shadow-xs gap-2" onClick={() => void loadLatestOrder()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              {text.trackRefresh}
            </Button>

            {["pending", "pending_payment", "paid_escrow", "confirmed", "ready_for_pickup"].includes(normalizedStatus) && (
              <Button 
                variant="ghost" 
                className="w-full h-12 rounded-xl font-bold text-destructive hover:bg-destructive/10 gap-2" 
                onClick={handleCancelOrder}
                disabled={loading}
              >
                <AlertTriangle className="w-4 h-4" />
                {lang === "fr" ? "Annuler la commande" : "Cancel Order"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
