"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudSun,
  CloudRain,
  Sun,
  Droplets,
  Wind,
  Thermometer,
  Calendar,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Bell,
  RefreshCw,
  Globe,
} from "lucide-react";
import { t, Lang } from "@/lib/translations";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { useSession } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { LogisticsLayout } from "@/components/logistics/logistics-layout";

const urgencyConfig = {
  high: {
    bg: "bg-red-50",
    border: "border-red-100",
    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
    text: "text-red-700",
  },
  medium: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    icon: <Bell className="w-5 h-5 text-amber-500" />,
    text: "text-amber-700",
  },
  low: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
    text: "text-blue-700",
  },
};

const weatherIcons: Record<string, any> = {
  Ensoleillé: <Sun className="w-12 h-12 text-yellow-400" />,
  "Ciel dégagé": <Sun className="w-12 h-12 text-yellow-400" />,
  Nuageux: <Cloud className="w-12 h-12 text-slate-400" />,
  "Partiellement nuageux": <CloudSun className="w-12 h-12 text-slate-400" />,
  Pluie: <CloudRain className="w-12 h-12 text-blue-400" />,
  Orage: <CloudRain className="w-12 h-12 text-purple-400" />,
};

export default function MeteoPage() {
  const { lang, setLang, text } = useLanguage();
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
                ? "bg-primary text-white border-primary shadow-md"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {p}
          </button>
        ))}
      </div>
      {/* Hero weather card */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="w-5 h-5 text-yellow-300" />
              <p className="text-sm opacity-70">{weather.city}</p>
            </div>
            <p className="text-5xl font-bold leading-none">{weather.current.temp}°C</p>
            <p className="text-base mt-2 opacity-85 font-medium">
              {weather.current.description}
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 opacity-70" />
                <span className="text-sm opacity-85">{weather.current.humidity}% {text.weatherHumidity}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 opacity-70" />
                <span className="text-sm opacity-85">{weather.current.wind_speed} km/h {text.weatherWind}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-center min-w-[120px]">
            {weatherIcons[weather.current.description] || (
              <img 
                src={`https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`} 
                alt="weather" 
                className="w-16 h-16"
              />
            )}
          </div>
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
              <div className="w-8 h-8 flex items-center justify-center mb-2">
                <img 
                  src={`https://openweathermap.org/img/wn/${day.icon}.png`} 
                  alt="forecast" 
                  className="w-8 h-8"
                  title={day.desc}
                />
              </div>
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
            const config = (urgencyConfig as any)[tip.type] || urgencyConfig.low;
            return (
              <div
                key={idx}
                className={cn(
                  "p-4 rounded-2xl border transition-all hover:shadow-sm",
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  {config.icon}
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/50",
                      config.text
                    )}
                  >
                    {tip.category}
                  </span>
                </div>
                <h3 className={cn("text-sm font-bold mb-1", config.text)}>
                  {tip.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tip.body}
                </p>
                <button
                  className={cn(
                    "mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity",
                    config.text
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
