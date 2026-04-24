"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBIF } from "@/lib/currency";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, Loader2, Search, Wallet, XCircle } from "lucide-react";

type WithdrawalStatus = "pending" | "completed" | "rejected";
type WithdrawalFilter = "all" | WithdrawalStatus;

interface AdminAuditEvent {
  id: string;
  action: string;
  title: string;
  detail: string;
  actorName: string | null;
  createdAt: string;
  tone: string;
}

interface AdminWithdrawalRecord {
  id: string;
  dbId: number;
  farmerId: number;
  farmerName: string;
  farmerPhoneNumber: string | null;
  province: string | null;
  amount: number;
  channel: string;
  phoneNumber: string | null;
  status: WithdrawalStatus;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
  processedByUserId: number | null;
  processedByName: string | null;
  auditTrail: AdminAuditEvent[];
}

const statusStyles: Record<WithdrawalStatus, { color: string; icon: React.ReactNode }> = {
  pending: {
    color: "bg-accent/30 text-accent-foreground border-accent/40",
    icon: <Clock3 className="w-3 h-3" />,
  },
  completed: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const auditToneStyles: Record<string, { dot: string; badge: string }> = {
  info: {
    dot: "bg-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  success: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  danger: {
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
  },
  neutral: {
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminWithdrawalsPage() {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WithdrawalFilter>("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = {
    fr: {
      title: "Validation des retraits",
      subtitle: "Décider les demandes manuelles de décaissement fermier",
      loadingSubtitle: "Chargement de la file de validation manuelle",
      syncing: "Synchronisation des retraits manuels...",
      loadError: "Impossible de charger les retraits manuels.",
      sessionError: "Session administrateur introuvable.",
      updateError: "Impossible de mettre à jour ce retrait.",
      statusPending: "En attente",
      statusCompleted: "Terminé",
      statusRejected: "Rejeté",
      pendingLabel: "À valider",
      completedLabel: "Traités",
      rejectedLabel: "Rejetés",
      searchPlaceholder: "Rechercher par ID, fermier, téléphone ou canal...",
      retry: "Réessayer",
      empty: "Aucune demande de retrait ne correspond aux filtres actuels.",
      provinceMissing: "Province non renseignée",
      farmerPhoneMissing: "Téléphone fermier indisponible",
      destination: "Destination",
      destinationMissing: "Non renseignée",
      requestedOn: "Demandé le {date}",
      channel: "Canal",
      destinationPhone: "Téléphone de destination",
      destinationPhoneMissing: "Non renseigné",
      processing: "Traitement",
      waitingDecision: "En attente de décision",
      adminNote: "Note admin",
      auditHistory: "Historique / audit",
      notePlaceholder: "Note admin optionnelle (preuve reçue, canal validé, motif de rejet...)",
      approve: "Approuver le retrait",
      reject: "Rejeter la demande",
    },
    ki: {
      title: "Kwemeza kubikuza",
      subtitle: "Gufata ingingo ku busabe bwo kubikuza bw'abarimyi",
      loadingSubtitle: "Turiko turategura urutonde rwo kwemeza n'intoki",
      syncing: "Turiko turahuza kubikuza kw'intoki...",
      loadError: "Ntivyashobotse kuronka kubikuza kw'intoki.",
      sessionError: "Session ya admin ntibonetse.",
      updateError: "Ntivyashobotse guhindura uku kubikuza.",
      statusPending: "Birindiriye",
      statusCompleted: "Vyakozwe",
      statusRejected: "Vyahakanwe",
      pendingLabel: "Bikeneye kwemezwa",
      completedLabel: "Vyatunganyijwe",
      rejectedLabel: "Vyahakanwe",
      searchPlaceholder: "Rondera ukoresheje ID, umurimyi, telefone canke uburyo...",
      retry: "Subiramwo",
      empty: "Nta busabe bwo kubikuza buhuye n'ivyo wasuzumye.",
      provinceMissing: "Intara ntiyuzujwe",
      farmerPhoneMissing: "Telefone y'umurimyi ntihari",
      destination: "Aho vyoherezwa",
      destinationMissing: "Ntihuzujwe",
      requestedOn: "Byasabwe ku {date}",
      channel: "Uburyo",
      destinationPhone: "Telefone yo koherezako",
      destinationPhoneMissing: "Ntihuzujwe",
      processing: "Itunganywa",
      waitingDecision: "Birindiriye ingingo",
      adminNote: "Iciyumviro ca admin",
      auditHistory: "Amateka / igenzura",
      notePlaceholder: "Iciyumviro ca admin kidategerezwa (ikimenyamenya, uburyo bwemejwe, imvo yo guhakanwa...)",
      approve: "Emeza kubikuza",
      reject: "Hakana ubusabe",
    },
  }[lang];
  const statusConfig: Record<WithdrawalStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { ...statusStyles.pending, label: copy.statusPending },
    completed: { ...statusStyles.completed, label: copy.statusCompleted },
    rejected: { ...statusStyles.rejected, label: copy.statusRejected },
  };

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/withdrawals");
      setWithdrawals(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error: unknown) {
      console.error("Admin withdrawals load error", error);
      setError(getErrorMessage(error, copy.loadError));
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadWithdrawals();
  }, [loadWithdrawals, ready, session]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return withdrawals.filter((item) => {
      const matchesStatus = filter === "all" || item.status === filter;
      const matchesSearch =
        !query ||
        item.id.toLowerCase().includes(query) ||
        item.farmerName.toLowerCase().includes(query) ||
        (item.farmerPhoneNumber || "").toLowerCase().includes(query) ||
        (item.phoneNumber || "").toLowerCase().includes(query) ||
        item.channel.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [filter, search, withdrawals]);

  const stats = useMemo(
    () => ({
      pending: withdrawals.filter((item) => item.status === "pending").length,
      completed: withdrawals.filter((item) => item.status === "completed").length,
      rejected: withdrawals.filter((item) => item.status === "rejected").length,
    }),
    [withdrawals],
  );

  const handleAction = useCallback(
    async (withdrawal: AdminWithdrawalRecord, action: "approve" | "reject") => {
      if (!session?.userId) {
        setError(copy.sessionError);
        return;
      }

      const note = (notes[withdrawal.dbId] || "").trim();
      setActionKey(`${action}-${withdrawal.dbId}`);

      try {
        await apiFetch(`/admin/withdrawals/${withdrawal.dbId}/${action}`, {
          method: "POST",
          body: JSON.stringify({
            admin_user_id: session.userId,
            ...(note ? { note } : {}),
          }),
        });
        setNotes((prev) => {
          const next = { ...prev };
          delete next[withdrawal.dbId];
          return next;
        });
        await loadWithdrawals();
        setError(null);
      } catch (error: unknown) {
        console.error(`Withdrawal ${action} error`, error);
        setError(getErrorMessage(error, copy.updateError));
      } finally {
        setActionKey(null);
      }
    },
    [copy.sessionError, copy.updateError, loadWithdrawals, notes, session],
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
    <AdminLayout title={copy.title} subtitle={copy.subtitle}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          ["pending", copy.pendingLabel, stats.pending],
          ["completed", copy.completedLabel, stats.completed],
          ["rejected", copy.rejectedLabel, stats.rejected],
        ].map(([key, label, count]) => (
          <Card
            key={key}
            className={cn("border cursor-pointer", filter === key && "ring-2 ring-primary")}
            onClick={() => setFilter(filter === key ? "all" : (key as WithdrawalFilter))}
          >
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadWithdrawals()}>
              {copy.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {copy.empty}
            </CardContent>
          </Card>
        )}

        {filtered.map((withdrawal) => {
          const status = statusConfig[withdrawal.status];
          const currentAction = actionKey && actionKey.endsWith(`-${withdrawal.dbId}`) ? actionKey : null;

          return (
            <Card key={withdrawal.id} className="border-border overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{withdrawal.id}</span>
                      <Badge className={cn("text-xs border h-auto py-0.5 flex items-center gap-1", status.color)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{withdrawal.channel}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{withdrawal.farmerName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span>{withdrawal.province || copy.provinceMissing}</span>
                      <span>{withdrawal.farmerPhoneNumber || copy.farmerPhoneMissing}</span>
                      <span>{copy.destination}: {withdrawal.phoneNumber || copy.destinationMissing}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-foreground">{formatBIF(withdrawal.amount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{copy.requestedOn.replace("{date}", formatDate(withdrawal.createdAt, locale))}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground mb-1">{copy.channel}</p>
                    <p className="font-bold text-foreground">{withdrawal.channel}</p>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground mb-1">{copy.destinationPhone}</p>
                    <p className="font-bold text-foreground">{withdrawal.phoneNumber || copy.destinationPhoneMissing}</p>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground mb-1">{copy.processing}</p>
                    <p className="font-bold text-foreground">
                      {withdrawal.processedAt
                        ? `${formatDate(withdrawal.processedAt, locale)}${withdrawal.processedByName ? ` · ${withdrawal.processedByName}` : ""}`
                        : copy.waitingDecision}
                    </p>
                  </div>
                </div>

                {withdrawal.note && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{copy.adminNote}</p>
                    <p className="text-sm text-foreground mt-1">{withdrawal.note}</p>
                  </div>
                )}

                {withdrawal.auditTrail.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{copy.auditHistory}</p>
                    <div className="mt-3 space-y-3">
                      {withdrawal.auditTrail.map((event) => {
                        const tone = auditToneStyles[event.tone] || auditToneStyles.neutral;
                        return (
                          <div key={event.id} className="flex gap-3">
                            <div className="pt-1.5">
                              <div className={cn("w-2.5 h-2.5 rounded-full", tone.dot)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{event.title}</p>
                                <Badge className={cn("text-[10px] border h-auto py-0.5", tone.badge)}>
                                  {formatDate(event.createdAt, locale)}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {event.actorName ? `${event.actorName} · ` : ""}
                                {event.action}
                              </p>
                              <p className="text-sm text-foreground/80 mt-1">{event.detail}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {withdrawal.status === "pending" && (
                  <div className="space-y-3">
                    <textarea
                      value={notes[withdrawal.dbId] ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({
                          ...prev,
                          [withdrawal.dbId]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder={copy.notePlaceholder}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={actionKey !== null}
                        onClick={() => void handleAction(withdrawal, "approve")}
                      >
                        {currentAction === `approve-${withdrawal.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {copy.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-border text-destructive hover:bg-destructive/10"
                        disabled={actionKey !== null}
                        onClick={() => void handleAction(withdrawal, "reject")}
                      >
                        {currentAction === `reject-${withdrawal.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {copy.reject}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}