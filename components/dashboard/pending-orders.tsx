import { Clock, Truck, ChefHat } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatBIF } from "@/lib/currency";

const statusConfig = {
  preparation: {
    label: "En préparation",
    color: "text-yellow-700 bg-yellow-100",
    icon: ChefHat,
  },
  pickup: {
    label: "Collecte prévue",
    color: "text-blue-700 bg-blue-100",
    icon: Clock,
  },
  transit: {
    label: "En transit",
    color: "text-primary bg-primary/10",
    icon: Truck,
  },
  default: {
    label: "Statut inconnu",
    color: "text-muted-foreground bg-muted",
    icon: Clock,
  },
};

export function PendingOrders({ orders }: { orders: any[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">Commandes en cours</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{orders.length} commandes actives</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">
          <Link href="/transactions">Voir tout</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.default;
          const StatusIcon = status.icon;
          return (
            <Link
              key={order.id}
              href={`/fermier/commande/${order.id}`}
              className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 transition-all hover:border-primary/20 group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status.color}`}>
                <StatusIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground truncate">{order.buyer}</p>
                  <span className="text-xs font-semibold text-primary shrink-0">{formatBIF(order.total)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.items}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{order.dueDate}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
