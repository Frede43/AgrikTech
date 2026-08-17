"use client";

import { useState, useEffect, type ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Bell, AlertTriangle, TrendingUp, RefreshCw, Star, Wallet } from "lucide-react";
import { apiFetch, getApiErrorStatus } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";
import { isLikelyNetworkError, useOnlineStatus } from "@/lib/offline";

interface NotificationItem {
    id: string;
    title: string;
    body: string;
    time: string;
    read: boolean;
    type: string;
}

const notifIcons: Record<string, ReactNode> = {
    sale: <Check className="w-5 h-5 text-green-600" />,
    alert: <AlertTriangle className="w-5 h-5 text-destructive" />,
    market: <TrendingUp className="w-5 h-5 text-primary" />,
    payout: <Wallet className="w-5 h-5 text-emerald-600" />,
    system: <Bell className="w-5 h-5 text-muted-foreground" />,
    testimonial: <Star className="w-5 h-5 text-amber-500" />,
    dispute: <AlertTriangle className="w-5 h-5 text-destructive" />,
};

export default function NotificationsPage() {
    const { session, ready } = useRequiredSession("fermier");
    const isOnline = useOnlineStatus();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dismissingIds, setDismissingIds] = useState<string[]>([]);
    const { lang, text } = useLanguage();
    const copy = {
        fr: {
            dismiss: "Supprimer",
            dismissing: "Suppression...",
            dismissError: "Impossible de supprimer cette notification.",
            offlineError: "Hors ligne : reconnectez-vous pour supprimer cette notification.",
            loadError: "Impossible de charger les notifications.",
        },
        ki: {
            dismiss: "Kuraho",
            dismissing: "Turiko turakuraho...",
            dismissError: "Ntivyashobotse gukuraho iri menyesha.",
            offlineError: "Nta internet: subira ku murongo.",
            loadError: "Ntivyashobotse kuronka amamenyesha.",
        },
    }[lang];

    const handleDismiss = async (notificationId: string) => {
        if (!session || !isOnline) return;
        setDismissingIds((current) => (current.includes(notificationId) ? current : [...current, notificationId]));

        try {
            await apiFetch(`/notifications/${session.userId}/dismiss`, {
                method: "POST",
                body: JSON.stringify({ notification_id: notificationId }),
            });
            setNotifications((current) => current.filter((item) => item.id !== notificationId));
            setError(null);
        } catch (err) {
            if (getApiErrorStatus(err) !== 401) {
                console.error("Farmer notifications dismiss error", err);
            }
            setError(isLikelyNetworkError(err) ? copy.offlineError : (err instanceof Error && err.message ? err.message : copy.dismissError));
        } finally {
            setDismissingIds((current) => current.filter((item) => item !== notificationId));
        }
    };

    useEffect(() => {
        if (!ready || !session) return;

        setLoading(true);
        apiFetch(`/notifications/${session.userId}`)
            .then(data => {
                setNotifications(Array.isArray(data) ? (data as NotificationItem[]) : []);
                setError(null);
                setLoading(false);
            })
            .catch(err => {
                console.error("Notifications error", err);
                setError(err instanceof Error && err.message ? err.message : copy.loadError);
                setLoading(false);
            });
    }, [copy.loadError, ready, session]);

    return (
        <DashboardLayout title={text.notifTitle} subtitle={text.notifSubtitle}>
            <div className="max-w-3xl space-y-4">
                {error && !loading && (
                    <Card className="border-destructive/20 bg-destructive/5">
                        <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
                    </Card>
                )}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">{text.notifUpdating}</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <Card key={n.id} className={cn("overflow-hidden transition-colors border", n.read ? "bg-card border-border" : "bg-primary/5 border-primary/20 shadow-sm")}>
                            <CardContent className="p-4 flex gap-4">
                                <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shrink-0 border border-border/50">
                                    {notifIcons[n.type] || <Bell className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className={cn("font-bold", n.read ? "text-foreground" : "text-primary")}>{n.title}</p>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{n.time}</span>
                                    </div>
                                    <p className="text-sm text-foreground/80 mt-1">{n.body}</p>
                                </div>
                                <div className="flex flex-col items-end gap-3 shrink-0">
                                    {!n.read && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                    <button
                                        type="button"
                                        onClick={() => void handleDismiss(n.id)}
                                        disabled={dismissingIds.includes(n.id) || !isOnline}
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
                    <div className="text-center py-10 text-muted-foreground">
                        {text.notifEmpty}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
