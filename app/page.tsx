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
  Globe,
  MessageCircle,
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
  getLivePriceDepthText,
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
  rating: number;
}

interface HeroSlide {
  bg: string;
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
    rating: Number.isFinite(Number(item.rating)) ? Math.max(0, Math.min(5, Number(item.rating))) : 5,
  };
}

const profiles = [
  {
    key: "farmer",
    icon: Sprout,
    titleKey: "roleFarmer" as const,
    labelKey: "farmer" as const,
    subKey: "farmerSub" as const,
    href: getSignupPath("fermier"),
    color: "border-primary bg-primary/5 hover:bg-primary/10",
    iconColor: "text-primary bg-primary/10",
  },
  {
    key: "buyer",
    icon: Package,
    titleKey: "roleBuyer" as const,
    labelKey: "buyer" as const,
    subKey: "buyerSub" as const,
    href: getSignupPath("acheteur"),
    color: "border-accent bg-accent/5 hover:bg-accent/10",
    iconColor: "text-amber-800 bg-accent/20",
  },
  {
    key: "driver",
    icon: Truck,
    titleKey: "roleDriver" as const,
    labelKey: "driver" as const,
    subKey: "driverSub" as const,
    href: getSignupPath("logistique"),
    color: "border-border bg-card hover:bg-secondary/50",
    iconColor: "text-muted-foreground bg-muted",
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
      { bg: "bg-primary/90", label: "Tomates" },
      { bg: "bg-amber-700/90", label: "Café" },
      { bg: "bg-yellow-700/90", label: "Bananes" },
    ]
    : [
      { bg: "bg-primary/90", label: "Inyanya" },
      { bg: "bg-amber-700/90", label: "Ikawa" },
      { bg: "bg-yellow-700/90", label: "Igitoke" },
    ];
  const heroSlides: HeroSlide[] = prices.length > 0
    ? prices.slice(0, 3).map((item, index) => ({
      bg: ["bg-primary/90", "bg-emerald-700/90", "bg-amber-700/90"][index % 3],
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
      heroTestimonialLabel: "Retour terrain",
      heroMetricConfidence: "Confiance",
      heroMetricDepth: "Profondeur",
      heroMetricVolatility: "Volatilité",
      heroMetricScope: "Portée",
      heroMetricRefresh: "Fraîcheur",
      heroMetricSignals: "Signaux",
      heroMetricListings: "Annonces actives",
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
      heroTestimonialLabel: "Ijambo ryo ku murima",
      heroMetricConfidence: "Kwizera",
      heroMetricDepth: "Uburebure bw'isoko",
      heroMetricVolatility: "Ihindagurika",
      heroMetricScope: "Aho rishingiye",
      heroMetricRefresh: "Igihe vyavuguruwe",
      heroMetricSignals: "Ibimenyetso",
      heroMetricListings: "Amatangazo ariho",
    };
  // Uniquement des témoignages réels, validés par un admin — aucun texte de
  // repli : une plateforme sans témoignage n'en affiche simplement aucun.
  const testimonials = testimonialRecords
    .map((item) => normalizeLandingTestimonial(item, lang))
    .filter((item): item is LandingTestimonial => item !== null);
  const activeHeroSlide = heroSlides[Math.min(slide, heroSlides.length - 1)] ?? heroSlides[0];
  const activeMarket = activeHeroSlide?.market;
  const activeTestimonial = testimonials.length > 0 ? testimonials[slide % testimonials.length] : null;
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

  // Auto-advance carousel
  useEffect(() => {
    const id = setInterval(() => setSlide((s: number) => (s + 1) % heroSlides.length), 3500);
    return () => clearInterval(id);
  }, [heroSlides.length]);

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
      <section className="relative overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <Image
            src="/hero-burundi.jpg"
            alt="Collines agricoles du Burundi"
            fill
            className="object-cover"
            priority
          />
          {/* Photos réelles des produits en vitrine, en fondu enchaîné au fil
              du carrousel. Repli sur l'image générique ci-dessus tant qu'un
              slide n'a pas de photo (ex. fallback hors ligne). */}
          {heroSlides.map((s, i) => {
            const photo = buildImageUrl(s.market?.image_url);
            if (!photo) return null;
            return (
              <img
                key={`${s.label}-${i}`}
                src={photo}
                alt={s.label}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
                  i === slide ? "opacity-100" : "opacity-0"
                )}
              />
            );
          })}
          <div className="absolute inset-0 bg-primary/75" />
        </div>

        {/* Carousel tint overlay */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            heroSlides[slide].bg,
            "opacity-30"
          )}
        />

        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28">
          {/* Social proof pill */}
          {socialProofLabel && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {socialProofLabel}
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,420px)] lg:items-end">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight text-balance max-w-2xl mb-6">
                {text.heroTitle}
              </h1>

              <p className="text-white/75 text-base md:text-lg mb-4 max-w-xl">
                {text.slogan}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8 text-xs md:text-sm text-white/80">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                  <Globe className="h-3.5 w-3.5" />
                  {activeMarket
                    ? getLivePriceScopeText(activeMarket.market_scope, activeMarket.market_scope_label, lang)
                    : copy.heroLiveMeta}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {activeMarket ? getLivePriceActionText(activeMarket.recommended_action, lang) : copy.heroLiveTitle}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  asChild
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base px-8 h-13 rounded-2xl shadow-lg"
                >
                  <Link href="/produits">
                    {text.heroCta}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/10 backdrop-blur-md text-white border-white/20 hover:bg-white/20 font-bold text-base px-8 h-13 rounded-2xl shadow-lg"
                  onClick={() => {
                    document.getElementById("profiles")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {text.heroSecondaryCta}
                </Button>
              </div>

              {/* Carousel indicators */}
              <div className="flex items-center gap-2 mt-10">
                {heroSlides.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === slide ? "w-8 bg-accent" : "w-4 bg-white/40"
                    )}
                  />
                ))}
                <span className="ml-2 text-white/70 text-xs font-medium">{activeHeroSlide?.label}</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 md:p-6 text-white backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    {copy.heroLiveBadge}
                  </div>
                  <p className="mt-3 text-lg font-semibold text-white">{heroInsightTitle}</p>
                  <p className="mt-1 text-sm text-white/70">{copy.heroInsight}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/10 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Soko Live</p>
                  <p className="mt-1 text-xs font-medium text-white/80">{activeHeroSlide?.label}</p>
                </div>
              </div>

              {activeMarket ? (
                <>
                  <div className="rounded-3xl bg-black/10 p-5 border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl md:text-3xl font-black tracking-tight text-white">
                          {formatBIF(activeMarket.price)}
                          <span className="ml-1 text-sm font-semibold text-white/70">/{activeMarket.unit}</span>
                        </p>
                        <p className="mt-2 text-sm text-white/70">
                          {getLivePriceActionText(activeMarket.recommended_action, lang)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-emerald-400/10 border border-emerald-300/20 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold text-white/60">{getLivePriceTrendText(activeMarket, lang)}</p>
                        <p className="text-sm font-bold text-white">{activeMarket.product}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="rounded-full bg-white/10 text-white border-white/10 hover:bg-white/10">
                        {getLivePriceConfidenceText(activeMarket.confidence_label, lang)}
                      </Badge>
                      <Badge className="rounded-full bg-white/10 text-white border-white/10 hover:bg-white/10">
                        {getLivePriceVolatilityText(activeMarket.volatility, lang)}
                      </Badge>
                      <Badge className="rounded-full bg-white/10 text-white border-white/10 hover:bg-white/10">
                        {getLivePriceScopeText(activeMarket.market_scope, activeMarket.market_scope_label, lang)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{copy.heroMetricDepth}</p>
                      <p className="mt-1 font-semibold text-white">{getLivePriceDepthText(activeMarket.market_depth, lang)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{copy.heroMetricRefresh}</p>
                      <p className="mt-1 font-semibold text-white">{getLivePriceFreshnessLabel(activeMarket.freshness_minutes, lang)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{copy.heroMetricSignals}</p>
                      <p className="mt-1 font-semibold text-white">{activeMarket.sample_size ?? 0} {copy.signals}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{copy.heroMetricListings}</p>
                      <p className="mt-1 font-semibold text-white">{activeMarket.active_listings ?? 0}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-black/10 p-5 text-sm text-white/75">
                  {pricesLoading ? copy.heroLiveLoading : copy.heroLiveFallback}
                </div>
              )}

              {activeTestimonial && (
                <div className="mt-4 rounded-3xl border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {copy.heroTestimonialLabel}
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/85">
                    “{activeTestimonial.quote}”
                  </p>
                  <p className="mt-2 text-xs font-medium text-white/60">{activeTestimonial.author}</p>
                </div>
              )}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {profiles.map(({ key, icon: Icon, titleKey, labelKey, subKey, href, color, iconColor }) => (
            <Link
              key={key}
              href={href}
              className={cn(
                "group relative flex flex-col gap-5 p-8 rounded-3xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                color
              )}
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300", iconColor)}>
                <Icon className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-foreground tracking-tight">{text[titleKey]}</h3>
                <p className="font-bold text-primary text-sm uppercase tracking-wider">{text[labelKey]}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{text[subKey]}</p>
              </div>
              <div className="flex items-center gap-2 text-primary text-sm font-bold mt-4 pt-4 border-t border-border/50 group-hover:gap-3 transition-all">
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
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Soko Live</span>
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
                className="flex flex-col gap-3 p-4 rounded-2xl bg-secondary/60 border border-border"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{item.product}</span>
                  <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold text-foreground border border-border">
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
          <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center">
            <Phone className="w-6 h-6 text-amber-800" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{text.paymentsTitle}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{text.paymentsSub}</p>
          <div className="flex flex-wrap gap-2 mt-auto">
            {["Lumicash", "EcoCash", "Airtel Money"].map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Traceability */}
        <div className="flex flex-col gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{text.traceTitle}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{text.traceSub}</p>
          {/* Traceability steps */}
          <div className="flex items-center gap-2 mt-auto flex-wrap">
            {([text.step1, text.step2, text.step3] as string[]).map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-xs font-semibold text-primary border border-primary/20">
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Guarantee */}
        <div className="flex flex-col gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-green-700" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{text.landingQualityTitle}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {text.landingQualityDesc}
          </p>
          <div className="flex items-center gap-1.5 mt-auto">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-accent text-accent" />
            ))}
            <span className="text-sm font-semibold text-foreground ml-1">4.8 / 5</span>
          </div>
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
                  const filledStars = Math.max(1, Math.min(5, Math.round(rating || 5)));

                  return (
                    <CarouselItem key={id} className="md:basis-1/2 xl:basis-1/3">
                      <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/15 bg-white/10 p-6">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-4 h-4",
                                i < filledStars ? "fill-accent text-accent" : "text-white/25"
                              )}
                            />
                          ))}
                        </div>
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
