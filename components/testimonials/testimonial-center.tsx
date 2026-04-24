"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/LanguageContext";
import { apiFetch } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Send, Star } from "lucide-react";

type TestimonialRole = "acheteur" | "fermier";

interface SubmittedTestimonial {
  id: number;
  quote_fr: string;
  quote_ki: string;
  author_name: string;
  author_role_fr: string;
  author_role_ki: string;
  location: string | null;
  rating: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

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

export function TestimonialCenter({ role }: { role: TestimonialRole }) {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession(role);
  const [items, setItems] = useState<SubmittedTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = {
    fr: {
      intro:
        role === "acheteur"
          ? "Partagez brièvement votre expérience d'achat. Après validation admin, votre témoignage pourra apparaître sur la page d'accueil."
          : "Partagez brièvement votre expérience de vente sur AgriConnect. Après validation admin, votre témoignage pourra apparaître sur la page d'accueil.",
      loadError: "Impossible de charger vos témoignages.",
      submitError: "Impossible d'envoyer votre témoignage.",
      required: "Veuillez saisir un message pour votre témoignage.",
      formTitle: "Soumettre un témoignage",
      rating: "Note",
      message: "Message",
      messagePlaceholder: "Décrivez en quelques lignes ce que vous appréciez, ce qui vous a aidé ou votre résultat obtenu.",
      submit: "Envoyer pour validation",
      sent: "Votre témoignage a bien été envoyé en attente de validation.",
      recent: "Mes témoignages récents",
      empty: "Vous n'avez encore soumis aucun témoignage.",
      statusPending: "En attente",
      statusApproved: "Approuvé",
      statusRejected: "Refusé",
      createdAt: "Soumis le {date}",
      reviewedAt: "Traité le {date}",
      moderationNote: "Note admin",
      locationFallback: "Localisation non renseignée",
      publicationHint: "Les témoignages approuvés sont publiés automatiquement sur l'accueil.",
      loading: "Chargement des témoignages…",
    },
    ki: {
      intro:
        role === "acheteur"
          ? "Andika muri make uko vyagenze mu kugura kwawe. Admin amaze kubisuzuma, bishobora kugaragara ku rubuga rw'intango."
          : "Andika muri make uko vyagenze mu kugurisha kwawe kuri AgriConnect. Admin amaze kubisuzuma, bishobora kugaragara ku rubuga rw'intango.",
      loadError: "Ntivyashobotse kuronka ivyagiriza vyawe.",
      submitError: "Ntivyashobotse kohereza ivyagiriza vyawe.",
      required: "Andika ubutumwa bw'ivyagiriza vyawe.",
      formTitle: "Rungika ivyagiriza",
      rating: "Amanota",
      message: "Ubutumwa",
      messagePlaceholder: "Sigura muri make ico washimye, ico vyagufashije canke ivyamwa wabonye.",
      submit: "Rungika ngo bisuzumwe",
      sent: "Ivyagiriza vyawe vyarungitswe, birindiriye gusuzumwa.",
      recent: "Ivyagiriza vya vuba",
      empty: "Nta vyagiriza urarungika.",
      statusPending: "Birindiriye",
      statusApproved: "Vyemejwe",
      statusRejected: "Vyahakanywe",
      createdAt: "Vyatanzwe {date}",
      reviewedAt: "Vyasuzumwe {date}",
      moderationNote: "Iciyumviro ca admin",
      locationFallback: "Aho uherereye ntihuzujwe",
      publicationHint: "Ivyagiriza vyemejwe bishirwa ku rubuga rw'intango vyikora.",
      loading: "Turiko turategura ivyagiriza…",
    },
  }[lang];

  const statusConfig = useMemo(
    () => ({
      pending: { label: copy.statusPending, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20" },
      approved: { label: copy.statusApproved, className: "bg-primary/10 text-primary border-primary/20" },
      rejected: { label: copy.statusRejected, className: "bg-destructive/10 text-destructive border-destructive/20" },
    }),
    [copy.statusApproved, copy.statusPending, copy.statusRejected],
  );

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    apiFetch("/testimonials/me")
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err: unknown) => {
        logIfNotNetworkError("Testimonials load error", err);
        setError(getDisplayErrorMessage(err, copy.loadError));
      })
      .finally(() => setLoading(false));
  }, [copy.loadError, ready, session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;

    if (!message.trim()) {
      setError(copy.required);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const created = await apiFetch("/testimonials", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          rating,
        }),
      });
      setItems((current) => [created, ...current]);
      setMessage("");
      setRating(5);
      setFeedback(copy.sent);
    } catch (err: unknown) {
      logIfNotNetworkError("Testimonial submit error", err);
      setError(getDisplayErrorMessage(err, copy.submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">{copy.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-foreground/80">{copy.publicationHint}</CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.formTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{copy.intro}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{copy.rating}</label>
                <select
                  value={rating}
                  onChange={(event) => setRating(Number(event.target.value))}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value}/5
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1 text-amber-400">{renderStars(rating)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{copy.message}</label>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={copy.messagePlaceholder}
                  className="min-h-32"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {feedback && <p className="text-sm text-primary">{feedback}</p>}

              <Button type="submit" disabled={submitting || !message.trim()} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {copy.submit}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.recent}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                {copy.empty}
              </div>
            ) : (
              items.map((item) => {
                const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pending;
                const body = lang === "ki" ? item.quote_ki || item.quote_fr : item.quote_fr || item.quote_ki;

                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{item.author_name}</p>
                          <Badge className={cn("border text-xs", status.className)}>{status.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.location || copy.locationFallback}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400">{renderStars(item.rating)}</div>
                    </div>

                    <p className="text-sm text-foreground leading-6">“{body}”</p>

                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span>{copy.createdAt.replace("{date}", formatDate(item.created_at, locale))}</span>
                      {item.reviewed_at && (
                        <span>{copy.reviewedAt.replace("{date}", formatDate(item.reviewed_at, locale))}</span>
                      )}
                    </div>

                    {item.admin_note && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{copy.moderationNote}</p>
                        <p className="mt-1 text-sm text-foreground">{item.admin_note}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}