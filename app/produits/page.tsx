"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Leaf, Loader2, MapPin, Search, SlidersHorizontal, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, buildImageUrl, getLoginPath, getSignupPath } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { loadCachedCatalogue, logIfNotNetworkError, saveCachedCatalogue, useOnlineStatus } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/LanguageContext";

interface Product {
  id: number;
  name: string;
  category: string;
  price_per_kg: number;
  unit: string;
  quantity_kg: number;
  province: string;
  image_url: string | null;
}

interface Category {
  id: string;
  label: string;
  icon: string;
}

export default function ProductsPage() {
  const { lang, text } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");
  const isOnline = useOnlineStatus();

  const filters = [
    { id: "Tous", label: text.pubCatFilterAll || "Tout" },
    { id: "Disponible", label: text.pubCatFilterAvailable || "Disponible" },
    { id: "Prix bas", label: text.pubCatFilterLowPrice || "Prix bas" }
  ];

  useEffect(() => {
    const fetchCatalogue = async () => {
      const cacheScope = `public-products:${activeCategory}`;
      const cachedCatalogue = loadCachedCatalogue<Product, Category>(cacheScope);

      if (cachedCatalogue) {
        setProducts(cachedCatalogue.products);
        setCategories(cachedCatalogue.categories);
        setLoading(false);
      } else {
        setLoading(true);
      }

      if (!isOnline) {
        setOfflineNotice(cachedCatalogue ? text.catalogueOfflineNotice : text.catalogueOfflineEmpty);
        return;
      }

      try {
        const endpoint = activeCategory === "all" ? "/products/" : `/products/?category=${activeCategory}`;
        const [productData, categoryData] = await Promise.all([
          apiFetch(endpoint),
          apiFetch("/categories"),
        ]);
        const nextProducts = productData as Product[];
        const nextCategories = categoryData as Category[];
        setProducts(nextProducts);
        setCategories(nextCategories);
        saveCachedCatalogue(cacheScope, {
          products: nextProducts,
          categories: nextCategories,
          savedAt: new Date().toISOString(),
        });
        setOfflineNotice("");
      } catch (error) {
        logIfNotNetworkError("Failed to load public catalogue", error);
        setOfflineNotice(cachedCatalogue ? text.catalogueOfflineNotice : text.catalogueOfflineEmpty);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogue();
  }, [activeCategory, isOnline, text.catalogueOfflineEmpty, text.catalogueOfflineNotice]);

  const filteredProducts = products.filter((product) => {
    const matchQuery = query === "" || product.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter =
      activeFilter === "Tous" ||
      (activeFilter === "Disponible" && product.quantity_kg > 0) ||
      (activeFilter === "Prix bas" && product.price_per_kg < 2500);
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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="bg-gradient-to-b from-primary/10 to-background border-b border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20 lg:py-24">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary mb-6">
                  <Leaf className="w-3.5 h-3.5" />
                  {text.pubCatTitle}
                </p>
                <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl lg:text-6xl text-balance leading-[1.1]">
                  {text.pubCatHeading}
                </h1>
                <p className="mt-6 text-base font-medium text-muted-foreground md:text-lg text-pretty leading-relaxed">
                  {text.pubCatDesc}
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-2xl group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={text.pubCatSearch}
                  className="h-14 w-full rounded-2xl border-border bg-card pl-12 pr-4 shadow-sm text-base font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <Button asChild className="h-14 rounded-2xl px-8 font-bold text-base shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all bg-foreground text-white hover:bg-foreground/90 shrink-0">
                <Link href={getSignupPath("fermier")}>{text.pubCatSell}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
          {offlineNotice && (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
              {offlineNotice}
            </div>
          )}

          {/* Categories and Filters */}
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300",
                  activeCategory === "all"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                    : "bg-card border border-border text-muted-foreground hover:bg-secondary/80 hover:border-primary/30"
                )}
              >
                {text.pubCatFilterAll}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300 flex items-center gap-2",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                      : "bg-card border border-border text-muted-foreground hover:bg-secondary/80 hover:border-primary/30"
                  )}
                >
                  <span className={cn("text-base", activeCategory === category.id ? "opacity-100" : "grayscale opacity-70")}>{category.icon}</span>
                  {category.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 pr-2 border-r border-border mr-2 text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline-block">Filtres</span>
              </div>
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all",
                    activeFilter === filter.id
                      ? "border-accent bg-accent/10 text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-8 mb-6 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {loading
                ? text.pubCatLoadingCat
                : text.pubCatCount.replace("{count}", filteredProducts.length.toString()).replace("{s}", filteredProducts.length > 1 ? "s" : "")
              }
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-32 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-bold uppercase tracking-widest">{text.pubCatLoadingProd}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-5 py-32 text-center text-muted-foreground bg-secondary/20 rounded-3xl border border-dashed border-border">
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center shadow-sm">
                <Leaf className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="max-w-md">
                <p className="font-bold text-lg text-foreground mb-2">{text.pubCatEmpty}</p>
                <p className="text-sm text-balance leading-relaxed">{text.pubCatEmptyDesc}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const imageUrl = buildImageUrl(product.image_url);
                return (
                  <Link
                    key={product.id}
                    href={`/produits/${product.id}`}
                    className="group overflow-hidden rounded-[2rem] border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 flex flex-col"
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-secondary w-full">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="text-6xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
                          {getCategoryIcon(product.category)}
                        </div>
                      )}

                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                      {/* Price badge floating */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10">
                        <span className="bg-primary text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                          Aperçu
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-black text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors line-clamp-2">
                          {product.name}
                        </h2>
                      </div>

                      <div className="mt-auto pt-2 space-y-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span className="truncate">{product.province}</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-muted-foreground flex items-center justify-between">
                            <span>Stock</span>
                            <span className="text-foreground">{product.quantity_kg} {product.unit}</span>
                          </span>

                          <div className="flex items-baseline justify-between pt-2 border-t border-border/50">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-foreground tracking-tight">{formatBIF(product.price_per_kg)}</span>
                              <span className="text-xs font-bold text-muted-foreground uppercase opacity-70">/{product.unit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Call to action at bottom */}
        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <div className="relative overflow-hidden rounded-[3rem] bg-card border border-border shadow-sm p-8 md:p-12 lg:p-16 text-center lg:text-left flex flex-col lg:flex-row items-center gap-10">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />

            <div className="flex-1 relative z-10 space-y-4 max-w-2xl">
              <h2 className="text-3xl lg:text-4xl font-black text-foreground tracking-tight text-balance leading-tight">
                {text.pubCatReady}
              </h2>
              <p className="text-base text-muted-foreground text-pretty font-medium leading-relaxed">
                {text.pubCatReadyDesc}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto relative z-10 shrink-0">
              <Button asChild className="h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">
                <Link href={getSignupPath("acheteur")}>{text.pubCatCreateBuyer}</Link>
              </Button>
              <Button asChild variant="outline" className="h-14 px-8 rounded-2xl font-bold text-sm uppercase tracking-widest border-2 hover:bg-secondary/80 transition-all whitespace-nowrap">
                <Link href={getLoginPath("acheteur")}>{text.pubCatLoginBuyer}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}