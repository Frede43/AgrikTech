"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileText, Loader2, Search, Wallet } from "lucide-react";

type FinanceEntityFilter = "all" | "withdrawal_request" | "dispute";
type FinanceActionFilter =
  | "all"
  | "WITHDRAWAL_REQUESTED"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_REJECTED"
  | "DISPUTE_REVIEWED"
  | "DISPUTE_REFUND_INITIATED"
  | "DISPUTE_REJECTED";

interface AdminFinanceAuditItem {
  id: string;
  action: string;
  title: string;
  detail: string;
  actorName: string | null;
  createdAt: string;
  tone: string;
  entityType: "withdrawal_request" | "dispute" | string;
  entityId: number | null;
  entityLabel: string | null;
  reference: string | null;
  priority: "low" | "medium" | "high" | string;
  status: string | null;
}

interface AdminFinanceAuditResponse {
  items: AdminFinanceAuditItem[];
  summary: {
    total: number;
    withdrawalEvents: number;
    disputeEvents: number;
    highPriorityEvents: number;
    pendingWithdrawalEvents: number;
  };
}

const priorityBadgeStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

const toneBadgeStyles: Record<string, string> = {
  info: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getPriorityLabel(priority: string | undefined, lang: "fr" | "ki") {
  if (priority === "high") return lang === "ki" ? "Ihuta" : "Priorité haute";
  if (priority === "medium") return lang === "ki" ? "Hagati" : "Priorité moyenne";
  if (priority === "low") return lang === "ki" ? "Gukurikirana" : "Suivi";
  return null;
}

function getStatusLabel(status: string | null | undefined, lang: "fr" | "ki") {
  if (status === "pending") return lang === "ki" ? "Birindiriye" : "En attente";
  if (status === "completed") return lang === "ki" ? "Vyakozwe" : "Terminé";
  if (status === "rejected") return lang === "ki" ? "Vyahakanwe" : "Rejeté";
  if (status === "open") return lang === "ki" ? "Biruguruye" : "Ouvert";
  if (status === "in-review") return lang === "ki" ? "Biriko birasuzumwa" : "En revue";
  if (status === "resolved") return lang === "ki" ? "Vyatunganijwe" : "Résolu";
  return status || null;
}

function getActionLabel(action: string, lang: "fr" | "ki") {
  switch (action) {
    case "WITHDRAWAL_REQUESTED":
      return lang === "ki" ? "Kubikuza kwasabwe" : "Demande créée";
    case "WITHDRAWAL_APPROVED":
      return lang === "ki" ? "Kubikuza kwemejwe" : "Retrait approuvé";
    case "WITHDRAWAL_REJECTED":
      return lang === "ki" ? "Kubikuza kwahakanywe" : "Retrait rejeté";
    case "DISPUTE_REVIEWED":
      return lang === "ki" ? "Impari yasubiwemwo" : "Litige en revue";
    case "DISPUTE_REFUND_INITIATED":
      return lang === "ki" ? "Gusubiza amafaranga vyatangujwe" : "Remboursement lancé";
    case "DISPUTE_REJECTED":
      return lang === "ki" ? "Impari yahakanywe" : "Litige rejeté";
    default:
      return action;
  }
}

export default function AdminFinanceAuditsPage() {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const [data, setData] = useState<AdminFinanceAuditResponse>({
    items: [],
    summary: { total: 0, withdrawalEvents: 0, disputeEvents: 0, highPriorityEvents: 0, pendingWithdrawalEvents: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<FinanceEntityFilter>("all");
  const [action, setAction] = useState<FinanceActionFilter>("all");
  const [search, setSearch] = useState("");
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = {
    fr: {
      title: "Audits finance",
      subtitle: "{count} événement(s) finance après filtrage",
      loadingSubtitle: "Chargement de l’historique consolidé retraits et litiges",
      syncing: "Synchronisation des audits finance...",
      loadError: "Impossible de charger les audits finance.",
      totalEvents: "Total événements",
      withdrawalEvents: "Événements retraits",
      disputeEvents: "Événements litiges",
      pendingWithdrawals: "Retraits en attente",
      searchPlaceholder: "Rechercher par référence, action, acteur ou détail...",
      allEntities: "Toutes les entités",
      withdrawals: "Retraits",
      disputes: "Litiges",
      allActions: "Toutes les actions",
      retry: "Réessayer",
      empty: "Aucun audit finance ne correspond aux filtres actuels.",
      withdrawalEntity: "Retrait fermier",
      disputeEntity: "Litige financier",
    },
    ki: {
      title: "Igenzura ry'imari",
      subtitle: "Ibikorwa {count} vy'imari nyuma yo gushungura",
      loadingSubtitle: "Turiko turategura amateka ahuriweko ya kubikuza n'impari",
      syncing: "Turiko turahuza igenzura ry'imari...",
      loadError: "Ntivyashobotse kuronka igenzura ry'imari.",
      totalEvents: "Ibikorwa vyose",
      withdrawalEvents: "Ibikorwa vya kubikuza",
      disputeEvents: "Ibikorwa vy'impari",
      pendingWithdrawals: "Kubikuza kurindiriye",
      searchPlaceholder: "Rondera ukoresheje reference, igikorwa, uwabikoze canke insiguro...",
      allEntities: "Ibintu vyose",
      withdrawals: "Kubikuza",
      disputes: "Impari",
      allActions: "Ibikorwa vyose",
      retry: "Subiramwo",
      empty: "Nta genzura ry'imari rihuye n'ivyo wasuzumye.",
      withdrawalEntity: "Kubikuza kw'umurimyi",
      disputeEntity: "Impari y'imari",
    },
  }[lang];

  const loadAudits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType !== "all") params.set("entity_type", entityType);
      if (action !== "all") params.set("action", action);
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", "60");
      const response = await apiFetch(`/admin/finance-audits?${params.toString()}`);
      setData({
        items: Array.isArray(response?.items) ? response.items : [],
        summary: response?.summary || { total: 0, withdrawalEvents: 0, disputeEvents: 0, highPriorityEvents: 0, pendingWithdrawalEvents: 0 },
      });
      setError(null);
    } catch (error: unknown) {
      console.error("Admin finance audits load error", error);
      setError(getErrorMessage(error, copy.loadError));
    } finally {
      setLoading(false);
    }
  }, [action, copy.loadError, entityType, search]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadAudits();
  }, [loadAudits, ready, session]);

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
    <AdminLayout title={copy.title} subtitle={copy.subtitle.replace("{count}", String(data.summary.total))}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          [copy.totalEvents, data.summary.total, <FileText className="w-5 h-5 text-primary" key="total" />],
          [copy.withdrawalEvents, data.summary.withdrawalEvents, <Wallet className="w-5 h-5 text-primary" key="withdrawals" />],
          [copy.disputeEvents, data.summary.disputeEvents, <AlertTriangle className="w-5 h-5 text-destructive" key="disputes" />],
          [copy.pendingWithdrawals, data.summary.pendingWithdrawalEvents, <Search className="w-5 h-5 text-amber-600" key="pending" />],
        ].map(([label, value, icon]) => (
          <Card key={String(label)} className="border-border">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">{icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_260px] gap-3">
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
        <select
          value={entityType}
          onChange={(event) => setEntityType(event.target.value as FinanceEntityFilter)}
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{copy.allEntities}</option>
          <option value="withdrawal_request">{copy.withdrawals}</option>
          <option value="dispute">{copy.disputes}</option>
        </select>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value as FinanceActionFilter)}
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{copy.allActions}</option>
          <option value="WITHDRAWAL_REQUESTED">{getActionLabel("WITHDRAWAL_REQUESTED", lang)}</option>
          <option value="WITHDRAWAL_APPROVED">{getActionLabel("WITHDRAWAL_APPROVED", lang)}</option>
          <option value="WITHDRAWAL_REJECTED">{getActionLabel("WITHDRAWAL_REJECTED", lang)}</option>
          <option value="DISPUTE_REVIEWED">{getActionLabel("DISPUTE_REVIEWED", lang)}</option>
          <option value="DISPUTE_REFUND_INITIATED">{getActionLabel("DISPUTE_REFUND_INITIATED", lang)}</option>
          <option value="DISPUTE_REJECTED">{getActionLabel("DISPUTE_REJECTED", lang)}</option>
        </select>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadAudits()}>
              {copy.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data.items.length === 0 && !error && (
          <Card className="border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {copy.empty}
            </CardContent>
          </Card>
        )}

        {data.items.map((item) => {
          const priorityLabel = getPriorityLabel(item.priority, lang);
          const statusLabel = getStatusLabel(item.status, lang);
          const entityIcon = item.entityType === "withdrawal_request" ? <Wallet className="w-5 h-5 text-primary" /> : <AlertTriangle className="w-5 h-5 text-destructive" />;

          return (
            <Card key={item.id} className="border-border overflow-hidden">
              <CardContent className="p-4 flex gap-4">
                <div className="w-11 h-11 rounded-2xl border border-border bg-muted/30 flex items-center justify-center shrink-0">
                  {entityIcon}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{item.title}</p>
                        {item.reference && <Badge variant="outline" className="text-[10px] h-auto py-0.5">{item.reference}</Badge>}
                        <Badge className={cn("text-[10px] border h-auto py-0.5", toneBadgeStyles[item.tone] || toneBadgeStyles.neutral)}>
                          {getActionLabel(item.action, lang)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.entityLabel || (item.entityType === "withdrawal_request" ? copy.withdrawalEntity : copy.disputeEntity)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.createdAt, locale)}</span>
                  </div>

                  <p className="text-sm text-foreground/85">{item.detail}</p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.actorName && <Badge variant="outline" className="text-[10px] h-auto py-0.5">{item.actorName}</Badge>}
                    {statusLabel && <Badge variant="outline" className="text-[10px] h-auto py-0.5">{statusLabel}</Badge>}
                    {priorityLabel && (
                      <Badge className={cn("text-[10px] border h-auto py-0.5", priorityBadgeStyles[item.priority] || priorityBadgeStyles.low)}>
                        {priorityLabel}
                      </Badge>
                    )}
                    {item.priority === "high" && !priorityLabel && (
                      <Badge className={cn("text-[10px] border h-auto py-0.5", priorityBadgeStyles.high)}>{getPriorityLabel("high", lang)}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}