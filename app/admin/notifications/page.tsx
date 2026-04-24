"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, MapPin, Wallet, Loader2, Star } from "lucide-react";
import { apiFetch, getApiErrorStatus } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";

interface AdminNotification {
    id: string;
    type: string;
    title: string;
    body: string;
    time: string;
    read: boolean;
    priority?: "low" | "medium" | "high" | string;
    reference?: string;
}

const notifIcons: Record<string, React.ReactNode> = {
    dispute: <AlertTriangle className="w-5 h-5 text-destructive" />,
    stock: <MapPin className="w-5 h-5 text-accent-foreground" />,
    payout: <Wallet className="w-5 h-5 text-primary" />,
    testimonial: <Star className="w-5 h-5 text-amber-500" />,
    system: <Bell className="w-5 h-5 text-primary" />,
};

const priorityBadgeStyles: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

function getPriorityLabel(priority: string | undefined, lang: "fr" | "ki") {
    if (priority === "high") return lang === "ki" ? "Ihuta" : "Priorité haute";
    if (priority === "medium") return lang === "ki" ? "Hagati" : "Priorité moyenne";
    if (priority === "low") return lang === "ki" ? "Gukurikirana" : "Suivi";
    return null;
}

export default function AdminNotificationsPage() {
    const { lang } = useLanguage();
    const { session, ready } = useRequiredSession("admin");
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dismissingIds, setDismissingIds] = useState<string[]>([]);
    const copy = {
        fr: {
            title: "Toutes les notifications (admin)",
            loadingSubtitle: "Chargement des alertes générales du système",
            syncing: "Synchronisation des notifications...",
            unreadSummary: "{unread} non lue(s) sur {total} alerte(s)",
            empty: "Aucune notification admin pour le moment.",
            loadError: "Impossible de charger les notifications.",
            dismiss: "Supprimer",
            dismissing: "Suppression...",
            dismissError: "Impossible de supprimer cette notification.",
        },
        ki: {
            title: "Amenyesha yose (admin)",
            loadingSubtitle: "Turiko turategura imburi rusangi za sisiteme",
            syncing: "Turiko turahuza amamenyesha...",
            unreadSummary: "Amenyesha {unread} atarasomwa kuri {total}",
            empty: "Nta menyesha ya admin ariho ubu.",
            loadError: "Ntivyashobotse kuronka amamenyesha.",
            dismiss: "Kuraho",
            dismissing: "Turiko turakuraho...",
            dismissError: "Ntivyashobotse gukuraho iri menyesha.",
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
                console.error("Admin notification dismiss error", err);
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
                setNotifications(Array.isArray(data) ? data : []);
                setError(null);
            })
            .catch((err: any) => {
                console.error("Admin notifications load error", err);
                setError(err.message || copy.loadError);
            })
            .finally(() => setLoading(false));
    }, [copy.loadError, ready, session]);

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.read).length,
        [notifications],
    );

    if (!ready || loading) {
        return (
            <AdminLayout title={copy.title} subtitle={copy.loadingSubtitle}>
                <div className="py-20 flex flex-col items-center gap-3 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{copy.syncing}</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            title={copy.title}
            subtitle={copy.unreadSummary.replace("{unread}", String(unreadCount)).replace("{total}", String(notifications.length))}
        >
            <div className="max-w-3xl space-y-4">
                {error && (
                    <Card className="border-destructive/20 bg-destructive/5">
                        <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
                    </Card>
                )}
                {notifications.length === 0 && !error && (
                    <Card className="border-border">
                        <CardContent className="p-8 text-center text-sm text-muted-foreground">
                            {copy.empty}
                        </CardContent>
                    </Card>
                )}
                {notifications.map((n) => (
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
                                {(n.reference || n.priority) && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {n.reference && (
                                            <Badge variant="outline" className="text-[10px] h-auto py-0.5">
                                                {n.reference}
                                            </Badge>
                                        )}
                                        {getPriorityLabel(n.priority, lang) && (
                                            <Badge className={cn("text-[10px] border h-auto py-0.5", priorityBadgeStyles[n.priority || ""] || priorityBadgeStyles.low)}>
                                                {getPriorityLabel(n.priority, lang)}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-3 shrink-0">
                                {!n.read && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
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
                ))}
            </div>
        </AdminLayout>
    );
}
