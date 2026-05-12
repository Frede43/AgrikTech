"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, MapPin, Phone, CreditCard, Loader2 } from "lucide-react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart-context";
import { useLanguage } from "@/lib/LanguageContext";
import { useOnlineStatus } from "@/lib/offline";
import { formatUserLocation, useSessionUserProfile } from "@/lib/user-profile";

const paymentMethods = [
  { id: "lumicash", label: "Lumicash", prefix: "+257 7X", color: "bg-yellow-400", icon: "🌟" },
  { id: "ecocash", label: "EcoCash", prefix: "+257 7X", color: "bg-green-500", icon: "📱" },
  { id: "airtel", label: "Airtel Money", prefix: "+257 7X", color: "bg-red-500", icon: "💳" },
];

export default function PaiementPage() {
  const router = useRouter();
  const { lang, text } = useLanguage();
  const isOnline = useOnlineStatus();
  const { items, totalPrice, clearCart, hydrated } = useCart();
  const { session, ready, isOfflineFallback } = useRequiredSession("acheteur");
  const { user } = useSessionUserProfile(session, ready);
  const [method, setMethod] = useState("lumicash");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Pré-remplissage avec les données du profil
  useEffect(() => {
    if (user) {
      if (!address) setAddress(formatUserLocation(user));
      if (!phone) setPhone(user.phone_number || "");
    }
  }, [user, address, phone]);

  const delivery = items.length > 0 ? 5_000 : 0;
  const commission = Math.round(totalPrice * 0.05);
  const total = totalPrice + delivery + commission;

  const handlePay = async () => {
    if (!address || !phone || !session || !isOnline) return;
    setLoading(true);
    try {
      await Promise.all(
        items.map((item) =>
          apiFetch(`/orders/?buyer_id=${session.userId}`, {
            method: "POST",
            body: JSON.stringify({
              product_id: item.productId,
              quantity: item.quantity,
            }),
          }),
        ),
      );

      setConfirmed(true);
      clearCart();
      setTimeout(() => router.push("/acheteur/commande"), 3500);
    } catch (err: any) {
      console.error(err);
      alert(err.message || (lang === "fr" ? "Erreur lors de la transaction." : "Ntivyashobotse kwishura. Subira rugerage."));
    } finally {
      setLoading(false);
    }
  };

  if (!ready || !hydrated) {
    return (
      <BuyerLayout title={text.payTitle} subtitle={text.dashLoading}>
        <div className="px-4 py-24 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.dashLoading}</p>
        </div>
      </BuyerLayout>
    );
  }

  if (confirmed) {
    return (
      <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto items-center justify-center px-8 text-center gap-8">
        <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center shadow-inner relative overflow-hidden animate-in zoom-in duration-500">
          <div className="absolute inset-0 bg-primary/20 animate-ping opacity-50" />
          <CheckCircle className="w-14 h-14 text-primary relative z-10" />
        </div>
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight">{text.payConfirmed}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed font-medium max-w-[280px] mx-auto">
            {text.payConfirmedDesc}
          </p>
        </div>
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-3 bg-secondary/50 rounded-2xl px-6 py-3 border border-border/50">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{text.payRedirecting}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BuyerLayout title={text.payTitle} subtitle={text.paySubtitle}>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-24">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center bg-card shadow-sm hover:shadow-md hover:border-primary/20 transition-all active:scale-95 group">
            <ArrowLeft className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-foreground tracking-tight leading-none">{text.payTitle}</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/40 inline-block" />
              {items.length} {lang === "fr" ? "articles" : "ibintu"}
            </p>
          </div>
        </div>

        {(!isOnline || isOfflineFallback) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-medium">
            {lang === "fr"
              ? "Votre session et votre panier sont bien restaurés localement, mais une connexion active est nécessaire pour transmettre le paiement au serveur."
              : "Session yawe n'ibise vyawe vyasubijwe kuri telefone, ariko internet irakenewe kugira twungike ukwishura kuri serveur."}
          </div>
        )}

        {/* Delivery address */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">{text.payAddress}</h2>
            </div>
          </div>
          <Input
            placeholder={text.payAddressPlaceholder}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-14 text-sm rounded-2xl border-input bg-background font-semibold focus:ring-primary/20 shadow-inner px-5 transition-shadow"
          />
        </div>

        {/* Payment method */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 text-primary">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest">{text.payMethod}</h2>
          </div>
          <div className="grid gap-3">
            {paymentMethods.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "w-full flex items-center gap-5 p-4 rounded-2xl border-2 transition-all text-left group overflow-hidden relative",
                  method === m.id ? "border-primary bg-primary/5 shadow-md shadow-primary/5 scale-[1.02]" : "border-border/50 bg-background hover:border-primary/30 hover:shadow-sm"
                )}
              >
                {method === m.id && <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm border transition-colors",
                  method === m.id ? "bg-white border-primary/20" : "bg-card border-border/50 group-hover:bg-secondary/50"
                )}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-base font-black tracking-tight truncate transition-colors",
                    method === m.id ? "text-primary" : "text-foreground group-hover:text-foreground/80"
                  )}>{m.label}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5">{text.payMethodDesc}</p>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  method === m.id ? "border-primary bg-primary/20" : "border-border/80 group-hover:border-primary/50"
                )}>
                  {method === m.id && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-in zoom-in duration-300" />}
                </div>
              </button>
            ))}
          </div>

          <div className="relative mt-2">
            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={text.payPhonePlaceholder.replace("{method}", paymentMethods.find((m2) => m2.id === method)?.label || "")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-14 pl-12 text-sm rounded-2xl border-input bg-background font-black tracking-widest shadow-inner focus:ring-primary/20 transition-shadow"
              type="tel"
            />
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-gradient-to-br from-card to-secondary/10 rounded-3xl border border-border/80 p-6 space-y-5 shadow-md">
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">{text.paySummary}</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between items-start text-xs">
                <span className="text-muted-foreground font-semibold flex-1 pr-4">{item.name} <span className="text-[9px] uppercase tracking-widest ml-1 font-bold opacity-60">× {item.quantity}{item.unit}</span></span>
                <span className="text-foreground font-black whitespace-nowrap">{formatBIF(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <Separator className="bg-border/60" />
          <div className="flex justify-between items-end pt-1">
            <div className="space-y-1">
              <span className="text-xs font-black text-foreground uppercase tracking-widest block">{text.payTotalToPay}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block opacity-70">Incl. livraison & taxes</span>
            </div>
            <span className="text-2xl font-black text-primary tracking-tighter leading-none">{formatBIF(total)}</span>
          </div>
        </div>

        {/* Pay button */}
        <div className="space-y-5 pt-2">
          <Button
            onClick={handlePay}
            disabled={!address || !phone || !session || !isOnline || loading || items.length === 0}
            className="w-full h-16 bg-primary text-white hover:bg-primary/90 rounded-2xl font-black text-base shadow-xl gap-3 transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> <span className="tracking-widest uppercase text-sm">Traitement...</span></>
            ) : (
              <span className="uppercase tracking-widest">{text.payBtn.replace("{total}", formatBIF(total)).replace("{method}", paymentMethods.find((m) => m.id === method)?.label || "")}</span>
            )}
          </Button>

          {!isOnline && (
            <p className="text-sm text-center text-amber-700 font-medium">
              {lang === "fr"
                ? "Hors ligne : reconnectez-vous pour valider et transmettre le paiement."
                : "Nta internet : subira ku murongo kugira wemeze kandi wohereze ukwishura."}
            </p>
          )}

          <div className="bg-secondary/30 rounded-2xl p-4 flex items-start gap-3 border border-border/50">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-border">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed mt-1">
              {text.paySecureNote}
            </p>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
