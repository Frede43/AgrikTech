"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Package, Navigation, Clock, ChevronRight, Weight, Loader2, Info, CheckCircle, AlertTriangle } from "lucide-react";
import { LogisticsLayout } from "@/components/logistics/logistics-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

interface DeliveryDetail {
  id: number;
  orderId: string;
  status: string;
  farmer: { name: string; address: string; phone: string; coordinates: string };
  buyer: { name: string; address: string; phone: string; coordinates: string };
  items: { name: string; qty: number; unit: string }[];
  totalWeight: string;
  distance: string;
  estimatedDuration: string;
  instructions: string;
  pickup_qr: string;
  delivery_otp: string;
}

export default function LivraisonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { lang, text } = useLanguage();
  const { session, ready } = useRequiredSession("logistique");
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [valCode, setValCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const disputedLabel = lang === "fr" ? "Litige" : "Disputed";

  const statusLabels: Record<string, string> = {
    pending: text.logiStatusPending,
    ready_for_pickup: text.logiStatusPending,
    collected: text.logiStatusCollected,
    picked_up: text.logiStatusCollected,
    in_transit: text.logiStatusCollected,
    delivered: text.logiStatusDelivered,
    completed: text.logiStatusDelivered,
    disputed: disputedLabel,
  };

  useEffect(() => {
    if (!ready || !session || !id) return;

    setLoading(true);
    apiFetch(`/orders/${id}`)
      .then((data) => setDelivery(data))
      .catch((err) => logIfNotNetworkError("Delivery fetch error", err))
      .finally(() => setLoading(false));
  }, [id, ready, session]);

  const handleAction = async () => {
    if (!delivery || !session || !valCode) return;

    const isPickupStep = ["pending", "ready_for_pickup", "paid_escrow", "confirmed"].includes(delivery.status);
    const isDeliveryStep = ["collected", "picked_up", "in_transit", "delivered_pending_confirmation"].includes(delivery.status);
    if (!isPickupStep && !isDeliveryStep) return;

    setActionLoading(true);
    try {
      const endpoint = isPickupStep
        ? `/orders/${delivery.id}/pickup?qr_token=${encodeURIComponent(valCode)}&driver_id=${session.userId}`
        : `/orders/${delivery.id}/deliver?otp_code=${encodeURIComponent(valCode)}`;

      await apiFetch(endpoint, {
        method: "POST",
      });

      alert(isPickupStep ? text.logiConfirmPickup : text.logiConfirmDelivery);
      router.push("/logistique");
    } catch (err: unknown) {
      logIfNotNetworkError("Delivery action error", err);
      alert(getDisplayErrorMessage(
        err,
        lang === "fr"
          ? "Impossible de valider cette livraison pour le moment."
          : "Ntivyashobotse kwemeza iri shirwa ubu.",
      ));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center max-w-md mx-auto p-8 text-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.dashLoading}</p>
      </div>
    );
  }

  if (!delivery) return null;

  const isPickupStep = ["pending", "ready_for_pickup", "paid_escrow", "confirmed"].includes(delivery.status);
  const isDisputed = delivery.status === "disputed";
  const isDeliveryStep = ["collected", "picked_up", "in_transit", "delivered_pending_confirmation"].includes(delivery.status) || delivery.status === "delivered" || isDisputed;
  const isCompleted = delivery.status === "delivered" || delivery.status === "completed";
  const statusLabel = statusLabels[delivery.status] || delivery.status;

  return (
    <LogisticsLayout title={text.logiDetailTitle} subtitle={`${delivery.orderId} — ${delivery.distance} · ${delivery.estimatedDuration}`}>
      <div className="px-4 py-8 max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/logistique" className="w-10 h-10 rounded-xl border border-border flex items-center justify-center bg-card shadow-sm hover:bg-secondary transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-foreground tracking-tight truncate">{text.logiDetailTitle}</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{delivery.orderId}</p>
          </div>
          <Badge className={cn(
            "shrink-0 font-bold uppercase text-[9px] tracking-widest px-2.5 py-1 rounded-lg border-0",
            isDisputed ? "bg-amber-100 text-amber-800" : isCompleted ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary",
          )}>
            {statusLabel}
          </Badge>
        </div>

        {/* Route summary card */}
        <div className="bg-primary rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="grid grid-cols-3 gap-4 relative z-10">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                <Navigation className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Distance</span>
              <span className="text-sm font-black">{delivery.distance}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-x border-white/10 px-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Temps</span>
              <span className="text-sm font-black">{delivery.estimatedDuration}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                <Weight className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Poids</span>
              <span className="text-sm font-black">{delivery.totalWeight}</span>
            </div>
          </div>
        </div>

        {/* Farmer (pickup) */}
        <section className={cn("space-y-4 transition-opacity duration-300", !isPickupStep && "opacity-60")}>
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full shadow-[0_0_8px] shrink-0", isPickupStep ? "bg-accent shadow-accent/50" : "bg-muted shadow-none")} />
            <h2 className={cn("text-xs font-black uppercase tracking-widest", isPickupStep ? "text-accent" : "text-muted-foreground")}>{text.logiPickupPoint}</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 ml-2">
            <div>
              <p className="text-lg font-black text-foreground tracking-tight">{delivery.farmer.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5 font-medium">
                <MapPin className="w-4 h-4 text-accent/60" />
                <span>{delivery.farmer.address}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <a href={`tel:${delivery.farmer.phone}`} className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl font-bold text-xs h-11 border-border bg-background hover:bg-accent/5 hover:border-accent/20">
                  <Phone className="w-3.5 h-3.5" /> {text.logiCall}
                </Button>
              </a>
              <Button className="flex-1 gap-2 rounded-xl font-bold text-xs h-11 bg-accent text-white hover:bg-accent/90 shadow-sm shadow-accent/20">
                <Navigation className="w-3.5 h-3.5" /> {text.logiNavigate}
              </Button>
            </div>
          </div>
        </section>

        {/* Goods box */}
        <div className="ml-5 p-5 bg-secondary/30 rounded-2xl border border-dashed border-border/50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-border/20">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{lang === "fr" ? "Colis à transporter" : "Ibikwiye gutwarwa"}</p>
            <p className="text-sm font-bold text-foreground leading-snug">
              {delivery.items.map((item) => `${item.qty}${item.unit} ${item.name}`).join(" + ")}
            </p>
          </div>
        </div>

        {/* Buyer (delivery) */}
        <section className={cn("space-y-4 transition-opacity duration-300", !isDeliveryStep && "opacity-60")}>
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full shadow-[0_0_8px] shrink-0", isDeliveryStep ? "bg-primary shadow-primary/50" : "bg-muted shadow-none")} />
            <h2 className={cn("text-xs font-black uppercase tracking-widest", isDeliveryStep ? "text-primary" : "text-muted-foreground")}>{text.logiDeliveryPoint}</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 ml-2">
            <div>
              <p className="text-lg font-black text-foreground tracking-tight">{delivery.buyer.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5 font-medium">
                <MapPin className="w-4 h-4 text-primary/60" />
                <span>{delivery.buyer.address}</span>
              </div>
            </div>
            {delivery.instructions && (
              <div className="bg-primary/5 rounded-xl px-4 py-3 flex items-start gap-3 border border-primary/10">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary font-bold leading-tight">
                  <span className="opacity-60 uppercase tracking-widest mr-1.5">{text.logiInstructions} :</span> {delivery.instructions}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <a href={`tel:${delivery.buyer.phone}`} className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl font-bold text-xs h-11 border-border bg-background hover:bg-primary/5 hover:border-primary/20">
                  <Phone className="w-3.5 h-3.5" /> {text.logiCall}
                </Button>
              </a>
              <Button className="flex-1 gap-2 rounded-xl font-bold text-xs h-11 bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20">
                <Navigation className="w-3.5 h-3.5" /> {text.logiNavigate}
              </Button>
            </div>
          </div>
        </section>

        <Separator className="opacity-50" />

        {/* Validation section */}
        <section className={cn(
          "bg-card border-2 rounded-3xl p-6 shadow-lg space-y-5",
          isDisputed ? "border-amber-200 shadow-amber-500/5" : "border-primary/20 shadow-primary/5",
        )}>
          {isCompleted ? (
            <div className="flex items-center gap-4 text-primary">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-black uppercase tracking-tight">{text.logiCompleted}</p>
            </div>
          ) : isDisputed ? (
            <div className="flex items-start gap-4 text-amber-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-black uppercase tracking-tight">{disputedLabel}</p>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                  {lang === "fr"
                    ? "Cette livraison est gelée pendant le contrôle du litige. Aucune validation QR/OTP ne doit être confirmée avant résolution administrative."
                    : "This delivery is frozen during dispute review. Do not confirm QR/OTP validation until admin resolution."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest text-center">
                {isPickupStep ? text.logiValidationPickup : text.logiValidationDelivery}
              </h2>
              <div className="flex gap-3">
                <Input
                  placeholder={isPickupStep ? text.logiPlaceholderQR : text.logiPlaceholderOTP}
                  value={valCode}
                  onChange={(e) => setValCode(e.target.value)}
                  className="h-14 rounded-2xl bg-background border-border text-center text-lg font-black tracking-[0.2em] shadow-inner focus:ring-primary/20"
                />
                <Button
                  onClick={handleAction}
                  disabled={!valCode || actionLoading}
                  className="h-14 w-14 rounded-2xl bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20 shrink-0"
                >
                  {actionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ChevronRight className="w-8 h-8" />}
                </Button>
              </div>
              <div className="bg-secondary/10 rounded-xl p-4 text-center border border-border/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                  {isPickupStep
                    ? "Demandez le code de collecte au fermier lors de la récupération."
                    : "Demandez le code OTP à l'acheteur lors de la remise du colis."
                  }
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </LogisticsLayout>
  );
}
