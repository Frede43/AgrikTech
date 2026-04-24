"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Star, Clock, Leaf, Loader2, RefreshCw } from "lucide-react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBIF } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { apiFetch, API_BASE_URL } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { logIfNotNetworkError } from "@/lib/offline";

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

export default function RecherchePage() {
  const { lang, text } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const filterOptions = useMemo(() => [
    { id: "all", label: text.searchFilterAll },
    { id: "bio", label: text.searchFilterBio },
    { id: "today", label: text.searchFilterToday },
    { id: "available", label: text.searchFilterAvailable },
    { id: "low-price", label: text.searchFilterLowPrice },
  ], [text]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let endpoint = "/products/";
        if (activeCategory !== "all") {
          endpoint += `?category=${activeCategory}`;
        }

        const [pData, cData] = await Promise.all([
          apiFetch(endpoint),
          apiFetch("/categories")
        ]);

        setProducts(pData);
        setCategories(cData);
      } catch (err) {
        logIfNotNetworkError("Search fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeCategory]);

  const filtered = products.filter((p) => {
    const matchQuery = query === "" || p.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "available" && p.quantity_kg > 0) ||
      (activeFilter === "low-price" && p.price_per_kg < 2500);
    return matchQuery && matchFilter;
  });

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
    <BuyerLayout title={text.searchTitle} subtitle={text.searchSubtitle}>
      {/* Search bar */}
      <div className="sticky top-14 z-10 bg-background/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-border space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={text.searchPlaceholder}
            className="pl-10 h-11 rounded-2xl border-input bg-card shadow-sm"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn("shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all", activeCategory === "all" ? "bg-primary text-white border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:border-primary/40")}
          >
            {text.searchFilterAll}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn("shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all", activeCategory === cat.id ? "bg-primary text-white border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:border-primary/40")}
            >
              <span className="text-sm">{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
          <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn("shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all", activeFilter === f.id ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-4 min-h-[60vh]">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
            {loading ? (lang === "fr" ? "Recherche..." : "Turiko turarondera...") : text.searchResults.replace("{count}", String(filtered.length))}
          </p>
          {!loading && filtered.length > 0 && (
            <div className="h-[1px] flex-1 bg-border/50 ml-4" />
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground">{lang === "fr" ? "Recherche en cours..." : "Turiko turarondera..."}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4 bg-secondary/10 rounded-3xl border border-dashed border-border/50">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
              <Leaf className="w-10 h-10 text-muted-foreground/20" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-foreground">{text.searchNone}</p>
              <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">{text.searchNoneDesc}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((product) => (
              <Link
                key={product.id}
                href={`/acheteur/produit/${product.id}`}
                className="flex gap-4 bg-card border border-border rounded-2xl p-4 hover:shadow-lg hover:border-primary/20 transition-all group shadow-sm"
              >
                <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center text-4xl shrink-0 overflow-hidden relative shadow-inner">
                  {product.image_url ? (
                    <img
                      src={`${API_BASE_URL}${product.image_url}`}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    getCategoryIcon(product.category)
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex-1 min-w-0 space-y-2 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{product.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-secondary text-muted-foreground hover:bg-secondary text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border-0">{product.province}</Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3 text-primary/40" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">
                        {new Date(product.harvested_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI", { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-base font-black text-primary tracking-tight">{formatBIF(product.price_per_kg)}/{product.unit}</span>
                    <div className="flex items-center gap-1 bg-yellow-400/10 px-2 py-1 rounded-lg">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-black text-yellow-700">{product.rating}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
}
