"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ChevronRight, Star, Clock, RefreshCw, MapPin } from "lucide-react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Badge } from "@/components/ui/badge";
import {
  getLivePriceConfidenceText,
  getLivePriceFreshnessLabel,
  getLivePriceScopeText,
  getLivePriceTrendText,
  useLivePrices,
} from "@/lib/live-market";
import { apiFetch, buildImageUrl } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { useLanguage } from "@/lib/LanguageContext";
import { loadCachedCatalogue, logIfNotNetworkError, saveCachedCatalogue, useOnlineStatus } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useSessionUserProfile } from "@/lib/user-profile";

interface Product {
  id: number;
  name: string;
  category: string;
  price_per_kg: number;
  unit: string;
  quantity_kg: number;
  province: string;
  harvested_at: string;
  rating: number;
  image_url: string | null;
}

interface PromoCard {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
}

export default function BuyerHomePage() {
  const { session, ready } = useRequiredSession("acheteur");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");
  const { lang, text } = useLanguage();
  const isOnline = useOnlineStatus();
  const { user } = useSessionUserProfile(session, ready);
  const { prices: livePrices, loading: livePricesLoading, scope } = useLivePrices({ province: user?.province });
  const liveMarketScopeText = getLivePriceScopeText(scope.type, scope.label, lang);

  useEffect(() => {
    const fetchData = async () => {
      const cacheScope = "buyer-home";
      const cachedCatalogue = loadCachedCatalogue<Product, any>(cacheScope);

      if (cachedCatalogue) {
        setProducts(cachedCatalogue.products);
        setCategories(cachedCatalogue.categories);
        setLoading(false);
      }

      if (!isOnline) {
        setOfflineNotice(cachedCatalogue ? text.catalogueOfflineNotice : text.catalogueOfflineEmpty);
        return;
      }

      try {
        const [pData, cData] = await Promise.all([
          apiFetch("/products/"),
          apiFetch("/categories")
        ]);
        setProducts(pData);
        setCategories(cData);
        saveCachedCatalogue(cacheScope, {
          products: pData as Product[],
          categories: cData as any[],
          savedAt: new Date().toISOString(),
        });
        setOfflineNotice("");
      } catch (err) {
        logIfNotNetworkError("Failed to fetch data", err);
        setOfflineNotice(cachedCatalogue ? text.catalogueOfflineNotice : text.catalogueOfflineEmpty);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isOnline, text.catalogueOfflineEmpty, text.catalogueOfflineNotice]);

  const featured = products.slice(0, 4);
  const promoCards = [
    livePrices[0]
      ? {
        id: `live-${livePrices[0].product}-${livePrices[0].unit}`,
        badge: text.buyerLiveMarketBadge,
        title: `${livePrices[0].product} à ${formatBIF(livePrices[0].price)}/${livePrices[0].unit}`,
        subtitle:
          `${
            livePrices[0].trend === "up"
              ? text.buyerMarketTrendUp.replace("{change}", String(livePrices[0].change))
              : livePrices[0].trend === "down"
                ? text.buyerMarketTrendDown.replace("{change}", String(livePrices[0].change))
                : text.buyerMarketTrendStable
          } · ${liveMarketScopeText}`,
      }
      : null,
    featured[0]
      ? {
        id: `featured-${featured[0].id}`,
        badge: text.buyerMomentBadge,
        title: `${featured[0].name} ${lang === "fr" ? "disponibles depuis" : "biva i"} ${featured[0].province}`,
        subtitle: `${formatBIF(featured[0].price_per_kg)}/${featured[0].unit} · ${text.buyerFreshStock}`,
      }
      : null,
    categories[0]
      ? {
        id: `category-${categories[0].id}`,
        badge: text.buyerActiveRayon,
        title: text.buyerExploreCat.replace("{label}", categories[0].label),
        subtitle: text.buyerExploreCatDesc.replace("{count}", String(categories[0].count)),
      }
      : null,
  ].filter(Boolean) as PromoCard[];

  const displayPromos =
    promoCards.length > 0
      ? promoCards
      : [
        {
          id: "marketplace-live",
          badge: "Marketplace",
          title: lang === "fr" ? "Nouveaux arrivages en temps réel" : "Ivyimuwe ubu nyene bishasha",
          subtitle: lang === "fr" ? "Consultez les catégories et les produits du moment." : "Raba ibicuruza n'ubushobozi buriho ubu.",
        },
      ];

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "legumes": return "🥦";
      case "tubercules": return "🥔";
      case "cereales": return "🌽";
      case "fruits": return "🍌";
      case "export": return "☕";
      default: return "📦";
    }
  };

  return (
    <BuyerLayout title={lang === "fr" ? "Accueil" : "Ikaze"} subtitle={text.buyerWhatOrder}>
      {/* Hero / Greeting */}
      <section className="bg-primary px-4 pt-6 pb-8">
        <p className="text-primary-foreground/70 text-sm">{text.buyerGreeting}</p>
        <h2 className="text-xl font-bold text-primary-foreground mt-1 text-balance">
          {text.buyerWhatOrder}
        </h2>
        {/* Search bar */}
        <Link
          href="/acheteur/recherche"
          className="mt-4 flex items-center gap-3 bg-card rounded-xl px-4 h-11 shadow-sm"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{text.buyerSearchPlaceholder}</span>
        </Link>
      </section>

      {/* Promo banner */}
      <section className="px-4 -mt-3">
        {offlineNotice && (
          <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
            {offlineNotice}
          </div>
        )}

        {ready && user && (!user.province || !user.address) && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Profil incomplet</p>
                <p className="text-[11px] text-amber-800/80 mt-0.5 leading-relaxed">
                  Ajoutez votre adresse et votre province dans les paramètres pour faciliter vos futures livraisons.
                </p>
                <Link href="/acheteur/parametres" className="inline-block mt-2 text-[10px] font-black uppercase text-amber-900 bg-amber-200/50 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                  Compléter maintenant
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {displayPromos.map((p) => (
            <div
              key={p.id}
              className="shrink-0 w-64 bg-card rounded-xl border border-border p-4 space-y-1 shadow-sm"
            >
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] uppercase font-bold tracking-wider">{p.badge}</Badge>
              <p className="text-sm font-bold text-foreground text-balance leading-tight">{p.title}</p>
              <p className="text-[11px] text-muted-foreground">{p.subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 mt-5">
        <h3 className="text-sm font-bold text-foreground mb-3">{text.buyerCategories}</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/acheteur/recherche?cat=${cat.id}`}
              className="shrink-0 flex flex-col items-center gap-1.5 bg-card border border-border rounded-2xl px-4 py-3 min-w-[80px] shadow-sm hover:border-primary/40 transition-colors"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs font-bold text-foreground">{cat.label}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{cat.count} {lang === "fr" ? "items" : "ibintu"}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">{text.buyerFeatured}</h3>
          <Link href="/acheteur/recherche" className="text-xs text-primary font-bold flex items-center gap-1">
            {lang === "fr" ? "Voir tout" : "Raba vyose"} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 flex flex-col items-center py-20 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">{text.dashLoading}</p>
            </div>
          ) : featured.map((product) => (
            <Link
              key={product.id}
              href={`/acheteur/produit/${product.id}`}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all group"
            >
              <div className="h-32 bg-secondary flex items-center justify-center text-4xl relative overflow-hidden">
                {buildImageUrl(product.image_url) ? (
                  <img
                    src={buildImageUrl(product.image_url) ?? undefined}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  getCategoryIcon(product.category)
                )}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full">
                  <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-[9px] font-black text-white">{product.rating}</span>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-xs font-bold text-foreground leading-tight truncate">{product.name}</p>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3 text-primary/60" />
                  <span className="text-[10px] font-medium">
                    {new Date(product.harvested_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI", { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-black text-primary">{formatBIF(product.price_per_kg)}/{product.unit}</span>
                </div>
              </div>
            </Link>
          ))}
          {!loading && products.length === 0 && (
            <div className="col-span-2 text-center py-16 bg-secondary/20 rounded-2xl border border-dashed border-border">
              <p className="text-sm font-bold text-muted-foreground">{text.buyerProdEmpty}</p>
            </div>
          )}
        </div>
      </section>

      {/* Soko Live mini */}
      <section className="px-4 mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <h3 className="text-sm font-bold text-foreground">{text.buyerMarketLive}</h3>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">{liveMarketScopeText}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border/50 overflow-hidden shadow-sm">
          {livePrices.slice(0, 4).map((item) => (
            <div key={`${item.product}-${item.unit}`} className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{item.product}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {getLivePriceConfidenceText(item.confidence_label, lang)} · {getLivePriceFreshnessLabel(item.freshness_minutes, lang)} · {liveMarketScopeText}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-sm font-black text-foreground whitespace-nowrap">
                  {formatBIF(item.price)}/{item.unit}
                </span>
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${item.trend === "up" ? "bg-green-100 text-green-700" : item.trend === "down" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                  {getLivePriceTrendText(item, lang)}
                </span>
              </div>
            </div>
          ))}
          {livePricesLoading && livePrices.length === 0 && (
            <div className="px-5 py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-primary/40" />
              <p>{lang === "fr" ? "Chargement des prix..." : "Turiko turarondera ibiciro..."}</p>
            </div>
          )}
          {!livePricesLoading && livePrices.length === 0 && (
            <div className="px-5 py-6 text-sm text-muted-foreground text-center">{text.buyerMarketEmpty}</div>
          )}
        </div>
      </section>
    </BuyerLayout>
  );
}
