"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBasket, ArrowRight, Package, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch, buildImageUrl } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { useCart } from "@/components/cart-context";
import { useLanguage } from "@/lib/LanguageContext";
import { isLikelyNetworkError, useOnlineStatus } from "@/lib/offline";
import { cn } from "@/lib/utils";

const CART_VALIDATION_STORAGE_KEY = "agriconnect_cart_validation";
const CART_VALIDATION_STORAGE_VERSION = 1;

interface ValidationItem {
  product_id: number;
  name: string;
  requested_quantity: number;
  validated_quantity: number;
  requested_price: number;
  current_price: number;
  available_stock: number;
  status: "ok" | "unavailable" | "stock_changed" | "price_changed";
  issues: string[];
  line_total: number;
}

interface CartValidationResult {
  valid: boolean;
  items: ValidationItem[];
  subtotal: number;
  available_total: number;
  issues: string[];
}

interface StoredCartValidation {
  version: number;
  fingerprint: string;
  result: CartValidationResult;
  savedAt: string;
}

function buildValidationFingerprint(items: Array<{ productId: number; price: number; quantity: number }>) {
  return JSON.stringify(items.map((item) => [item.productId, item.price, item.quantity]));
}

function loadStoredValidation(fingerprint: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CART_VALIDATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredCartValidation;
    if (parsed?.version !== CART_VALIDATION_STORAGE_VERSION || parsed.fingerprint !== fingerprint || !parsed.result) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveStoredValidation(fingerprint: string, result: CartValidationResult) {
  if (typeof window === "undefined") return;

  try {
    const payload: StoredCartValidation = {
      version: CART_VALIDATION_STORAGE_VERSION,
      fingerprint,
      result,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CART_VALIDATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage quota/privacy failures.
  }
}

function clearStoredValidation() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CART_VALIDATION_STORAGE_KEY);
  } catch {
    // Ignore localStorage failures.
  }
}

export default function PanierPage() {
  const router = useRouter();
  const { lang, text } = useLanguage();
  const isOnline = useOnlineStatus();
  const { items, removeItem, replaceItems, updateQuantity, totalPrice, hydrated } = useCart();
  const [validation, setValidation] = useState<CartValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationRevision, setValidationRevision] = useState(0);
  const validationFingerprint = useMemo(() => buildValidationFingerprint(items), [items]);

  const statusConfig = {
    ok: { label: text.cartStatusOk, className: "bg-primary/10 text-primary border-primary/20" },
    stock_changed: { label: text.cartStatusStockChanged, className: "bg-amber-100 text-amber-800 border-amber-200" },
    price_changed: { label: text.cartStatusPriceChanged, className: "bg-blue-100 text-blue-800 border-blue-200" },
    unavailable: { label: text.cartStatusUnavailable, className: "bg-destructive/10 text-destructive border-destructive/20" },
  } as const;

  const handleUpdateQty = (id: number, current: number, delta: number) => {
    updateQuantity(id, Math.max(1, current + delta));
  };

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (items.length === 0) {
      setValidation(null);
      setValidationError(null);
      setValidating(false);
      clearStoredValidation();
      return;
    }

    const cachedValidation = loadStoredValidation(validationFingerprint);

    if (!isOnline) {
      setValidation(cachedValidation?.result ?? null);
      setValidationError(
        cachedValidation
          ? (lang === "fr"
              ? "Hors ligne. La dernière vérification connue est affichée, mais une connexion est nécessaire avant paiement."
              : "Nta internet. Turerekana igenzura rya nyuma ryabitswe, ariko internet irakenewe imbere yo kwishura.")
          : (lang === "fr"
              ? "Hors ligne. Votre panier est bien conservé sur cet appareil, mais le stock et le paiement nécessitent une connexion."
              : "Nta internet. Ibise vyawe vyabitswe kuri iki gikoresho, ariko stock n'ukwishura bisaba internet."),
      );
      setValidating(false);
      return;
    }

    let cancelled = false;
    setValidating(true);
    setValidationError(null);

    apiFetch("/cart/validate", {
      method: "POST",
      body: JSON.stringify({ items }),
    })
      .then((data) => {
        if (cancelled) return;
        setValidation(data as CartValidationResult);
        saveStoredValidation(validationFingerprint, data as CartValidationResult);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error("Cart validation error", err);
        const fallbackValidation = isLikelyNetworkError(err) ? loadStoredValidation(validationFingerprint) : null;
        setValidation(fallbackValidation?.result ?? null);
        setValidationError(
          fallbackValidation
            ? (lang === "fr"
                ? "Connexion instable. La dernière vérification connue est affichée, mais une nouvelle validation est requise avant paiement."
                : "Internet ntimeze neza. Turerekana igenzura rya nyuma ryabitswe, ariko irindi genzura rirakenewe imbere yo kwishura.")
            : (err.message || (lang === "fr" ? "Impossible de vérifier le panier." : "Ntivyashobotse gusuzuma ibise vyawe.")),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setValidating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isOnline, items, validationFingerprint, validationRevision, lang]);

  const validationMap = useMemo(
    () => new Map(validation?.items.map((item) => [item.product_id, item]) || []),
    [validation],
  );

  const handleSyncCart = () => {
    if (!validation) return;

    const itemMap = new Map(items.map((item) => [item.productId, item]));
    const nextItems = validation.items.flatMap((line) => {
      const item = itemMap.get(line.product_id);
      if (!item || line.validated_quantity <= 0) return [];

      return [{
        ...item,
        quantity: line.validated_quantity,
        price: line.current_price,
      }];
    });

    replaceItems(nextItems);
  };

  const delivery = items.length > 0 ? 5_000 : 0;
  const commission = Math.round(totalPrice * 0.05);
  const total = totalPrice + delivery + commission;
  const availableSubtotal = validation?.available_total ?? totalPrice;
  const availableCommission = Math.round(availableSubtotal * 0.05);
  const availableCheckoutTotal = availableSubtotal + delivery + availableCommission;
  const canCheckout = hydrated && isOnline && items.length > 0 && !validating && !validationError && validation?.valid !== false;

  if (!hydrated) {
    return (
      <BuyerLayout title={text.cartTitle}>
        <div className="px-4 py-24 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.dashLoading}</p>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout title={text.cartTitle}>
      <div className="px-4 py-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">{text.cartTitle}</h1>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1">
              {text.cartItemsCount.replace("{count}", String(items.length)).replace("{s}", items.length !== 1 ? "s" : "")}
            </p>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => replaceItems([])} className="text-destructive font-bold text-[10px] uppercase tracking-widest hover:bg-destructive/5 hover:text-destructive">
              {lang === "fr" ? "Vider" : "Kuraho vyose"}
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-6 bg-card rounded-3xl border border-dashed border-border shadow-sm">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
              <ShoppingBasket className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold text-foreground">{text.cartEmpty}</p>
              <p className="text-sm text-muted-foreground max-w-[220px] mx-auto">{text.cartEmptyDesc}</p>
            </div>
            <Button className="bg-primary text-white hover:bg-primary/90 rounded-2xl px-8 font-bold shadow-md" onClick={() => router.push("/acheteur/recherche")}>
              {text.cartExploreBtn}
            </Button>
          </div>
        ) : (
          <>
            {validationError && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive font-medium flex flex-col gap-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{validationError}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setValidationRevision((v) => v + 1)} className="w-fit rounded-xl border-destructive/20 bg-white hover:bg-destructive/5 font-bold text-xs h-9">
                  {lang === "fr" ? "Réessayer" : "Subira rugerage"}
                </Button>
              </div>
            )}

            {validating && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4 text-sm text-primary font-bold shadow-sm animate-pulse">
                <RefreshCw className="w-5 h-5 animate-spin" />
                {text.cartVerifying}
              </div>
            )}

            {validation && !validation.valid && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4 shadow-sm border-l-4 border-l-amber-500">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-base font-bold text-amber-900">{text.cartSyncRequired}</p>
                    <p className="text-sm text-amber-800/80">
                      {text.cartSyncRequiredDesc.replace("{total}", formatBIF(validation.available_total))}
                    </p>
                  </div>
                </div>
                {validation.issues.length > 0 && (
                  <ul className="list-disc pl-5 text-[11px] text-amber-800 font-medium space-y-1 opacity-80">
                    {validation.issues.map((issue, index) => (
                      <li key={`${issue}-${index}`}>{issue}</li>
                    ))}
                  </ul>
                )}
                <Button onClick={handleSyncCart} className="w-full bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-bold h-11 shadow-sm">
                  {text.cartSyncBtn}
                </Button>
              </div>
            )}

            {/* Items */}
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="bg-card border border-border rounded-2xl p-4 flex gap-4 shadow-sm group hover:border-primary/20 transition-all">
                  <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center text-4xl shrink-0 overflow-hidden relative shadow-inner">
                    {item.image_url ? (
                      <img
                        src={buildImageUrl(item.image_url) || item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-muted-foreground/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-bold text-foreground truncate">{item.name}</p>
                      <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{formatBIF(item.price)}/{item.unit}</p>

                    {validationMap.get(item.productId) && (
                      <div className="space-y-2 py-1">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-sm ${statusConfig[validationMap.get(item.productId)!.status].className}`}>
                          {statusConfig[validationMap.get(item.productId)!.status].label}
                        </span>
                        {validationMap.get(item.productId)!.issues.map((issue, index) => (
                          <p key={`${item.productId}-${index}`} className="text-[10px] text-muted-foreground font-medium italic">
                            • {issue}
                          </p>
                        ))}
                        {(validationMap.get(item.productId)!.status === "stock_changed" || validationMap.get(item.productId)!.status === "price_changed") && (
                          <div className="bg-primary/5 rounded-lg px-2 py-1 border border-primary/10">
                            <p className="text-[10px] font-bold text-primary">
                              {lang === "fr" ? "Dispo" : "Bihari"} : {validationMap.get(item.productId)!.validated_quantity}{item.unit} @ {formatBIF(validationMap.get(item.productId)!.current_price)}/{item.unit}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 shadow-inner border border-border/50">
                        <button
                          onClick={() => handleUpdateQty(item.productId, item.quantity, -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center hover:bg-primary/5 active:scale-95 transition-all shadow-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-black w-12 text-center text-foreground">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(item.productId, item.quantity, 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center hover:bg-primary/5 active:scale-95 transition-all shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-primary tracking-tight">{formatBIF(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-md bg-gradient-to-br from-card to-secondary/5">
              <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">{text.cartSummary}</h2>
              <div className="space-y-3">
                {[
                  { label: text.cartSubtotal, value: formatBIF(totalPrice) },
                  { label: text.cartDelivery, value: formatBIF(delivery) },
                  { label: text.cartCommission, value: formatBIF(commission) },
                  ...(validation && !validation.valid
                    ? [{ label: lang === "fr" ? "Ajustement live" : "Guhinyanyura ubu", value: formatBIF(validation.available_total - totalPrice), color: "text-amber-600 font-bold" }]
                    : []),
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className={cn("text-foreground font-bold", color)}>{value}</span>
                  </div>
                ))}
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between pt-2">
                <span className="text-xl font-black text-foreground tracking-tight">{text.cartTotal}</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-primary tracking-tighter">{formatBIF(validation && !validation.valid ? availableCheckoutTotal : total)}</span>
                  {validation && !validation.valid && (
                    <p className="text-[10px] font-bold text-muted-foreground line-through opacity-50">{formatBIF(total)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={() => router.push("/acheteur/paiement")}
              disabled={!canCheckout}
              className="w-full h-14 rounded-2xl font-black text-base shadow-xl bg-primary text-white hover:bg-primary/90 transition-transform hover:scale-[1.01] active:scale-[0.98] gap-3"
            >
              {validating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {text.dashLoading}</>
              ) : validation && !validation.valid ? (
                lang === "fr" ? "Veuillez synchroniser" : "Hinyanyura ibise"
              ) : (
                <>
                  {text.cartCheckoutBtn}
                  <ArrowRight className="w-5 h-5 opacity-40" />
                </>
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground/60 font-bold uppercase tracking-widest">
              {isOnline
                ? "Paiement sécurisé par Lumicash / EcoCash"
                : (lang === "fr" ? "Connexion requise avant paiement" : "Internet irakenewe imbere yo kwishura")}
            </p>
          </>
        )}
      </div>
    </BuyerLayout>
  );
}
