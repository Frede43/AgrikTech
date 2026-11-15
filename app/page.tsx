"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Leaf,
  TrendingUp,
  Truck,
  ShieldCheck,
  Clock3,
  ArrowRight,
  ChevronRight,
  Star,
  Sprout,
  Package,
  MapPin,
  Phone,
  Mail,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getLivePriceActionText,
  getLivePriceConfidenceText,
  getLivePriceFreshnessLabel,
  getLivePriceScopeText,
  getLivePriceTrendText,
  getLivePriceVolatilityText,
  type LivePrice,
  useLivePrices,
} from "@/lib/live-market";
import { formatBIF } from "@/lib/currency";
import { apiFetch, buildImageUrl, getLoginPath, getSignupPath } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/LanguageContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface PublicTestimonial {
  id: number;
  quote_fr: string;
  quote_ki: string;
  author_name: string;
  author_role_fr: string;
  author_role_ki: string;
  location?: string | null;
  rating?: number;
}

interface LandingTestimonial {
  id: string;
  quote: string;
  author: string;
  rating: number | null;
}

interface HeroSlide {
  label: string;
  market?: LivePrice;
}

function normalizeLandingTestimonial(item: PublicTestimonial, lang: "fr" | "ki"): LandingTestimonial | null {
  const quote = (lang === "ki" ? item.quote_ki : item.quote_fr) || item.quote_fr || item.quote_ki;
  const role = (lang === "ki" ? item.author_role_ki : item.author_role_fr) || item.author_role_fr || item.author_role_ki;
  const location = (item.location || "").trim();
  const authorName = (item.author_name || "").trim();

  if (!quote || !role || !authorName) return null;

  return {
    id: String(item.id),
    quote,
    author: location ? `${authorName} — ${role}, ${location}` : `${authorName} — ${role}`,
    rating: item.rating != null && Number.isFinite(Number(item.rating))
      ? Math.max(0, Math.min(5, Number(item.rating)))
      : null,
  };
}

const profiles = [
  {
    key: "farmer",
    icon: Sprout,
    titleKey: "roleFarmer" as const,
    subKey: "farmerSub" as const,
    href: getSignupPath("fermier"),
    color: "border-border bg-card hover:border-primary/40",
    iconColor: "text-primary",
  },
  {
    key: "buyer",
    icon: Package,
    titleKey: "roleBuyer" as const,
    subKey: "buyerSub" as const,
    href: getSignupPath("acheteur"),
    color: "border-border bg-card hover:border-primary/40",
    iconColor: "text-primary",
  },
  {
    key: "driver",
    icon: Truck,
    titleKey: "roleDriver" as const,
    subKey: "driverSub" as const,
    href: getSignupPath("logistique"),
    color: "border-border bg-card hover:border-primary/40",
    iconColor: "text-muted-foreground",
  },
];

export default function LandingPage() {
  const { lang, text } = useLanguage();
  const [slide, setSlide] = useState(0);
  const [testimonialRecords, setTestimonialRecords] = useState<PublicTestimonial[]>([]);
  const [publicStats, setPublicStats] = useState<{ farmer_count: number; province_count: number } | null>(null);
  const { prices, loading: pricesLoading } = useLivePrices();
  const fallbackHeroSlides: HeroSlide[] = lang === "fr"
    ? [
      { label: "Tomates" },
      { label: "Café" },
      { label: "Bananes" },
    ]
    : [
      { label: "Inyanya" },
      { label: "Ikawa" },
      { label: "Igitoke" },
    ];
  const heroSlides: HeroSlide[] = prices.length > 0
    ? prices.slice(0, 3).map((item) => ({
      label: item.product,
      market: item,
    }))
    : fallbackHeroSlides;
  const copy = lang === "fr"
    ? {
      perUnit: "par",
      signals: "signaux",
      heroLiveBadge: "Signal marché en direct",
      heroLiveTitle: "Soko Live en vitrine",
      heroLiveLoading: "Connexion au marché en cours...",
      heroLiveFallback: "Le marché national se synchronise. Revenez dans quelques instants pour voir les meilleurs signaux produits.",
      heroLiveMeta: "piloté par les transactions et annonces actives",
      heroLiveProducts: "produits suivis",
      heroInsight: "Lecture marché",
      heroInsightUp: "Tendance haussière confirmée",
      heroInsightDown: "Fenêtre d'achat détectée",
      heroInsightStable: "Marché sous contrôle",
      heroMetricConfidence: "Confiance",
      heroMetricVolatility: "Volatilité",
      heroMetricScope: "Portée",
      heroMetricRefresh: "Fraîcheur",
      heroMetricSignals: "Signaux",
    }
    : {
      perUnit: "ku",
      signals: "ibimenyetso",
      heroLiveBadge: "Ikimenyetso c'isoko ubona ubu",
      heroLiveTitle: "Soko Live imbere",
      heroLiveLoading: "Turacahuza n'isoko...",
      heroLiveFallback: "Isoko ry'igihugu ririko rirahuza. Garuka mu kanya urabe ibimenyetso vyiza vy'ibiciro.",
      heroLiveMeta: "bivuye ku bikorwa n'ibicuruzwa biri ku rubuga",
      heroLiveProducts: "ibicuruzwa bikurikiranwa",
      heroInsight: "Incamake y'isoko",
      heroInsightUp: "Iduga ryemejwe",
      heroInsightDown: "Hari akaryo keza ko kugura",
      heroInsightStable: "Isoko riri ku rugero rwiza",
      heroMetricConfidence: "Kwizera",
      heroMetricVolatility: "Ihindagurika",
      heroMetricScope: "Aho rishingiye",
      heroMetricRefresh: "Igihe vyavuguruwe",
      heroMetricSignals: "Ibimenyetso",
    };
  // Uniquement des témoignages réels, validés par un admin — aucun texte de
  // repli : une plateforme sans témoignage n'en affiche simplement aucun.
  const testimonials = testimonialRecords
    .map((item) => normalizeLandingTestimonial(item, lang))
    .filter((item): item is LandingTestimonial => item !== null);
  const activeHeroSlide = heroSlides[Math.min(slide, heroSlides.length - 1)] ?? heroSlides[0];
  const activeMarket = activeHeroSlide?.market;
  const heroInsightTitle = activeMarket
    ? activeMarket.trend === "up"
      ? copy.heroInsightUp
      : activeMarket.trend === "down"
        ? copy.heroInsightDown
        : copy.heroInsightStable
    : copy.heroLiveTitle;
  // Pas de repli avec des chiffres inventés (1200 fermiers / 9 provinces) : sur
  // une plateforme encore jeune, ça affichait un nombre flatteur puis un flash
  // vers le vrai chiffre une fois /stats/public résolu — visible et malhonnête.
  // On n'affiche donc rien tant que le vrai compte n'est pas connu.
  const socialProofLabel = publicStats
    ? text.socialProof
        .replace("{count}", publicStats.farmer_count.toLocaleString())
        .replace("{provinces}", String(publicStats.province_count))
      + (activeMarket ? ` · ${prices.length} ${copy.heroLiveProducts}` : "")
    : null;

  useEffect(() => {
    if (slide >= heroSlides.length) {
      setSlide(0);
    }
  }, [slide, heroSlides.length]);

  useEffect(() => {
    let active = true;

    const loadTestimonials = async () => {
      try {
        const payload = await apiFetch("/testimonials", { cache: "no-store" }) as PublicTestimonial[];
        if (active && Array.isArray(payload)) {
          setTestimonialRecords(payload);
        }
      } catch {
        // Fallback silencieux sur les textes locaux du home.
      }
    };

    loadTestimonials();
    
    // Load public stats
    apiFetch("/stats/public")
      .then(data => {
        if (active && data && typeof data.farmer_count === "number") {
          setPublicStats(data);
        }
      })
      .catch(() => { /* Silent fallback */ });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <SiteHeader />

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
          <div className="max-w-xl">
            <p className="mb-5 text-sm font-medium text-primary">
              {socialProofLabel || copy.heroLiveMeta}
            </p>
            <h1 className="font-display text-4xl leading-[1.04] text-foreground text-balance md:text-6xl">
              {text.heroTitle}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
              {text.slogan}
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              {activeMarket
                ? getLivePriceScopeText(activeMarket.market_scope, activeMarket.market_scope_label, lang)
                : copy.heroLiveMeta}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-lg px-5 font-medium">
                <Link href="/produits">
                  {text.heroCta}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-lg border-border px-5 font-medium"
                onClick={() => document.getElementById("profiles")?.scrollIntoView({ behavior: "smooth" })}
              >
                {text.heroSecondaryCta}
              </Button>
            </div>
          </div>

          <div className="relative min-w-0">
            <div className="relative aspect-[5/4] overflow-hidden rounded-xl border border-border bg-secondary">
              {buildImageUrl(activeMarket?.image_url) ? (
                <img
                  src={buildImageUrl(activeMarket?.image_url) ?? undefined}
                  alt={activeMarket?.product ?? "Produit agricole du Burundi"}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src="/hero-burundi.jpg"
                  alt="Cultures en terrasses sur les collines du Burundi"
                  fill
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  className="object-cover"
                  priority
                />
              )}
              <span className="absolute left-4 top-4 rounded-md bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground">
                Burundi
              </span>
            </div>

            <div className="relative mx-3 -mt-16 rounded-xl border border-border bg-card p-4 shadow-[0_12px_32px_rgba(39,35,24,0.12)] sm:mx-6 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {copy.heroLiveBadge}
                  </div>
                  {activeMarket ? (
                    <>
                      <h2 className="mt-3 text-lg font-semibold text-foreground">{activeMarket.product}</h2>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                        {formatBIF(activeMarket.price)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">/{activeMarket.unit}</span>
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {getLivePriceActionText(activeMarket.recommended_action, lang)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                      {pricesLoading ? copy.heroLiveLoading : copy.heroLiveFallback}
                    </p>
                  )}
                </div>
                {activeMarket && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{copy.heroInsight}</p>
                    <p className="mt-1 max-w-32 text-sm font-medium text-foreground">{heroInsightTitle}</p>
                  </div>
                )}
              </div>

              {activeMarket && (
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-xs sm:grid-cols-4">
                  <div><p className="text-muted-foreground">{copy.heroMetricConfidence}</p><p className="mt-1 font-medium text-foreground">{getLivePriceConfidenceText(activeMarket.confidence_label, lang)}</p></div>
                  <div><p className="text-muted-foreground">{copy.heroMetricVolatility}</p><p className="mt-1 font-medium text-foreground">{getLivePriceVolatilityText(activeMarket.volatility, lang)}</p></div>
                  <div><p className="text-muted-foreground">{copy.heroMetricRefresh}</p><p className="mt-1 font-medium text-foreground">{getLivePriceFreshnessLabel(activeMarket.freshness_minutes, lang)}</p></div>
                  <div><p className="text-muted-foreground">{copy.heroMetricSignals}</p><p className="mt-1 font-medium tabular-nums text-foreground">{activeMarket.sample_size ?? 0} {copy.signals}</p></div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {activeMarket ? getLivePriceTrendText(activeMarket, lang) : activeHeroSlide?.label}
                </span>
                <div className="flex items-center gap-1.5" aria-label={lang === "fr" ? "Choisir un prix" : "Hitamwo igiciro"}>
                  {heroSlides.map((item, index) => (
                    <button
                      key={`${item.label}-${index}`}
                      type="button"
                      aria-label={item.label}
                      aria-pressed={index === slide}
                      onClick={() => setSlide(index)}
                      className={cn(
                        "h-2 w-2 rounded-full border border-primary transition-colors",
                        index === slide ? "bg-primary" : "bg-transparent hover:bg-primary/30"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROFILE SELECTION ──────────────────────────────────── */}
      <section id="profiles" className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-balance">{text.whoTitle}</h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">{text.whoSub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {profiles.map(({ key, icon: Icon, titleKey, subKey, href, color, iconColor }) => (
            <Link
              key={key}
              href={href}
              className={cn(
                "group relative flex flex-col gap-4 rounded-xl border p-5 transition-colors duration-150",
                color
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-5 w-5 shrink-0", iconColor)} aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground">{text[titleKey]}</h3>
              </div>
              <p className="min-h-10 text-sm leading-6 text-muted-foreground">{text[subKey]}</p>
              <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-sm font-medium text-primary">
                {text.landingRegisterAs.replace("{role}", text[titleKey])}
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {text.adminTitle}
            </div>
            <p className="text-sm text-muted-foreground">{text.adminSub}</p>
          </div>
          <Button asChild variant="outline" className="md:shrink-0">
            <Link href={getLoginPath("admin")}>{text.adminCta}</Link>
          </Button>
        </div>
      </section>

      {/* ── LIVE PRICES ────────────────────────────────────────── */}
      <section className="bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs font-medium text-primary">Soko Live</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">{text.pricesTitle}</h2>
              <p className="text-muted-foreground text-sm mt-1">{text.pricesSub}</p>
            </div>
            <Link href="/produits" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              {text.catalogCta} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {prices.slice(0, 4).map((item) => (
              <div
                key={`${item.product}-${item.unit}`}
                className="flex flex-col gap-3 border-t border-border py-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{item.product}</span>
                  <span className="text-xs text-muted-foreground">
                    {getLivePriceConfidenceText(item.confidence_label, lang)}
                  </span>
                </div>
                <p className="text-xl font-bold text-primary">
                  {formatBIF(item.price)}
                </p>
                <p className="text-xs text-muted-foreground">{copy.perUnit} {item.unit}</p>
                <div className="flex items-center gap-2 text-xs">
                  <TrendingUp
                    className={cn(
                      "w-4 h-4",
                      item.trend === "up"
                        ? "text-green-500"
                        : item.trend === "down"
                          ? "text-destructive rotate-180"
                          : "text-muted-foreground"
                    )}
                  />
                  <p className={cn(
                    "text-xs font-medium",
                    item.trend === "up"
                      ? "text-green-600"
                      : item.trend === "down"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  )}>
                    {getLivePriceTrendText(item, lang)}
                  </p>
                </div>
                <p className="text-[11px] text-foreground/80">{getLivePriceActionText(item.recommended_action, lang)}</p>
                <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    {getLivePriceFreshnessLabel(item.freshness_minutes, lang)}
                  </span>
                  <span>{item.sample_size ?? 0} {copy.signals}</span>
                </div>
              </div>
            ))}
            {pricesLoading && prices.length === 0 && (
              <div className="col-span-2 md:col-span-4 rounded-2xl border border-border bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
                {text.landingMarketLoading}
              </div>
            )}
            {!pricesLoading && prices.length === 0 && (
              <div className="col-span-2 md:col-span-4 rounded-2xl border border-border bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
                {text.landingMarketEmpty}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── REASSURANCE ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Payment */}
        <div className="flex flex-col gap-4">
          <div className="w-8 h-8 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{text.paymentsTitle}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{text.paymentsSub}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-auto text-xs text-muted-foreground">
            {["Lumicash", "EcoCash", "Airtel Money"].map((name) => (
              <span
                key={name}
                className="border-b border-border pb-1 font-medium text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Traceability */}
        <div className="flex flex-col gap-4">
          <div className="w-8 h-8 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{text.traceTitle}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{text.traceSub}</p>
          {/* Traceability steps */}
          <div className="flex items-center gap-2 mt-auto flex-wrap text-sm">
            {([text.step1, text.step2, text.step3] as string[]).map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>

        {/* Guarantee */}
        <div className="flex flex-col gap-4">
          <div className="w-8 h-8 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{text.landingQualityTitle}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {text.landingQualityDesc}
          </p>
          {testimonials.length > 0 && (
            <p className="mt-auto text-sm font-medium text-primary">
              {lang === "fr" ? "Témoignages publiés après validation" : "Ivyagiriza vyemejwe"}
            </p>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────── */}
      {/* Section masquée tant qu'aucun témoignage réel n'est validé : pas de
          repli statique, tout est dynamique. */}
      {testimonials.length > 0 && (
      <section className="bg-primary">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit bg-white/10 text-white border-white/15 hover:bg-white/10">
                {lang === "fr" ? "Témoignages vérifiés" : "Ukwemezwa kw'abakoresha"}
              </Badge>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
                  {lang === "fr" ? "Ils utilisent AgriConnect au quotidien" : "Bakoresha AgriConnect buri munsi"}
                </h2>
                <p className="max-w-2xl text-sm md:text-base text-white/70">
                  {lang === "fr"
                    ? "Des retours publiés après validation admin, affichés dans un slider plus lisible sur mobile comme sur desktop."
                    : "Ubutumwa bwemejwe n'ubuyobozi, bugaragazwa mu slider yoroshye gusoma kuri mobile no kuri desktop."}
                </p>
              </div>
            </div>
          </div>

          <div className="px-2 md:px-10">
            <Carousel
              opts={{ align: "start", loop: testimonials.length > 1 }}
              className="w-full"
            >
              <CarouselContent>
                {testimonials.map(({ id, quote, author, rating }) => {
                  const filledStars = rating === null ? 0 : Math.max(0, Math.min(5, Math.round(rating)));

                  return (
                    <CarouselItem key={id} className="md:basis-1/2 xl:basis-1/3">
                      <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/15 bg-white/10 p-6">
                        {rating !== null && (
                          <div className="flex gap-0.5" aria-label={`${rating} / 5`}>
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                aria-hidden="true"
                                className={cn(
                                  "w-4 h-4",
                                  i < filledStars ? "fill-accent text-accent" : "text-white/25"
                                )}
                              />
                            ))}
                          </div>
                        )}
                        <p className="flex-1 text-white/90 text-base leading-relaxed">{'"'}{quote}{'"'}</p>
                        <p className="text-white/50 text-sm font-medium">— {author}</p>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>

              {testimonials.length > 1 && (
                <>
                  <CarouselPrevious className="left-0 border-white/20 bg-white/10 text-white hover:bg-white/20 md:-left-4" />
                  <CarouselNext className="right-0 border-white/20 bg-white/10 text-white hover:bg-white/20 md:-right-4" />
                </>
              )}
            </Carousel>
          </div>
        </div>
      </section>
      )}

      <SiteFooter />
    </div>
  );
}
