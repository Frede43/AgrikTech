"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { formatBIF } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  ChevronDown,
  Wallet,
  User,
  Truck,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { isLikelyNetworkError, logIfNotNetworkError, useOnlineStatus } from "@/lib/offline";

type Status = "all" | "open" | "in-review" | "resolved";

interface DisputeRecord {
  id: string;
  dbId: number;
  orderId: string;
  date: string;
  buyer: string;
  farmer: string;
  reason: string;
  detail: string;
  amount: number;
  refundRequested: number;
  status: Exclude<Status, "all">;
  priority: string;
  driver: string;
  resolution: string | null;
}

const statusStyles: Record<string, { color: string; icon: React.ReactNode }> = {
  open: {
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  "in-review": {
    color: "bg-accent/30 text-accent-foreground border-accent/40",
    icon: <Clock className="w-3 h-3" />,
  },
  resolved: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

const priorityConfig: Record<string, string> = {
  high:   "bg-destructive text-destructive-foreground",
  medium: "bg-accent text-accent-foreground",
  low:    "bg-muted text-muted-foreground",
};

export default function AdminLitigesPage() {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const isOnline = useOnlineStatus();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const copy = {
    fr: {
      title: "Gestion des litiges",
      subtitle: "Suivi et résolution des réclamations acheteurs / fermiers",
      loadingSubtitle: "Chargement des réclamations en cours",
      syncing: "Synchronisation des litiges...",
      loadError: "Impossible de charger les litiges.",
      sessionError: "Session administrateur introuvable.",
      updateError: "Impossible de mettre à jour ce litige.",
      offlineError: "Hors ligne : reconnectez-vous pour agir sur ce litige.",
      statusOpen: "Ouvert",
      statusReview: "En révision",
      statusResolved: "Résolu",
      priorityHigh: "Urgent",
      priorityMedium: "Moyen",
      priorityLow: "Faible",
      openCount: "Ouverts",
      reviewCount: "En révision",
      resolvedCount: "Résolus",
      searchPlaceholder: "Rechercher par ID, acheteur, fermier ou motif...",
      retry: "Réessayer",
      empty: "Aucun litige trouvé.",
      refundRequested: "remboursement demandé",
      orderAmount: "Montant commande",
      refundAmount: "Remboursement demandé",
      driverInvolved: "Livreur impliqué",
      reviewInProgress: "En cours de revue",
      takeOwnership: "Prendre en charge",
      startRefund: "Lancer remboursement manuel",
      reject: "Rejeter la demande",
    },
    ki: {
      title: "Gucungera impari",
      subtitle: "Gukurikirana no gutorera umuti ibirego vy'abaguzi n'abarimyi",
      loadingSubtitle: "Turiko turategura ibirego biriho",
      syncing: "Turiko turahuza impari...",
      loadError: "Ntivyashobotse kuronka impari.",
      sessionError: "Session ya admin ntibonetse.",
      updateError: "Ntivyashobotse guhindura iyi mpari.",
      offlineError: "Nta internet: subira ku murongo kugira ukore kuri iyi mpari.",
      statusOpen: "Biruguruye",
      statusReview: "Biriko birasuzumwa",
      statusResolved: "Vyatunganijwe",
      priorityHigh: "Ihuta",
      priorityMedium: "Hagati",
      priorityLow: "Hasi",
      openCount: "Zuguruye",
      reviewCount: "Ziri mu isuzuma",
      resolvedCount: "Zatunganijwe",
      searchPlaceholder: "Rondera ukoresheje ID, umuguzi, umurimyi canke imvo...",
      retry: "Subiramwo",
      empty: "Nta mpari yabonetse.",
      refundRequested: "amafaranga yasabwe gusubizwa",
      orderAmount: "Amafaranga y'ikidandazwa",
      refundAmount: "Amafaranga yasabwe gusubizwa",
      driverInvolved: "Umushikiriza yabigizemo uruhara",
      reviewInProgress: "Biriko birasuzumwa",
      takeOwnership: "Fata ikibazo",
      startRefund: "Tanguza gusubiza amafaranga",
      reject: "Hakana ubusabe",
    },
  }[lang];
  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    open: { ...statusStyles.open, label: copy.statusOpen },
    "in-review": { ...statusStyles["in-review"], label: copy.statusReview },
    resolved: { ...statusStyles.resolved, label: copy.statusResolved },
  };
  const priorityLabels: Record<string, string> = {
    high: copy.priorityHigh,
    medium: copy.priorityMedium,
    low: copy.priorityLow,
  };

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/disputes");
      setDisputes(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      console.error("Admin disputes load error", err);
      setError(err.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadDisputes();
  }, [loadDisputes, ready, session]);

  const filtered = useMemo(() => disputes.filter((d) => {
    const matchStatus = filter === "all" || d.status === filter;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      d.id.toLowerCase().includes(q) ||
      d.orderId.toLowerCase().includes(q) ||
      d.buyer.toLowerCase().includes(q) ||
      d.farmer.toLowerCase().includes(q) ||
      d.reason.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [disputes, filter, search]);

  const stats = {
    open: disputes.filter((d) => d.status === "open").length,
    inReview: disputes.filter((d) => d.status === "in-review").length,
    resolved: disputes.filter((d) => d.status === "resolved").length,
  };

  const handleAction = async (dbId: number, action: "review" | "refund" | "reject") => {
    if (!session?.userId) {
      setError(copy.sessionError);
      return;
    }
    if (!isOnline) {
      setError(copy.offlineError);
      return;
    }

    setActionKey(`${action}-${dbId}`);
    try {
      const updated = await apiFetch(`/disputes/${dbId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ admin_user_id: session.userId }),
      });
      setDisputes((prev) => prev.map((item) => (item.dbId === dbId ? updated : item)));
      setExpanded(updated.id);
      setError(null);
    } catch (err: any) {
      logIfNotNetworkError(`Dispute ${action} error`, err);
      setError(isLikelyNetworkError(err) ? copy.offlineError : (err.message || copy.updateError));
    } finally {
      setActionKey(null);
    }
  };

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
      subtitle={copy.subtitle}
    >
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={cn("border cursor-pointer", filter === "open" && "ring-2 ring-destructive")} onClick={() => setFilter(filter === "open" ? "all" : "open")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{stats.open}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{copy.openCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border cursor-pointer", filter === "in-review" && "ring-2 ring-accent")} onClick={() => setFilter(filter === "in-review" ? "all" : "in-review")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{stats.inReview}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{copy.reviewCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border cursor-pointer", filter === "resolved" && "ring-2 ring-primary")} onClick={() => setFilter(filter === "resolved" ? "all" : "resolved")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{copy.resolvedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadDisputes()}>
              {copy.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Disputes list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="border-border">
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              {copy.empty}
            </CardContent>
          </Card>
        )}
        {filtered.map((d) => {
          const st = statusConfig[d.status];
          const isOpen = expanded === d.id;
          return (
            <Card key={d.id} className="border-border overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isOpen ? null : d.id)}
                aria-expanded={isOpen}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Priority dot */}
                    <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", priorityConfig[d.priority])} />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground">{d.id}</span>
                        <span className="text-xs text-muted-foreground">— {d.orderId}</span>
                        <Badge className={cn("text-xs border", st.color, "flex items-center gap-1 h-auto py-0.5")}>
                          {st.icon}{st.label}
                        </Badge>
                        <Badge className={cn("text-xs border-0 h-auto py-0.5", priorityConfig[d.priority] || priorityConfig.medium)}>
                          {priorityLabels[d.priority] || "Moyen"}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{d.reason}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />{d.buyer}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />{d.farmer}
                        </span>
                        <span className="text-xs text-muted-foreground">{d.date}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatBIF(d.refundRequested)}</p>
                      <p className="text-[10px] text-muted-foreground">{copy.refundRequested}</p>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground mt-1 ml-auto transition-transform", isOpen && "rotate-180")} />
                    </div>
                  </div>
                </CardContent>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-4">
                  <p className="text-sm text-foreground">{d.detail}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-card rounded-xl p-3 border border-border">
                      <p className="text-muted-foreground mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" />{copy.orderAmount}</p>
                      <p className="font-bold text-foreground">{formatBIF(d.amount)}</p>
                    </div>
                    <div className="bg-card rounded-xl p-3 border border-border">
                      <p className="text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{copy.refundAmount}</p>
                      <p className="font-bold text-destructive">{formatBIF(d.refundRequested)}</p>
                    </div>
                    <div className="bg-card rounded-xl p-3 border border-border">
                      <p className="text-muted-foreground mb-1 flex items-center gap-1"><Truck className="w-3 h-3" />{copy.driverInvolved}</p>
                      <p className="font-bold text-foreground">{d.driver}</p>
                    </div>
                  </div>

                  {d.status === "resolved" && d.resolution && (
                    <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-xl border border-primary/20">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-primary font-medium">{d.resolution}</p>
                    </div>
                  )}

                  {d.status !== "resolved" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-border"
                        disabled={actionKey !== null || d.status === "in-review" || !isOnline}
                        onClick={() => void handleAction(d.dbId, "review")}
                      >
                        {actionKey === `review-${d.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {d.status === "in-review" ? copy.reviewInProgress : copy.takeOwnership}
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={actionKey !== null || !isOnline}
                        onClick={() => void handleAction(d.dbId, "refund")}
                      >
                        {actionKey === `refund-${d.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {copy.startRefund}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-border text-destructive hover:bg-destructive/10"
                        disabled={actionKey !== null || !isOnline}
                        onClick={() => void handleAction(d.dbId, "reject")}
                      >
                        {actionKey === `reject-${d.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {copy.reject}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}
