"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Wallet,
  AlertTriangle,
  Bell,
  Star,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { formatBIF } from "@/lib/currency";
import { useRequiredSession } from "@/lib/session";

const notifIcons: Record<string, React.ReactNode> = {
  dispute: <AlertTriangle className="w-4 h-4 text-destructive" />,
  stock: <MapPin className="w-4 h-4 text-accent-foreground" />,
  payout: <Wallet className="w-4 h-4 text-primary" />,
  testimonial: <Star className="w-4 h-4 text-amber-500" />,
  system: <Bell className="w-4 h-4 text-primary" />,
};

const priorityBadgeStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

const overviewCopy = {
  fr: {
    loadingTitle: "Chargement...",
    loadingSubtitle: "Récupération des indicateurs plateforme",
    loadingBody: "Préparation du tableau de bord admin...",
    title: "Vue d'ensemble",
    subtitle: "Tableau de bord de la plateforme AgriConnect Burundi",
    loadError: "Impossible de charger les indicateurs admin.",
    platformGmv: "GMV plateforme",
    activeFarmers: "Fermiers actifs",
    activeOrders: "Commandes actives",
    farmerPayments: "Paiements fermiers",
    previous30Days: "vs 30j précédents",
    transactionsVolume: "Volume des transactions (GMV)",
    transactionsSubtitle: "Données réelles cumulées — BIF",
    gmvLegend: "GMV",
    recentActivity: "Activité récente",
    newNotifications: "{count} nouvelles",
    provinceDistribution: "Répartition par province",
    farmersUnit: "fermiers",
    activeOrdersShort: "cmd. actives",
    noGeographicData: "Aucune donnée géographique enregistrée",
    topFarmers: "Top Fermiers",
    farmerColumn: "Fermier",
    ratingColumn: "Note",
    noRankedFarmers: "Aucun fermier encore classé.",
    payoutsSummary: "Résumé des décaissements",
    payoutsDescription:
      "Net transféré aux producteurs (post-commission de {commissionPercent}%) — les retraits manuels restent validés séparément par l'admin.",
    beneficiaries: "Bénéficiaires",
    payouts: "Décaissements",
    withdrawalsToValidate: "Retraits à valider",
    amountPending: "Montant en attente",
    manualWithdrawals: "Pilotage retraits manuels",
    totalRequests: "Demandes totales",
    averageTicket: "Ticket moyen",
    completedWithdrawals: "Retraits terminés",
    rejectedWithdrawals: "Retraits rejetés",
    pendingWithdrawals: "Retraits encore en attente",
    disputesMonitoring: "Surveillance litiges finance",
    open: "Ouverts",
    inReview: "En revue",
    resolved: "Résolus",
    highPriority: "Priorité haute",
    performanceQuality: "Performance & Qualité",
    conversionRate: "Taux de conversion",
    cancellationRate: "Taux d'annulation",
    commissionRevenue: "Revenus commission",
    commissionPeriod: "Ce mois (est.)",
    totalCommission: "Total cumulé (est.)",
    cancelledOrders: "Commandes annulées",
    allTime: "Depuis le début",
  },
  ki: {
    loadingTitle: "Biriko birapakururwa...",
    loadingSubtitle: "Turiko turazana ibipimo vy'urubuga",
    loadingBody: "Turiko dutegura tableau de bord y'ubuyobozi...",
    title: "Incamake",
    subtitle: "Tableau de bord y'urubuga AgriConnect Burundi",
    loadError: "Ntivyashobotse kuzana ibipimo vy'ubuyobozi.",
    platformGmv: "GMV y'urubuga",
    activeFarmers: "Abarimyi bakora",
    activeOrders: "Amakomande akora",
    farmerPayments: "Ubwishyu bw'abarimyi",
    previous30Days: "ugereranyije n'imisi 30 iheze",
    transactionsVolume: "Ingano y'ibikorwa vya GMV",
    transactionsSubtitle: "Amakuru y'ukuri yegeranijwe — BIF",
    gmvLegend: "GMV",
    recentActivity: "Ibikorwa vya vuba",
    newNotifications: "bishasha {count}",
    provinceDistribution: "Itandukanywa ku ntara",
    farmersUnit: "abarimyi",
    activeOrdersShort: "amakomande akora",
    noGeographicData: "Nta makuru y'ibibanza yanditswe.",
    topFarmers: "Abarimyi ba mbere",
    farmerColumn: "Umurimyi",
    ratingColumn: "Amanota",
    noRankedFarmers: "Nta murimyi arashirwa ku rutonde.",
    payoutsSummary: "Incamake y'ukwishyura",
    payoutsDescription:
      "Amahera yashikirijwe abahingura (inyuma ya komisiyo ya {commissionPercent}%) — ama retraits y'intoki aracemezwa ukwawo n'admin.",
    beneficiaries: "Abaronka",
    payouts: "Ukwishyura",
    withdrawalsToValidate: "Retraits zo kwemeza",
    amountPending: "Amahera agitegerejwe",
    manualWithdrawals: "Gukurikirana retraits z'intoki",
    totalRequests: "Ibisabwa vyose",
    averageTicket: "Impuzandengo y'igiciro",
    completedWithdrawals: "Retraits zarangiye",
    rejectedWithdrawals: "Retraits zatemwe",
    pendingWithdrawals: "Retraits zigitegerejwe",
    disputesMonitoring: "Gukurikirana amatati y'amahera",
    open: "Zuguruye",
    inReview: "Ziri gusuzumwa",
    resolved: "Zakemuwe",
    highPriority: "Ihuta",
    performanceQuality: "Umusaruro & Ubuziranenge",
    conversionRate: "Igipimo cy'igurisha",
    cancellationRate: "Igipimo cy'isubika",
    commissionRevenue: "Inyungu za komidiyo",
    commissionPeriod: "Uyu kwezi",
    totalCommission: "Inyungu zose",
    cancelledOrders: "Amasezerano yasubitswe",
    allTime: "Kuva kera",
  },
} as const;

function formatGrowth(growth: number, locale: string) {
  const safeValue = Number.isFinite(growth) ? Math.abs(growth) : 0;
  return safeValue.toLocaleString(locale, {
    minimumFractionDigits: safeValue % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function getPriorityLabel(priority: string | undefined, lang: "fr" | "ki") {
  if (priority === "high") return lang === "ki" ? "Ihuta" : "Priorité haute";
  if (priority === "medium") return lang === "ki" ? "Hagati" : "Priorité moyenne";
  if (priority === "low") return lang === "ki" ? "Gukurikirana" : "Suivi";
  return null;
}

export default function AdminOverviewPage() {
  const { lang } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session, ready } = useRequiredSession("admin");
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = overviewCopy[lang];

  useEffect(() => {
    if (!ready || !session) return;

    apiFetch("/stats/admin")
      .then(resData => {
        setData(resData);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error("Admin stats error", err);
        setError(err.message || copy.loadError);
        setLoading(false);
      });
  }, [copy.loadError, ready, session]);

  if (!ready || loading) {
    return (
      <AdminLayout title={copy.loadingTitle} subtitle={copy.loadingSubtitle}>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm">{copy.loadingBody}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout title={copy.title} subtitle={copy.subtitle}>
        <Card className="border-border">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {error || copy.loadError}
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const commissionPercent = ((data.commission_rate ?? 0) * 100).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

  const kpis = [
    {
      label: copy.platformGmv,
      value: formatBIF(data.gmv),
      growth: data.kpi_growth?.gmv ?? 0,
      icon: Wallet,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: copy.activeFarmers,
      value: data.active_farmers.toString(),
      growth: data.kpi_growth?.active_farmers ?? 0,
      icon: Users,
      color: "text-accent-foreground",
      bg: "bg-accent/30",
    },
    {
      label: copy.activeOrders,
      value: data.active_orders.toString(),
      growth: data.kpi_growth?.active_orders ?? 0,
      icon: ShoppingCart,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: copy.farmerPayments,
      value: formatBIF(data.total_payouts),
      growth: data.kpi_growth?.total_payouts ?? 0,
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/5",
    },
  ];

  return (
    <AdminLayout
      title={copy.title}
      subtitle={copy.subtitle}
    >
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, growth, icon: Icon, color, bg }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
                  <Icon className={cn("w-5 h-5", color)} />
                </div>
                <span className={cn("flex items-center gap-0.5 text-xs font-medium", growth >= 0 ? "text-green-600" : "text-destructive")}>
                  {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatGrowth(growth, locale)}%
                </span>
              </div>
              <p className="mt-3 text-xl font-bold text-foreground leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-1">{copy.previous30Days}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance & Quality Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-gradient-to-br from-card to-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{copy.conversionRate}</p>
              <p className="text-xl font-bold text-foreground">{data.conversion_rate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-gradient-to-br from-card to-destructive/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{copy.cancellationRate}</p>
              <p className="text-xl font-bold text-foreground">{data.cancellation_rate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-gradient-to-br from-card to-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{copy.commissionRevenue}</p>
              <p className="text-xl font-bold text-foreground">{formatBIF(data.commission_current_period)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GMV chart */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              {copy.transactionsVolume}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{copy.transactionsSubtitle}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.monthly_gmv} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip
                  formatter={(v: number) => [formatBIF(v), copy.gmvLegend]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: 12 }}
                />
                <Bar dataKey="gmv" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" />
                {copy.recentActivity}
              </CardTitle>
              <Badge className="bg-destructive text-destructive-foreground border-0 text-xs">
                {copy.newNotifications.replace("{count}", String(data.unread_notifications))}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul>
              {data.recent_notifications.map((n: any) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b border-border last:border-0",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {notifIcons[n.type as keyof typeof notifIcons] || notifIcons.system}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-semibold leading-tight text-foreground", !n.read && "text-primary")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                    {(n.reference || n.priority) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {n.reference && (
                          <Badge variant="outline" className="text-[10px] h-auto py-0.5">
                            {n.reference}
                          </Badge>
                        )}
                        {getPriorityLabel(n.priority, lang) && (
                          <Badge className={cn("text-[10px] border h-auto py-0.5", priorityBadgeStyles[n.priority as string] || priorityBadgeStyles.low)}>
                            {getPriorityLabel(n.priority, lang)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Province stock stats from real data */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {copy.provinceDistribution}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-2">
              {data.province_data.map((p: any) => (
                <div
                  key={p.province}
                  className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs font-semibold text-foreground leading-tight truncate">{p.province}</p>
                  <p className="text-lg font-bold text-primary">{p.farmers}<span className="text-[10px] font-normal text-muted-foreground ml-1">{copy.farmersUnit}</span></p>
                  <p className="text-[10px] text-muted-foreground">{p.orders_pending} {copy.activeOrdersShort}</p>
                </div>
              ))}
              {data.province_data.length === 0 && (
                <p className="col-span-3 text-center py-6 text-xs text-muted-foreground italic">{copy.noGeographicData}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top farmers */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-accent-foreground" />
              {copy.topFarmers}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{copy.farmerColumn}</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">GMV</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">{copy.ratingColumn}</th>
                </tr>
              </thead>
              <tbody>
                {data.top_farmers.slice(0, 5).map((f: any, index: number) => (
                  <tr key={f.id ?? `${f.name}-${f.province}-${index}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground leading-tight text-xs">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.province}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                      {formatBIF(f.gmv)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-0.5 text-xs text-accent-foreground">
                        <Star className="w-3 h-3 fill-current" />
                        {f.rating}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.top_farmers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">
                      {copy.noRankedFarmers}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Payouts summary */}
      <Card className="border-border bg-primary/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.payoutsSummary}</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatBIF(data.total_payouts)}</p>
            <p className="text-xs text-muted-foreground">
              {copy.payoutsDescription.replace("{commissionPercent}", commissionPercent)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="text-center px-4 py-2 bg-card border border-border rounded-xl">
              <p className="text-lg font-bold text-foreground">{data.payout_beneficiaries}</p>
              <p className="text-[10px] text-muted-foreground">{copy.beneficiaries}</p>
            </div>
            <div className="text-center px-4 py-2 bg-card border border-border rounded-xl">
              <p className="text-lg font-bold text-foreground">{data.payout_releases}</p>
              <p className="text-[10px] text-muted-foreground">{copy.payouts}</p>
            </div>
            <div className="text-center px-4 py-2 bg-card border border-border rounded-xl">
              <p className="text-lg font-bold text-foreground">{data.pending_withdrawals ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{copy.withdrawalsToValidate}</p>
            </div>
            <div className="text-center px-4 py-2 bg-card border border-border rounded-xl">
              <p className="text-lg font-bold text-foreground">{formatBIF(data.pending_withdrawal_amount ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">{copy.amountPending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              {copy.manualWithdrawals}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-0">
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.totalRequests}</p>
              <p className="text-lg font-bold text-foreground mt-1">{data.total_withdrawal_requests ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.averageTicket}</p>
              <p className="text-lg font-bold text-foreground mt-1">{formatBIF(data.average_withdrawal_amount ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.completedWithdrawals}</p>
              <p className="text-lg font-bold text-foreground mt-1">{data.completed_withdrawals ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{formatBIF(data.completed_withdrawal_amount ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.rejectedWithdrawals}</p>
              <p className="text-lg font-bold text-foreground mt-1">{data.rejected_withdrawals ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{formatBIF(data.rejected_withdrawal_amount ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card col-span-2 sm:col-span-2">
              <p className="text-[10px] text-muted-foreground">{copy.pendingWithdrawals}</p>
              <div className="flex items-end justify-between gap-3 mt-1">
                <p className="text-lg font-bold text-foreground">{data.pending_withdrawals ?? 0}</p>
                <p className="text-sm font-semibold text-primary">{formatBIF(data.pending_withdrawal_amount ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              {copy.disputesMonitoring}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-0">
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.open}</p>
              <p className="text-lg font-bold text-foreground mt-1">{data.open_disputes ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.inReview}</p>
              <p className="text-lg font-bold text-foreground mt-1">{data.in_review_disputes ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.resolved}</p>
              <p className="text-lg font-bold text-foreground mt-1">{data.resolved_disputes ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{copy.highPriority}</p>
              <p className="text-lg font-bold text-destructive mt-1">{data.high_priority_disputes ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
