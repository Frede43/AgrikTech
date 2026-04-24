"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { WalletCard } from "@/components/dashboard/wallet-card";
import { SokoLive } from "@/components/dashboard/soko-live";
import { PendingOrders } from "@/components/dashboard/pending-orders";
import { WeatherMini } from "@/components/dashboard/weather-mini";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import { apiFetch } from "@/lib/api-config";
import { logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";

export default function DashboardPage() {
  const { session, ready } = useRequiredSession("fermier");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lang, text } = useLanguage();

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    apiFetch(`/stats/farmer/${session.userId}/dashboard`)
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        logIfNotNetworkError("Dashboard error", err);
        setLoading(false);
      });
  }, [ready, session]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? text.greetMorning : hour < 18 ? text.greetAfternoon : text.greetEvening;

  if (loading || !data) {
    return (
      <DashboardLayout title={text.dashLoading} subtitle={text.dashLoadingSub}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{text.dashPreparing}</p>
        </div>
      </DashboardLayout>
    );
  }

  const farmerName = data?.user?.name?.split(" ")[0] || text.sideFarmerProfile;

  return (
    <DashboardLayout
      title={text.sideDashboard}
      subtitle={`${greeting}, ${farmerName}`}
    >
      {/* Mobile greeting */}
      <div className="lg:hidden flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground leading-none">
            {greeting}, {farmerName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data.user.province} · {text.sideDashboard}</p>
        </div>
        <Button asChild size="sm" className="bg-primary text-primary-foreground rounded-xl font-semibold">
          <Link href="/produits/ajouter">
            <Plus className="w-4 h-4 mr-1.5" />
            {text.dashHarvest}
          </Link>
        </Button>
      </div>

      {/* Desktop add button */}
      <div className="hidden lg:flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <Button asChild className="bg-primary text-primary-foreground rounded-xl font-semibold">
          <Link href="/produits/ajouter">
            <Plus className="w-4 h-4 mr-1.5" />
            {text.dashAddHarvest}
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <StatsCards data={data.stats} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <SalesChart data={data.weekly_sales} />
          <PendingOrders orders={data.recent_orders} />
        </div>

        {/* Right col — 1/3 */}
        <div className="space-y-6">
          <WalletCard balance={data.user.balance} pending={0} />
          <WeatherMini />
        </div>
      </div>

      {/* Soko Live full width */}
      <SokoLive province={data.user.province} />
    </DashboardLayout>
  );
}
