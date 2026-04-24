"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Bell, Package, Star, TrendingUp, Truck, Utensils } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { apiFetch, getApiErrorStatus } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/LanguageContext";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: string;
}

const notifIcons: Record<string, ReactNode> = {
  delivery: <Truck className="w-5 h-5 text-green-600" />,
  order: <Package className="w-5 h-5 text-primary" />,
  dispute: <AlertTriangle className="w-5 h-5 text-destructive" />,
  promo: <Utensils className="w-5 h-5 text-amber-600" />,
  market: <TrendingUp className="w-5 h-5 text-primary" />,
  testimonial: <Star className="w-5 h-5 text-amber-500" />,
  system: <Bell className="w-5 h-5 text-muted-foreground" />,
};

export default function BuyerNotificationsPage() {
  const { lang, text } = useLanguage();
  const { session, ready } = useRequiredSession("acheteur");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<string[]>([]);

  const copy = {
    fr: {
      dismiss: "Supprimer",
      dismissing: "Suppression...",
      dismissError: "Impossible de supprimer cette notification.",
      loadError: "Impossible de charger les notifications.",
    },
    ki: {
      dismiss: "Kuraho",
      dismissing: "Turiko turakuraho...",
      dismissError: "Ntivyashobotse gukuraho iri menyesha.",
      loadError: "Ntivyashobotse kuronka amamenyesha.",
    },
  }[lang];

  const handleDismiss = async (notificationId: string) => {
    setDismissingIds((current) => (current.includes(notificationId) ? current : [...current, notificationId]));

    try {
      await apiFetch("/notifications/dismiss", {
        method: "POST",
        body: JSON.stringify({ notification_id: notificationId }),
      });
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      setError(null);
    } catch (err) {
      if (getApiErrorStatus(err) !== 401) {
        console.error("Buyer notifications dismiss error", err);
      }
      setError(err instanceof Error && err.message ? err.message : copy.dismissError);
    } finally {
      setDismissingIds((current) => current.filter((item) => item !== notificationId));
    }
  };

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    apiFetch(`/notifications/${session.userId}`)
      .then((data) => {
        setNotifications(Array.isArray(data) ? (data as NotificationItem[]) : []);
        setError(null);
      })
      .catch((err) => {
        console.error("Buyer notifications error", err);
        setError(err instanceof Error && err.message ? err.message : copy.loadError);
      })
      .finally(() => setLoading(false));
  }, [copy.loadError, ready, session]);

  return (
    <BuyerLayout title={text.notifTitle} subtitle={text.notifBuyerSubtitle}>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {error && !loading && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.notifUpdating}</p>
          </div>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "overflow-hidden rounded-3xl transition-all duration-300",
                n.read ? "bg-card border-border shadow-sm opacity-70" : "bg-primary/5 border-primary/20 shadow-md"
              )}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  n.read ? "bg-secondary text-muted-foreground" : "bg-white border border-primary/10"
                )}>
                  {notifIcons[n.type] || <Bell className="w-6 h-6" />}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("font-black tracking-tight", n.read ? "text-foreground" : "text-primary text-lg leading-tight")}>{n.title}</p>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap bg-secondary/50 px-2 py-1 rounded-md">{n.time}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground/80 leading-relaxed">{n.body}</p>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0 pt-1">
                  {!n.read && (
                    <div className="w-3 h-3 rounded-full bg-primary shadow-sm shadow-primary/20 animate-pulse" />
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDismiss(n.id)}
                    disabled={dismissingIds.includes(n.id)}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {dismissingIds.includes(n.id) ? copy.dismissing : copy.dismiss}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {!loading && notifications.length === 0 && (
          <div className="py-24 text-center space-y-4">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto border-4 border-background shadow-sm">
              <Bell className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.notifEmpty}</p>
          </div>
        )}
      </div>
    </BuyerLayout>
  );
}
