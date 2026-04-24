"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/LanguageContext";
import { apiFetch } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, Loader2, Search, Star, XCircle } from "lucide-react";

type TestimonialStatus = "pending" | "approved" | "rejected";
type TestimonialFilter = "all" | TestimonialStatus;

interface AdminAuditEvent {
  id: string;
  action: string;
  title: string;
  detail: string;
  actorName: string | null;
  createdAt: string;
  tone: string;
}

interface AdminTestimonialRecord {
  id: string;
  dbId: number;
  userId: number | null;
  authorName: string;
  authorRoleFr: string;
  authorRoleKi: string;
  location: string | null;
  quoteFr: string;
  quoteKi: string;
  rating: number;
  status: TestimonialStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByUserId: number | null;
  reviewedByName: string | null;
  auditTrail: AdminAuditEvent[];
}

const auditToneStyles: Record<string, { dot: string; badge: string }> = {
  info: { dot: "bg-primary", badge: "bg-primary/10 text-primary border-primary/20" },
  success: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  danger: { dot: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  neutral: { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={`${rating}-${index}`}
      className={cn("h-4 w-4", index < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35")}
    />
  ));
}

export function AdminTestimonialModeration() {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const [items, setItems] = useState<AdminTestimonialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TestimonialFilter>("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = {
    fr: {
      loading: "Chargement des témoignages à modérer...",
      loadError: "Impossible de charger les témoignages.",
      updateError: "Impossible de mettre à jour ce témoignage.",
      sessionError: "Session administrateur introuvable.",
      retry: "Réessayer",
      statusPending: "En attente",
      statusApproved: "Approuvé",
      statusRejected: "Refusé",
      pendingLabel: "À valider",
      approvedLabel: "Publiés",
      rejectedLabel: "Refusés",
      searchPlaceholder: "Rechercher par ID, auteur, localisation ou contenu...",
      empty: "Aucun témoignage ne correspond aux filtres actuels.",
      submittedOn: "Soumis le {date}",
      processedOn: "Traité le {date}",
      processing: "Traitement",
      waitingDecision: "En attente de décision",
      location: "Localisation",
      locationMissing: "Non renseignée",
      userRole: "Rôle",
      adminNote: "Note admin",
      auditHistory: "Historique / audit",
      notePlaceholder: "Note admin optionnelle (motif de validation, précision avant rejet, contexte interne...)",
      approve: "Approuver et publier",
      reject: "Refuser",
    },
    ki: {
      loading: "Turiko turategura ivyagiriza bisaba gusuzumwa...",
      loadError: "Ntivyashobotse kuronka ivyagiriza.",
      updateError: "Ntivyashobotse guhindura iki kigirizwa.",
      sessionError: "Session ya admin ntibonetse.",
      retry: "Subiramwo",
      statusPending: "Birindiriye",
      statusApproved: "Vyemejwe",
      statusRejected: "Vyahakanywe",
      pendingLabel: "Bisaba kwemezwa",
      approvedLabel: "Vyashizwe ahabona",
      rejectedLabel: "Vyahakanywe",
      searchPlaceholder: "Rondera ukoresheje ID, uwabitanze, aho aherereye canke ubutumwa...",
      empty: "Nta vyagiriza bihuye n'ivyo wasuzumye.",
      submittedOn: "Vyatanzwe {date}",
      processedOn: "Vyasuzumwe {date}",
      processing: "Itunganywa",
      waitingDecision: "Birindiriye ingingo",
      location: "Aho aherereye",
      locationMissing: "Ntihuzujwe",
      userRole: "Uruhara",
      adminNote: "Iciyumviro ca admin",
      auditHistory: "Amateka / igenzura",
      notePlaceholder: "Iciyumviro ca admin kidategerezwa (imvo yo kwemeza, gutomora imbere yo guhakanwa, ibindi...)",
      approve: "Emeza kandi ushire ahabona",
      reject: "Hakana",
    },
  }[lang];

  const statusConfig: Record<TestimonialStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: copy.statusPending, color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20", icon: <Clock3 className="w-3 h-3" /> },
    approved: { label: copy.statusApproved, color: "bg-primary/10 text-primary border-primary/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    rejected: { label: copy.statusRejected, color: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="w-3 h-3" /> },
  };

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/testimonials");
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: unknown) {
      logIfNotNetworkError("Admin testimonials load error", err);
      setError(getDisplayErrorMessage(err, copy.loadError));
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadTestimonials();
  }, [loadTestimonials, ready, session]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesStatus = filter === "all" || item.status === filter;
      const body = `${item.quoteFr} ${item.quoteKi}`.toLowerCase();
      const matchesSearch =
        !query ||
        item.id.toLowerCase().includes(query) ||
        item.authorName.toLowerCase().includes(query) ||
        (item.location || "").toLowerCase().includes(query) ||
        body.includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [filter, items, search]);

  const stats = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "pending").length,
      approved: items.filter((item) => item.status === "approved").length,
      rejected: items.filter((item) => item.status === "rejected").length,
    }),
    [items],
  );

  const handleAction = useCallback(
    async (item: AdminTestimonialRecord, action: "approve" | "reject") => {
      if (!session?.userId) {
        setError(copy.sessionError);
        return;
      }

      const note = (notes[item.dbId] || "").trim();
      setActionKey(`${action}-${item.dbId}`);

      try {
        await apiFetch(`/admin/testimonials/${item.dbId}/${action}`, {
          method: "POST",
          body: JSON.stringify({
            admin_user_id: session.userId,
            ...(note ? { note } : {}),
          }),
        });
        setNotes((prev) => {
          const next = { ...prev };
          delete next[item.dbId];
          return next;
        });
        await loadTestimonials();
        setError(null);
      } catch (err: unknown) {
        logIfNotNetworkError(`Admin testimonial ${action} error`, err);
        setError(getDisplayErrorMessage(err, copy.updateError));
      } finally {
        setActionKey(null);
      }
    },
    [copy.sessionError, copy.updateError, loadTestimonials, notes, session],
  );

  if (!ready || loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          ["pending", copy.pendingLabel, stats.pending],
          ["approved", copy.approvedLabel, stats.approved],
          ["rejected", copy.rejectedLabel, stats.rejected],
        ].map(([key, label, count]) => (
          <Card
            key={key}
            className={cn("border cursor-pointer", filter === key && "ring-2 ring-primary")}
            onClick={() => setFilter(filter === key ? "all" : (key as TestimonialFilter))}
          >
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
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
            <Button size="sm" variant="outline" onClick={() => void loadTestimonials()}>
              {copy.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">{copy.empty}</CardContent>
          </Card>
        )}

        {filtered.map((item) => {
          const status = statusConfig[item.status];
          const currentAction = actionKey && actionKey.endsWith(`-${item.dbId}`) ? actionKey : null;
          const body = lang === "ki" ? item.quoteKi || item.quoteFr : item.quoteFr || item.quoteKi;
          const roleLabel = lang === "ki" ? item.authorRoleKi : item.authorRoleFr;

          return (
            <Card key={item.id} className="border-border overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{item.id}</span>
                      <Badge className={cn("text-xs border h-auto py-0.5 flex items-center gap-1", status.color)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{item.authorName}</p>
                    <div className="mt-2 flex items-center gap-1 text-amber-400">{renderStars(item.rating)}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge className="bg-muted text-muted-foreground border-border">{roleLabel}</Badge>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {copy.submittedOn.replace("{date}", formatDate(item.createdAt, locale))}
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-6 text-foreground">“{body}”</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground mb-1">{copy.location}</p>
                    <p className="font-bold text-foreground">{item.location || copy.locationMissing}</p>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground mb-1">{copy.userRole}</p>
                    <p className="font-bold text-foreground">{roleLabel}</p>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground mb-1">{copy.processing}</p>
                    <p className="font-bold text-foreground">
                      {item.reviewedAt
                        ? `${copy.processedOn.replace("{date}", formatDate(item.reviewedAt, locale))}${item.reviewedByName ? ` · ${item.reviewedByName}` : ""}`
                        : copy.waitingDecision}
                    </p>
                  </div>
                </div>

                {item.adminNote && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{copy.adminNote}</p>
                    <p className="text-sm text-foreground mt-1">{item.adminNote}</p>
                  </div>
                )}

                {item.auditTrail.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{copy.auditHistory}</p>
                    <div className="mt-3 space-y-3">
                      {item.auditTrail.map((event) => {
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

                {item.status === "pending" && (
                  <div className="space-y-3">
                    <Textarea
                      value={notes[item.dbId] ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({
                          ...prev,
                          [item.dbId]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder={copy.notePlaceholder}
                      className="min-h-24"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={actionKey !== null}
                        onClick={() => void handleAction(item, "approve")}
                      >
                        {currentAction === `approve-${item.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {copy.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-border text-destructive hover:bg-destructive/10"
                        disabled={actionKey !== null}
                        onClick={() => void handleAction(item, "reject")}
                      >
                        {currentAction === `reject-${item.dbId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
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
    </div>
  );
}