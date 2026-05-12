"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, QrCode, CheckCircle, Clock, MapPin, Phone, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

interface FarmerOrderDetail {
  id: number;
  orderId: string;
  status: string;
  buyer: { name: string; address: string; phone: string };
  items: { name: string; qty: number; unit: string }[];
  totalWeight: string;
  pickup_qr: string;
  driver: { name: string; phone: string } | null;
}

export default function FarmerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { text } = useLanguage();
  const { session, ready } = useRequiredSession("fermier");
  const id = params?.id;
  const [order, setOrder] = useState<FarmerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !session || !id) return;
    setLoading(true);
    apiFetch(`/orders/${id}`)
      .then((data: any) => setOrder(data))
      .catch((err) => console.error("Farmer order error", err))
      .finally(() => setLoading(false));
  }, [id, ready, session]);

  if (loading) {
    return (
      <DashboardLayout title={text.dashLoading} subtitle="">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.dashLoading}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) return null;

  const isAwaitingPickup = ["paid_escrow", "confirmed", "ready_for_pickup"].includes(order.status.toLowerCase().replace(/ /g, "_"));
  const isCollected = ["picked_up", "in_transit", "delivered", "completed"].includes(order.status.toLowerCase().replace(/ /g, "_"));

  return (
    <DashboardLayout title="Détail de la commande" subtitle={order.orderId}>
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl border border-border">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Commande {order.orderId}</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Suivi de collecte</p>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex items-center justify-between">
           <div className="flex items-center gap-4">
             <div className={cn(
               "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
               isCollected ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
             )}>
               {isCollected ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
             </div>
             <div>
               <p className="text-sm font-black text-foreground uppercase tracking-tight">
                 {isCollected ? "Marchandise collectée" : "En attente du livreur"}
               </p>
               <p className="text-xs text-muted-foreground font-medium">Statut: {order.status}</p>
             </div>
           </div>
        </div>

        {/* QR Token Card (Crucial for the realistic flow) */}
        {isAwaitingPickup && (
          <div className="bg-primary rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-110" />
            <div className="relative z-10 flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center border border-white/30 shadow-inner">
                <QrCode className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-black uppercase tracking-widest opacity-90">Code de collecte</h2>
                <p className="text-sm font-medium opacity-70 max-w-[280px] mx-auto">
                  Montrez ce code au livreur lorsqu'il arrive pour récupérer la marchandise.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 w-full">
                 <p className="text-3xl font-mono font-black tracking-[0.4em] select-all">{order.pickup_qr}</p>
              </div>
            </div>
          </div>
        )}

        {/* Order Content */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-primary" />
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Articles à préparer</h2>
          </div>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-secondary/30 p-4 rounded-2xl border border-border/50">
                <span className="font-bold text-foreground">{item.name}</span>
                <Badge variant="outline" className="bg-white font-black">{item.qty} {item.unit}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Info */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
           <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Livreur assigné</h2>
           {order.driver ? (
             <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-black text-primary border border-border">
                    {order.driver.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">{order.driver.name}</p>
                    <p className="text-xs text-muted-foreground font-medium">{order.driver.phone}</p>
                  </div>
                </div>
                <a href={`tel:${order.driver.phone}`}>
                  <Button variant="outline" size="icon" className="rounded-xl">
                    <Phone className="w-4 h-4" />
                  </Button>
                </a>
             </div>
           ) : (
             <p className="text-sm text-muted-foreground italic">En attente d'assignation d'un livreur...</p>
           )}
        </div>

        {/* Buyer Info (Destination) */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Destination du colis</h2>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="text-sm font-black text-foreground">{order.buyer.name}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{order.buyer.address}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
