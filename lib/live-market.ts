"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-config";
import { logIfNotNetworkError, useOnlineStatus } from "@/lib/offline";

export type LivePriceConfidenceLabel = "low" | "medium" | "high";
export type LivePriceMarketDepth = "low" | "medium" | "high";
export type LivePriceVolatility = "low" | "medium" | "high";
export type LivePriceRecommendedAction = "sell" | "hold" | "monitor" | "align_market";
export type LivePricePricingBasis = "active_listings" | "recent_sales" | "historical_sales";
export type LivePriceMarketScope = "national" | "province";

export interface LivePrice {
  product: string;
  price: number;
  unit: string;
  market_scope?: LivePriceMarketScope;
  market_scope_label?: string;
  trend: "up" | "down" | "stable";
  change: number;
  last_updated?: string | null;
  freshness_minutes?: number;
  sample_size?: number;
  active_listings?: number;
  active_stock_kg?: number;
  recent_delivered_orders?: number;
  provinces?: number;
  confidence_score?: number;
  confidence_label?: LivePriceConfidenceLabel;
  market_depth?: LivePriceMarketDepth;
  volatility?: LivePriceVolatility;
  recommended_action?: LivePriceRecommendedAction;
  pricing_basis?: LivePricePricingBasis;
  source?: string;
}

export const LIVE_PRICES_REFRESH_MS = 60_000;
const LIVE_PRICES_CACHE_KEY_PREFIX = "agriconnect_live_prices_cache";
const LIVE_PRICES_CACHE_VERSION = 3;
type LivePriceLang = "fr" | "ki";

export interface LivePriceScope {
  type: LivePriceMarketScope;
  label: string;
}

interface UseLivePricesOptions {
  province?: string | null;
  fallbackToNational?: boolean;
}

interface StoredLivePricesCache {
  version: number;
  scopeKey: string;
  prices: LivePrice[];
  savedAt: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeLivePricesProvince(province?: string | null) {
  const normalized = province?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  if (!normalized || ["burundi", "national", "nationwide", "all"].includes(normalized)) {
    return null;
  }
  return normalized;
}

function formatLivePricesProvinceLabel(province?: string | null) {
  const normalized = normalizeLivePricesProvince(province);
  if (!normalized) return "Burundi";
  return normalized.split(" ").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function getLivePricesScopeKey(province?: string | null) {
  const normalized = normalizeLivePricesProvince(province);
  return normalized ? `province:${normalized}` : "national";
}

function getLivePricesCacheKey(scopeKey: string) {
  return `${LIVE_PRICES_CACHE_KEY_PREFIX}:${scopeKey}`;
}

function loadCachedLivePrices(scopeKey: string) {
  if (!isBrowser()) return [] as LivePrice[];

  try {
    const raw = window.localStorage.getItem(getLivePricesCacheKey(scopeKey));
    if (!raw) return [] as LivePrice[];

    const parsed = JSON.parse(raw) as StoredLivePricesCache | LivePrice[];
    if (!Array.isArray(parsed) && parsed?.version !== LIVE_PRICES_CACHE_VERSION) {
      return [] as LivePrice[];
    }
    const prices = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.prices)
        ? parsed.prices
        : [];

    return prices.filter((item) => item && typeof item.product === "string" && Number.isFinite(Number(item.price)));
  } catch {
    return [] as LivePrice[];
  }
}

function persistCachedLivePrices(scopeKey: string, prices: LivePrice[]) {
  if (!isBrowser()) return;

  try {
    const payload: StoredLivePricesCache = {
      version: LIVE_PRICES_CACHE_VERSION,
      scopeKey,
      prices,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(getLivePricesCacheKey(scopeKey), JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function buildLivePricesScope(province?: string | null): LivePriceScope {
  const normalized = normalizeLivePricesProvince(province);
  return normalized
    ? { type: "province", label: formatLivePricesProvinceLabel(province) }
    : { type: "national", label: "Burundi" };
}

export function getLivePriceTrendText(item: Pick<LivePrice, "trend" | "change">, lang: LivePriceLang = "fr") {
  if (item.trend === "stable") {
    return lang === "fr" ? "Stable" : "Ntivyahindutse";
  }
  return `${item.change > 0 ? "+" : ""}${item.change}%`;
}

export function getLivePriceFreshnessLabel(minutes?: number | null, lang: LivePriceLang = "fr") {
  if (minutes == null) {
    return lang === "fr" ? "Actualisation indisponible" : "Igihe co gusubiramwo ntikizwi";
  }
  if (minutes < 60) {
    return lang === "fr" ? `Mis à jour il y a ${minutes} min` : `Vyahinduwe haheze iminota ${minutes}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return lang === "fr" ? `Mis à jour il y a ${hours} h` : `Vyahinduwe haheze amasaha ${hours}`;
  }

  const days = Math.floor(hours / 24);
  return lang === "fr" ? `Mis à jour il y a ${days} j` : `Vyahinduwe haheze iminsi ${days}`;
}

export function getLivePriceConfidenceText(level?: LivePriceConfidenceLabel, lang: LivePriceLang = "fr") {
  const normalized = level ?? "medium";
  if (lang === "ki") {
    return normalized === "high"
      ? "Kwizera gukomeye"
      : normalized === "low"
        ? "Kwizera guke"
        : "Kwizera hagati";
  }
  return normalized === "high"
    ? "Confiance élevée"
    : normalized === "low"
      ? "Confiance limitée"
      : "Confiance moyenne";
}

export function getLivePriceDepthText(level?: LivePriceMarketDepth, lang: LivePriceLang = "fr") {
  const normalized = level ?? "medium";
  if (lang === "ki") {
    return normalized === "high"
      ? "Isoko rinini"
      : normalized === "low"
        ? "Isoko rito"
        : "Isoko riringaniye";
  }
  return normalized === "high"
    ? "Marché profond"
    : normalized === "low"
      ? "Marché serré"
      : "Marché équilibré";
}

export function getLivePriceVolatilityText(level?: LivePriceVolatility, lang: LivePriceLang = "fr") {
  const normalized = level ?? "medium";
  if (lang === "ki") {
    return normalized === "high"
      ? "Ihindagurika rikomeye"
      : normalized === "low"
        ? "Ihindagurika rito"
        : "Ihindagurika riringaniye";
  }
  return normalized === "high"
    ? "Volatilité forte"
    : normalized === "low"
      ? "Volatilité faible"
      : "Volatilité modérée";
}

export function getLivePriceActionText(action?: LivePriceRecommendedAction, lang: LivePriceLang = "fr") {
  const normalized = action ?? "align_market";
  if (lang === "ki") {
    switch (normalized) {
      case "sell":
        return "Koresha ayo mahirwe yo kugurisha";
      case "hold":
        return "Banza urindire isoko";
      case "monitor":
        return "Bandanya ukurikirana isoko";
      default:
        return "Shira igiciro gisa n'isoko";
    }
  }

  switch (normalized) {
    case "sell":
      return "Fenêtre favorable pour vendre";
    case "hold":
      return "Attendre peut être plus rentable";
    case "monitor":
      return "Observer le marché avant d'ajuster";
    default:
      return "Positionnez-vous près du marché";
  }
}

export function getLivePriceBasisText(basis?: LivePricePricingBasis, lang: LivePriceLang = "fr") {
  const normalized = basis ?? "active_listings";
  if (lang === "ki") {
    switch (normalized) {
      case "recent_sales":
        return "Bishingiye ku bicuruzwa vyaheruka kugurishwa";
      case "historical_sales":
        return "Bishingiye ku mateka y'ugurisha";
      default:
        return "Bishingiye ku biciro biri ku isoko";
    }
  }

  switch (normalized) {
    case "recent_sales":
      return "Basé sur les ventes récentes";
    case "historical_sales":
      return "Basé sur l'historique";
    default:
      return "Basé sur les offres actives";
  }
}

export function getLivePriceScopeText(scope?: LivePriceMarketScope, label?: string | null, lang: LivePriceLang = "fr") {
  const normalizedScope = scope ?? "national";
  const normalizedLabel = (label || "").trim() || "Burundi";
  if (lang === "ki") {
    return normalizedScope === "province"
      ? `Isoko ryo hafi · ${normalizedLabel}`
      : `Isoko ry'igihugu · ${normalizedLabel}`;
  }
  return normalizedScope === "province"
    ? `Marché local · ${normalizedLabel}`
    : `Marché national · ${normalizedLabel}`;
}

export interface LivePricePositioning {
  status: "below" | "aligned" | "above";
  deltaPercent: number;
  label: string;
  description: string;
}

export function getLivePricePositioning(
  inputPrice: number,
  marketPrice?: Pick<LivePrice, "price" | "recommended_action">,
  lang: LivePriceLang = "fr",
): LivePricePositioning | null {
  if (!marketPrice || !Number.isFinite(inputPrice) || inputPrice <= 0 || !Number.isFinite(marketPrice.price) || marketPrice.price <= 0) {
    return null;
  }

  const deltaPercent = Number((((inputPrice - marketPrice.price) / marketPrice.price) * 100).toFixed(1));
  if (deltaPercent <= -8) {
    return {
      status: "below",
      deltaPercent,
      label: lang === "fr" ? "Prix agressif" : "Igiciro co hasi cane",
      description:
        lang === "fr"
          ? "Vous pouvez vendre vite, mais vérifiez votre marge." 
          : "Ushobora kugurisha ningoga, ariko banza urabe inyungu yawe.",
    };
  }
  if (deltaPercent >= 8) {
    return {
      status: "above",
      deltaPercent,
      label: lang === "fr" ? "Prix premium" : "Igiciro kiri hejuru",
      description:
        lang === "fr"
          ? "Justifiez la qualité, le calibrage ou la livraison." 
          : "Sobanura neza ubuziranenge canke serivisi zituma igiciro kiduga.",
    };
  }
  return {
    status: "aligned",
    deltaPercent,
    label: lang === "fr" ? "Prix compétitif" : "Igiciro kijanye n'isoko",
    description:
      lang === "fr"
        ? "Votre positionnement est cohérent avec le marché actuel." 
        : "Igiciro cawe kijanye n'uko isoko rimeze ubu.",
  };
}

export function useLivePrices(options: UseLivePricesOptions = {}) {
  const isOnline = useOnlineStatus();
  const [prices, setPrices] = useState<LivePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const requestedScope = buildLivePricesScope(options.province);
  const requestedScopeKey = getLivePricesScopeKey(options.province);
  const fallbackToNational = options.fallbackToNational ?? true;

  useEffect(() => {
    let active = true;
    const cachedPrices = loadCachedLivePrices(requestedScopeKey);

    if (active) {
      setPrices(cachedPrices);
      setLoading(cachedPrices.length === 0);
    }

    const fetchPrices = async (province?: string | null) => {
      const endpoint = province
        ? `/stats/prices?province=${encodeURIComponent(province)}`
        : "/stats/prices";
      const data = await apiFetch(endpoint, { cache: "no-store" }) as LivePrice[];
      const nextPrices = Array.isArray(data) ? data : [];
      persistCachedLivePrices(getLivePricesScopeKey(province), nextPrices);
      return nextPrices;
    };

    const loadPrices = async () => {
      if (!isOnline) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      try {
        let nextPrices = await fetchPrices(options.province);
        if (requestedScope.type === "province" && nextPrices.length === 0 && fallbackToNational) {
          nextPrices = await fetchPrices(null);
        }

        if (active) {
          setPrices(nextPrices);
          setLoading(false);
        }
      } catch (error) {
        logIfNotNetworkError("Live price fetch error", error, "warn");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPrices();

    if (!isOnline) {
      return () => {
        active = false;
      };
    }

    const intervalId = window.setInterval(loadPrices, LIVE_PRICES_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [fallbackToNational, isOnline, options.province, requestedScope.type, requestedScopeKey]);

  const resolvedScope = prices[0]
    ? {
        type: prices[0].market_scope ?? requestedScope.type,
        label: prices[0].market_scope_label ?? requestedScope.label,
      }
    : requestedScope;

  return { prices, loading, scope: resolvedScope };
}