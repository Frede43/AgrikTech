import { TrendingUp, ShoppingCart, Package, Star } from "lucide-react";
import { formatBIF } from "@/lib/currency";

export function StatsCards({ data }: { data: any }) {
  const stats = [
    {
      label: "Revenus totaux",
      value: formatBIF(data.revenue),
      sub: "+12% vs mois dernier",
      trend: "up",
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Commandes en cours",
      value: data.pending_orders.toString(),
      sub: "À préparer aujourd'hui",
      trend: "neutral",
      icon: ShoppingCart,
      color: "text-accent-foreground",
      bg: "bg-accent/30",
    },
    {
      label: "Produits actifs",
      value: data.active_products.toString(),
      sub: `Sur ${data.total_products} produits`,
      trend: "neutral",
      icon: Package,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Note moyenne",
      value: `${data.rating} / 5`,
      sub: "Basé sur les ventes",
      trend: "up",
      icon: Star,
      color: "text-accent-foreground",
      bg: "bg-accent/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground leading-snug">{s.label}</p>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
            <p className={`text-xs mt-1 ${s.trend === "up" ? "text-primary" : s.trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
              {s.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
