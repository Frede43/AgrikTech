"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudRain, Sun, CloudSun, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";

interface WeatherData {
  location: string;
  current: {
    temp: number;
    condition: string;
    humidity: number;
    wind: number;
  };
  forecast: Array<{
    day: string;
    high: number;
    low: number;
    icon: string;
    rain: number;
  }>;
}

interface AgriTip {
  id: number;
  type: string;
  urgency: "high" | "medium" | "low";
  title: string;
  body: string;
}

const urgencyConfig = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-primary/5 border-primary/20 text-primary",
};

function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  if (icon === "cloud-rain") return <CloudRain className={className} />;
  if (icon === "cloud-sun") return <CloudSun className={className} />;
  return <Sun className={className} />;
}

export function WeatherMini() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [tips, setTips] = useState<AgriTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/stats/weather"),
      apiFetch("/stats/tips"),
    ])
      .then(([weatherData, agriTips]) => {
        setWeather(weatherData);
        setTips(Array.isArray(agriTips) ? agriTips : []);
        setError(null);
      })
      .catch((err: unknown) => {
        logIfNotNetworkError("Weather mini load error", err);
        setError(getDisplayErrorMessage(err, "Impossible de charger la météo live."));
      })
      .finally(() => setLoading(false));
  }, []);

  const topAlert = useMemo(
    () => tips.find((tip) => tip.urgency === "high") || tips[0],
    [tips],
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-foreground">Météo & Alertes</h2>
        <Button asChild variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">
          <Link href="/meteo">Voir plus</Link>
        </Button>
      </div>

      {loading && (
        <div className="py-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Chargement de la météo agricole...</p>
        </div>
      )}

      {!loading && !weather && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {error || "Les données météo ne sont pas disponibles pour le moment."}
        </div>
      )}

      {weather && (
        <>
      {/* Current weather */}
      <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 mb-3">
        <WeatherIcon icon={weather.forecast[0]?.icon || "cloud-sun"} className="w-10 h-10 text-accent-foreground shrink-0" />
        <div>
          <p className="text-2xl font-bold text-foreground leading-none">{weather.current.temp}°C</p>
          <p className="text-xs text-muted-foreground mt-0.5">{weather.current.condition}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {weather.location}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Humidité: {weather.current.humidity}%</p>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="flex gap-1 mb-4">
        {weather.forecast.map((day) => (
          <div
            key={day.day}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-muted/40"
          >
            <span className="text-xs font-medium text-muted-foreground">{day.day}</span>
            <WeatherIcon
              icon={day.icon}
              className={`w-4 h-4 ${day.icon === "cloud-rain" ? "text-blue-500" : day.icon === "cloud-sun" ? "text-amber-500" : "text-yellow-500"}`}
            />
            <span className="text-xs font-bold text-foreground">{day.high}°</span>
            {day.rain > 0 && (
              <span className="text-xs text-blue-500 font-medium">{day.rain}%</span>
            )}
          </div>
        ))}
      </div>

      {/* Top alert */}
      {topAlert && (
        <div className={`border rounded-xl p-3 ${urgencyConfig[topAlert.urgency] || urgencyConfig.low}`}>
          <p className="text-xs font-bold">{topAlert.title}</p>
          <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{topAlert.body}</p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
