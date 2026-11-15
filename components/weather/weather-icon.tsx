import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WeatherIconProps {
  icon?: string | null;
  description?: string;
  className?: string;
}

export function WeatherIcon({ icon, description = "", className }: WeatherIconProps) {
  const code = (icon ?? "").toLowerCase();
  const condition = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const prefix = code.slice(0, 2);
  const night = code.endsWith("n");

  const Icon = prefix === "01"
    ? night ? Moon : Sun
    : prefix === "02"
      ? night ? CloudMoon : CloudSun
      : prefix === "03" || prefix === "04"
        ? Cloud
        : prefix === "09"
          ? CloudDrizzle
          : prefix === "10"
            ? CloudRain
            : prefix === "11"
              ? CloudLightning
              : prefix === "13"
                ? CloudSnow
                : prefix === "50"
                  ? CloudFog
                  : code === "cloud-rain"
                    ? CloudRain
                    : code === "cloud-sun"
                      ? CloudSun
                      : code === "sun"
                        ? Sun
                        : condition.includes("orage")
                          ? CloudLightning
                          : condition.includes("neige") || condition.includes("grezil")
                            ? CloudSnow
                            : condition.includes("brouillard")
                              ? CloudFog
                              : condition.includes("bruine")
                                ? CloudDrizzle
                                : condition.includes("pluie") || condition.includes("averse")
                                  ? CloudRain
                                  : condition.includes("nuage") || condition.includes("couvert")
                                    ? Cloud
                                    : Sun;

  const tone = prefix === "01" || prefix === "02" || condition.includes("soleil")
    ? "text-amber-600"
    : ["09", "10", "13"].includes(prefix) || condition.includes("pluie") || condition.includes("averse")
      ? "text-sky-700"
      : prefix === "11" || condition.includes("orage")
        ? "text-slate-700"
        : "text-muted-foreground";

  return (
    <Icon
      className={cn("shrink-0", tone, className)}
      aria-label={description || "Conditions météo"}
      role="img"
    />
  );
}
