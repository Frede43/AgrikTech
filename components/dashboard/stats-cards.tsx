import { ShoppingCart, Package, Star, Wallet } from "lucide-react";
import { formatBIF } from "@/lib/currency";

export function StatsCards({ data }: { data: any }) {
  const stats = [
    {
      label: "Revenus totaux",
      value: formatBIF(data.revenue),
      icon: Wallet,
    },
    {
      label: "Commandes en cours",
      value: data.pending_orders.toString(),
      sub: "À traiter",
      icon: ShoppingCart,
    },
    {
      label: "Produits actifs",
      value: data.active_products.toString(),
      sub: `Sur ${data.total_products} produits`,
      icon: Package,
    },
    {
      label: "Note moyenne",
      value: `${data.rating} / 5`,
      sub: "D'après les avis",
      icon: Star,
    },
  ];

  return (
    <div className="grid grid-cols-2 border-y border-border bg-card lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={[
              "flex min-w-0 flex-col gap-3 p-4 sm:p-5",
              index % 2 === 0 ? "border-r border-border lg:border-r-0" : "",
              index < 2 ? "border-b border-border lg:border-b-0" : "",
              index > 0 ? "lg:border-l lg:border-border" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs font-medium leading-snug text-muted-foreground">{stat.label}</p>
            </div>
            <div>
              <p className="truncate text-xl font-semibold leading-none tabular-nums text-foreground">{stat.value}</p>
              {stat.sub && <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
