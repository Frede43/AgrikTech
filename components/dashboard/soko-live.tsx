"use client";

import { TrendingUp, TrendingDown, Minus, Zap, Loader2, ShieldCheck, Layers3, Clock3, Radar, MapPin } from "lucide-react";
import {
  getLivePriceActionText,
  getLivePriceBasisText,
  getLivePriceConfidenceText,
  getLivePriceDepthText,
  getLivePriceFreshnessLabel,
  getLivePriceScopeText,
  getLivePriceTrendText,
  getLivePriceVolatilityText,
  useLivePrices,
} from "@/lib/live-market";
import { formatBIF } from "@/lib/currency";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

const confidenceTone = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  low: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
} as const;

interface SokoLiveProps {
  province?: string | null;
}

export function SokoLive({ province }: SokoLiveProps) {
  const { prices, loading, scope } = useLivePrices({ province });
  const { lang } = useLanguage();

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/40 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Soko Live</h2>
          <p className="text-xs text-muted-foreground">Prix du marché AgriConnect — actualisation automatique</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {getLivePriceScopeText(scope.type, scope.label, lang)}
          </p>
        </div>
        {!loading && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs">Mise à jour des prix...</span>
          </div>
        ) : prices.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Aucune donnée de marché disponible pour le moment.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {prices.slice(0, 6).map((item) => (
            <div
              key={`${item.product}-${item.unit}`}
              className="rounded-2xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.product}</p>
                  <p className="mt-1 text-lg font-black text-foreground">
                    {formatBIF(item.price)}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">/{item.unit}</span>
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    item.trend === "up"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : item.trend === "down"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.trend === "up" ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : item.trend === "down" ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {getLivePriceTrendText(item, lang)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", confidenceTone[item.confidence_label ?? "medium"])}>
                  <ShieldCheck className="h-3 w-3" />
                  {getLivePriceConfidenceText(item.confidence_label, lang)}
                  {item.confidence_score ? ` ${item.confidence_score}/100` : ""}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Layers3 className="h-3 w-3" />
                  {getLivePriceDepthText(item.market_depth, lang)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Radar className="h-3 w-3" />
                  {getLivePriceVolatilityText(item.volatility, lang)}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-border/60 bg-background/80 p-3">
                <p className="text-xs font-semibold text-foreground">{getLivePriceActionText(item.recommended_action, lang)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {getLivePriceFreshnessLabel(item.freshness_minutes, lang)}
                  </span>
                  <span>{getLivePriceBasisText(item.pricing_basis, lang)}</span>
                  <span>{item.sample_size ?? 0} {lang === "fr" ? "signaux" : "ibimenyetso"}</span>
                </div>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
