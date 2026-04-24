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
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { cn } from "@/lib/utils";

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
  const [weather, setWeather] = useState<any>(null);
  const [tips, setTips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Simulation d'appel API
      setTimeout(() => {
        setWeather({
          location: "Gitega, Burundi",
          current: {
            temp: 24,
            condition: "Ensoleillé",
            humidity: 62,
            wind: 12,
          },
          forecast: [
            { day: "Lun", temp: 25, condition: "Ensoleillé" },
            { day: "Mar", temp: 23, condition: "Nuageux" },
            { day: "Mer", temp: 21, condition: "Pluie" },
            { day: "Jeu", temp: 22, condition: "Partiellement nuageux" },
            { day: "Ven", temp: 24, condition: "Ensoleillé" },
          ],
        });
        setTips([
          {
            id: 1,
            title: "Préparation des semis",
            desc: "Le temps ensoleillé prévu pour les 2 prochains jours est idéal pour préparer vos sols.",
            urgency: "medium",
            category: "Culture",
          },
          {
            id: 2,
            title: "Alerte Pluie Forte",
            desc: "Des averses importantes sont prévues mercredi. Assurez-vous que vos systèmes de drainage sont dégagés.",
            urgency: "high",
            category: "Alerte",
          },
          {
            id: 3,
            title: "Conseil Fertilisation",
            desc: "Appliquez l'engrais après la pluie de mercredi pour une meilleure absorption par les racines.",
            urgency: "low",
            category: "Entretien",
          },
        ]);
        setLoading(false);
      }, 1000);
    };
    fetchData();
  }, []);

  if (loading || !weather) {
    return (
      <DashboardLayout title={loading ? "Chargement..." : text.weatherTitle} subtitle={loading ? "Connexion au satellite météo" : text.weatherSubtitle}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{loading ? "Récupération des données agricoles..." : ""}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={text.weatherTitle}
      subtitle={`${text.weatherSubtitle} (${weather.location})`}
    >
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
              <p className="text-sm opacity-70">{weather.location}</p>
            </div>
            <p className="text-5xl font-bold leading-none">{weather.current.temp}°C</p>
            <p className="text-base mt-2 opacity-85 font-medium">
              {weather.current.condition === "Ensoleillé" ? text.weatherConditionSun :
                weather.current.condition === "Pluie" ? text.weatherConditionRain :
                  weather.current.condition === "Nuageux" ? text.weatherConditionCloudy : weather.current.condition}
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 opacity-70" />
                <span className="text-sm opacity-85">{weather.current.humidity}% {text.weatherHumidity}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 opacity-70" />
                <span className="text-sm opacity-85">{weather.current.wind} km/h {text.weatherWind}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-center min-w-[120px]">
            {weatherIcons[weather.current.condition] || <CloudSun className="w-12 h-12" />}
          </div>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">{text.weatherForecast5Days}</h2>
        <div className="grid grid-cols-5 gap-2">
          {weather.forecast.map((day: any) => (
            <div
              key={day.day}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground mb-2">
                {day.day}
              </span>
              <div className="w-8 h-8 flex items-center justify-center mb-2">
                {weatherIcons[day.condition] ? (
                  // Clone default icon but smaller
                  <div className="scale-50">{weatherIcons[day.condition]}</div>
                ) : (
                  <CloudSun className="w-4 h-4 text-slate-400" />
                )}
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
          {tips.map((tip) => {
            const config = (urgencyConfig as any)[tip.urgency] || urgencyConfig.low;
            return (
              <div
                key={tip.id}
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
                  {tip.desc}
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

      <div className="p-4 rounded-2xl bg-secondary/50 border border-border flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-border">
          <Wind className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">{text.weatherOfflineNote}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {text.weatherOfflineBody}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
