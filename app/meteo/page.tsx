"use client";

import { useEffect, useState } from "react";
import {
  Droplets,
  Wind,
  AlertTriangle,
  Check,
  ChevronRight,
  Info,
  MapPin,
  RefreshCw,
  Sprout,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { useSession } from "@/lib/session";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { LogisticsLayout } from "@/components/logistics/logistics-layout";

const tipIcons = {
  warning: AlertTriangle,
  info: Info,
  success: Check,
  tip: Sprout,
} as const;

export default function MeteoPage() {
  const { lang, text } = useLanguage();
  const { session, ready: sessionReady } = useSession();
  const [weather, setWeather] = useState<any>(null);
  const [tips, setTips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState("Bujumbura");
  const [provinces, setProvinces] = useState<string[]>([]);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const data = await apiFetch("/weather/provinces");
        setProvinces(data);
      } catch (err) {
        console.error("Erreur provinces:", err);
      }
    };
    fetchProvinces();
  }, []);

  const fetchData = async (province: string) => {
    setLoading(true);
    try {
      // Tentative de récupération des données réelles
      const data = await apiFetch(`/weather/forecast?province=${province}`);
      setWeather(data.weather);
      setTips(data.tips);
      
      // Mise en cache pour le mode hors ligne
      localStorage.setItem(`weather_cache_${province}`, JSON.stringify(data));
    } catch (err) {
      console.error("Erreur météo:", err);
      // Mode hors ligne : tenter de lire le cache
      const cached = localStorage.getItem(`weather_cache_${province}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setWeather(parsed.weather);
        setTips(parsed.tips);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedProvince);
  }, [selectedProvince]);

  if (loading || !weather || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Récupération des données agricoles...</p>
      </div>
    );
  }

  const pageTitle = text.weatherTitle;
  const pageSubtitle = `${text.weatherSubtitle} (${weather.city || selectedProvince})`;

  const content = (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Province Selector */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {provinces.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedProvince(p)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold transition-all border shrink-0",
              selectedProvince === p
              ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {p}
          </button>
        ))}
      </div>
      {/* Hero weather card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{weather.city}</p>
            </div>
            <p className="text-5xl font-semibold leading-none tabular-nums text-foreground">{weather.current.temp}°C</p>
            <p className="mt-2 text-base font-medium text-foreground">
              {weather.current.description}
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{weather.current.humidity}% {text.weatherHumidity}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{weather.current.wind_speed} km/h {text.weatherWind}</span>
              </div>
            </div>
          </div>
          <WeatherIcon
            icon={weather.current.icon}
            description={weather.current.description}
            className="h-16 w-16 md:h-20 md:w-20"
          />
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">{text.weatherForecast5Days}</h2>
        <div className="grid grid-cols-5 gap-2">
          {weather.forecast.map((day: any) => (
            <div
              key={day.date}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground mb-2">
                {day.date}
              </span>
              <WeatherIcon icon={day.icon} description={day.desc} className="mb-2 h-7 w-7" />
              <span className="text-sm font-bold text-foreground">
                {day.temp}°
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Agri tips */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{text.weatherTipsTitle}</h2>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {tips.length} {lang === "fr" ? "conseils" : "inama"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tips.map((tip, idx) => {
            const TipIcon = tipIcons[tip.type as keyof typeof tipIcons] || Info;
            const iconTone = tip.type === "warning"
              ? "text-amber-700"
              : tip.type === "success" || tip.type === "tip"
                ? "text-primary"
                : "text-muted-foreground";
            return (
              <div
                key={idx}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <TipIcon className={cn("h-4 w-4 shrink-0", iconTone)} aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">
                    {tip.category}
                  </span>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">
                  {tip.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tip.body}
                </p>
                <button
                  className={cn(
                    "mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:opacity-70 transition-opacity",
                  )}
                >
                  Détails
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );

  // Hybrid layout based on session
  if (session?.role === "fermier") {
    return <DashboardLayout title={pageTitle} subtitle={pageSubtitle}>{content}</DashboardLayout>;
  }
  if (session?.role === "acheteur") {
    return <BuyerLayout title={pageTitle} subtitle={pageSubtitle}>{content}</BuyerLayout>;
  }
  if (session?.role === "logistique") {
    return <LogisticsLayout title={pageTitle} subtitle={pageSubtitle}>{content}</LogisticsLayout>;
  }

  // Public layout
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />
      <main className="flex-1 p-4 md:p-8 bg-background">
        <div className="max-w-4xl mx-auto mb-8">
          <h1 className="text-3xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-muted-foreground mt-2">{pageSubtitle}</p>
        </div>
        {content}
      </main>
      <SiteFooter />
    </div>
  );
}
