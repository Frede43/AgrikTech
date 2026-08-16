"use client";

import { useEffect, useState } from "react";
import { MinistereLayout } from "@/components/ministere-agriculture/ministere-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, MapPin, Package, Sprout, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

interface AgricultureStats {
  farmer_count: number;
  province_count: number;
  provinces: string[];
  active_listings: number;
  production_by_province_kg: { province: string; quantity_kg: number }[];
  production_by_category_kg: { category: string; quantity_kg: number }[];
  market_prices: { product: string; price: number; unit: string; trend: string }[];
}

export default function MinistereAgriculturePage() {
  const { lang } = useLanguage();
  const [stats, setStats] = useState<AgricultureStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/stats/agriculture")
      .then((data) => {
        if (active) setStats(data as AgricultureStats);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError(lang === "fr" ? "Impossible de charger les statistiques." : "Ntivyashobotse gushira imibare.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lang]);

  const maxProvinceQty = stats ? Math.max(1, ...stats.production_by_province_kg.map((p) => p.quantity_kg)) : 1;
  const maxCategoryQty = stats ? Math.max(1, ...stats.production_by_category_kg.map((c) => c.quantity_kg)) : 1;

  return (
    <MinistereLayout
      title={lang === "fr" ? "Statistiques agricoles" : "Imibare y'uburimyi"}
      subtitle={lang === "fr" ? "Vue d'ensemble de la production et du marché sur AgriConnect Burundi" : "Incamake y'umwimbu n'isoko kuri AgriConnect Burundi"}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          {lang === "fr" ? "Chargement..." : "Biriko birashirwaho..."}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive text-center py-10">{error}</p>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.farmer_count.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{lang === "fr" ? "Fermiers actifs" : "Abarimyi bakora"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.province_count.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{lang === "fr" ? "Provinces couvertes" : "Intara zifashwa"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active_listings.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{lang === "fr" ? "Annonces actives" : "Amatangazo ariho"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {lang === "fr" ? "Production par province" : "Umwimbu ku ntara"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.production_by_province_kg.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {lang === "fr" ? "Aucune donnée disponible." : "Nta makuru ariho."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.production_by_province_kg.map(({ province, quantity_kg }) => (
                      <div key={province} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-foreground">{province}</span>
                          <span className="text-muted-foreground">{quantity_kg.toLocaleString()} kg</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(4, (quantity_kg / maxProvinceQty) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sprout className="w-5 h-5" />
                  {lang === "fr" ? "Production par catégorie" : "Umwimbu ku bwoko"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.production_by_category_kg.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {lang === "fr" ? "Aucune donnée disponible." : "Nta makuru ariho."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.production_by_category_kg.map(({ category, quantity_kg }) => (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-foreground capitalize">{category}</span>
                          <span className="text-muted-foreground">{quantity_kg.toLocaleString()} kg</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${Math.max(4, (quantity_kg / maxCategoryQty) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{lang === "fr" ? "Prix du marché en direct" : "Ibiciro vy'isoko"}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.market_prices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {lang === "fr" ? "Aucun prix disponible pour le moment." : "Nta giciro kiriho ubu."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 font-semibold">{lang === "fr" ? "Produit" : "Igicuruzwa"}</th>
                        <th className="py-3 font-semibold text-right">{lang === "fr" ? "Prix" : "Igiciro"}</th>
                        <th className="py-3 font-semibold text-right">{lang === "fr" ? "Tendance" : "Ingene bigenda"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.market_prices.map((p) => (
                        <tr key={p.product}>
                          <td className="py-3">{p.product}</td>
                          <td className="py-3 text-right font-medium">{p.price.toLocaleString()} BIF / {p.unit}</td>
                          <td className="py-3 text-right text-muted-foreground">
                            {p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "→"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </MinistereLayout>
  );
}
