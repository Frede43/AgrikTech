"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Truck, Package, User, Phone, MapPin, RefreshCw,
  CheckCircle, AlertTriangle, Loader2, UserX, UserCheck,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";

interface Driver {
  id: number;
  name: string;
  phone: string | null;
  province: string | null;
  rating: number;
}

interface OrderLogistics {
  id: number;
  orderId: string;
  status: string;
  statusLabel: string;
  placedAt: string;
  product: { name: string; qty: number; unit: string; province: string };
  farmer: { id: number | null; name: string; phone: string; province: string };
  buyer: { id: number | null; name: string; phone: string };
  driver: { id: number | null; name: string | null; phone: string | null };
  total: number;
  pickup_qr: string;
  delivery_otp: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800 border-amber-200",
  PAID_ESCROW: "bg-blue-100 text-blue-800 border-blue-200",
  READY_FOR_PICKUP: "bg-purple-100 text-purple-800 border-purple-200",
  PICKED_UP: "bg-orange-100 text-orange-800 border-orange-200",
  IN_TRANSIT: "bg-cyan-100 text-cyan-800 border-cyan-200",
  COMPLETED: "bg-primary/10 text-primary border-primary/20",
  DISPUTED: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "En attente paiement",
  PAID_ESCROW: "Payée — sans livreur",
  READY_FOR_PICKUP: "Prête à collecter",
  PICKED_UP: "Collectée",
  IN_TRANSIT: "En transit",
  COMPLETED: "Livrée",
  DISPUTED: "Litige",
};

export default function AdminLivraisonsPage() {
  const { session, ready } = useRequiredSession("admin");
  const [orders, setOrders] = useState<OrderLogistics[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<Record<number, string>>({});
  const [messages, setMessages] = useState<Record<number, { type: "ok" | "err"; text: string }>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [ordersData, driversData] = await Promise.all([
        apiFetch("/admin/orders/logistics"),
        apiFetch("/admin/drivers"),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
    } catch (err) {
      console.error("Admin dispatch load error", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadData();
  }, [ready, session, loadData]);

  const handleAssign = async (orderId: number, driverIdVal: string) => {
    const driverId = driverIdVal === "none" ? null : Number(driverIdVal);
    setAssigning(orderId);
    setMessages((prev) => ({ ...prev, [orderId]: undefined as any }));
    try {
      const url = driverId
        ? `/admin/orders/${orderId}/assign-driver?driver_id=${driverId}`
        : `/admin/orders/${orderId}/assign-driver`;
      const res = await apiFetch(url, { method: "PUT" });
      setMessages((prev) => ({ ...prev, [orderId]: { type: "ok", text: res.message || "Assigné ✓" } }));
      await loadData();
    } catch (err: any) {
      setMessages((prev) => ({ ...prev, [orderId]: { type: "err", text: err.message || "Erreur d'assignation" } }));
    } finally {
      setAssigning(null);
    }
  };

  const filtered = orders.filter((o) =>
    statusFilter === "all" ? true : o.status === statusFilter
  );

  const unassignedCount = orders.filter((o) => !o.driver.id && !["COMPLETED", "DISPUTED"].includes(o.status)).length;

  if (!ready || loading) {
    return (
      <AdminLayout title="Dispatch Livraisons" subtitle="Chargement…">
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="w-10 h-10 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Dispatch Livraisons"
      subtitle={`${orders.length} commandes · ${unassignedCount} sans livreur · ${drivers.length} livreurs actifs`}
    >
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total commandes", value: orders.length, color: "text-foreground", icon: Package },
            { label: "Sans livreur", value: unassignedCount, color: "text-amber-600", icon: AlertTriangle },
            { label: "En cours", value: orders.filter((o) => ["PICKED_UP", "IN_TRANSIT", "READY_FOR_PICKUP"].includes(o.status)).length, color: "text-blue-600", icon: Truck },
            { label: "Livrées", value: orders.filter((o) => o.status === "COMPLETED").length, color: "text-primary", icon: CheckCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + refresh */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["all", "PAID_ESCROW", "READY_FOR_PICKUP", "PICKED_UP", "COMPLETED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all",
                  statusFilter === s
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {s === "all" ? "Toutes" : (STATUS_LABELS[s] || s)}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            className="rounded-xl gap-2 font-bold text-xs h-9 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </Button>
        </div>

        {/* Orders table */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
              <p className="text-sm font-bold text-muted-foreground">Aucune commande pour ce filtre.</p>
            </div>
          )}

          {filtered.map((order) => {
            const isCompleted = ["COMPLETED", "DISPUTED"].includes(order.status);
            const msg = messages[order.id];
            const currentDriverId = order.driver.id ? String(order.driver.id) : "none";
            const pendingDriverId = selectedDrivers[order.id] ?? currentDriverId;

            return (
              <div
                key={order.id}
                className={cn(
                  "bg-card border rounded-2xl p-5 shadow-sm space-y-4 transition-all",
                  !order.driver.id && !isCompleted
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-border"
                )}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-foreground tracking-tight">
                        {order.orderId}
                      </span>
                      <Badge className={cn("border text-[10px] font-bold uppercase px-2 py-0.5 rounded-md",
                        STATUS_COLORS[order.status] || "bg-secondary text-muted-foreground border-border")}>
                        {STATUS_LABELS[order.status] || order.statusLabel}
                      </Badge>
                      {!order.driver.id && !isCompleted && (
                        <Badge className="border text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border-amber-200">
                          ⚠ Sans livreur
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">{order.placedAt}</p>
                  </div>
                  <p className="text-lg font-black text-primary tracking-tight">{formatBIF(order.total)}</p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Product */}
                  <div className="bg-secondary/40 rounded-xl p-3 space-y-1 border border-border/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Produit</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{order.product.name}</p>
                    <p className="text-xs text-muted-foreground">{order.product.qty} {order.product.unit} · <MapPin className="w-3 h-3 inline" /> {order.product.province}</p>
                  </div>

                  {/* Farmer */}
                  <div className="bg-secondary/40 rounded-xl p-3 space-y-1 border border-border/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Fermier</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{order.farmer.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {order.farmer.phone}
                    </p>
                  </div>

                  {/* Current driver */}
                  <div className={cn("rounded-xl p-3 space-y-1 border",
                    order.driver.id
                      ? "bg-primary/5 border-primary/20"
                      : "bg-amber-50 border-amber-200"
                  )}>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Livreur actuel</span>
                    </div>
                    {order.driver.id ? (
                      <>
                        <p className="text-sm font-bold text-foreground">{order.driver.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {order.driver.phone || "—"}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-amber-700">Non assigné</p>
                    )}
                  </div>
                </div>

                {/* Assignment control */}
                {!isCompleted && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <div className="flex-1">
                      <Select
                        value={pendingDriverId}
                        onValueChange={(val) =>
                          setSelectedDrivers((prev) => ({ ...prev, [order.id]: val }))
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl border-border bg-card font-semibold text-sm">
                          <SelectValue placeholder="Choisir un livreur…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <UserX className="w-4 h-4" /> Désassigner le livreur
                            </span>
                          </SelectItem>
                          {drivers.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              <span className="flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-primary" />
                                {d.name}
                                {d.province && <span className="text-muted-foreground text-xs">· {d.province}</span>}
                                <span className="text-amber-500 text-xs">★ {d.rating}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => handleAssign(order.id, pendingDriverId)}
                      disabled={assigning === order.id || pendingDriverId === currentDriverId}
                      className={cn(
                        "h-11 rounded-xl font-bold text-sm gap-2 shrink-0 min-w-[160px]",
                        pendingDriverId === "none"
                          ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                          : "bg-primary text-white hover:bg-primary/90 shadow-sm"
                      )}
                    >
                      {assigning === order.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> En cours…</>
                      ) : pendingDriverId === "none" ? (
                        <><UserX className="w-4 h-4" /> Désassigner</>
                      ) : (
                        <><UserCheck className="w-4 h-4" /> Assigner</>
                      )}
                    </Button>
                  </div>
                )}

                {/* Feedback message */}
                {msg && (
                  <div className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2",
                    msg.type === "ok"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  )}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {msg.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
