"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, type CanonicalRole } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { HelpCircle, Loader2, MessageCircle, Phone, RefreshCw, Send } from "lucide-react";

interface PlatformSettings {
  support_phone: string;
  support_whatsapp: string;
}

interface SupportTicket {
  id: number;
  user_id: number;
  role: string;
  channel: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface SupportFaq {
  question: string;
  answer: string;
}

interface SupportCenterProps {
  role: CanonicalRole;
  whatsappTitle: string;
  whatsappDescription: string;
  phoneTitle: string;
  phoneDescription: string;
  ticketIntro: string;
  faqs?: SupportFaq[];
}

const sanitizePhone = (value?: string | null) => (value || "").replace(/[^0-9]/g, "");

const formatTicketDate = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SupportCenter({
  role,
  whatsappTitle,
  whatsappDescription,
  phoneTitle,
  phoneDescription,
  ticketIntro,
  faqs = [],
}: SupportCenterProps) {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession(role);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = {
    fr: {
      statusOpen: "Ouvert",
      statusResolved: "Résolu",
      loadError: "Impossible de charger le support.",
      requiredFields: "Veuillez renseigner un sujet et un message.",
      sent: "Votre demande a été transmise au support.",
      sendError: "Impossible d'envoyer la demande.",
      loading: "Chargement du centre de support…",
      whatsapp: "Ouvrir WhatsApp",
      unavailable: "Contact indisponible",
      create: "Créer une demande",
      subject: "Sujet",
      subjectPlaceholder: "Ex. livraison, paiement, accès compte…",
      message: "Message",
      messagePlaceholder: "Décrivez votre besoin ou le problème rencontré.",
      submit: "Envoyer au support",
      recent: "Mes demandes récentes",
      empty: "Aucune demande envoyée pour le moment.",
      channel: "Canal",
      faqs: "Questions fréquentes",
    },
    ki: {
      statusOpen: "Biruguruye",
      statusResolved: "Vyatunganijwe",
      loadError: "Ntivyashobotse kuronka ubufasha.",
      requiredFields: "Shiramwo umutwe n'ubutumwa.",
      sent: "Ubutumwa bwawe bwoherejwe ku bufasha.",
      sendError: "Ntivyashobotse kohereza ubusabe.",
      loading: "Turiko turategura ikigo c'ubufasha…",
      whatsapp: "Fungura WhatsApp",
      unavailable: "Nta contact ihari",
      create: "Rungika ubusabe",
      subject: "Umutwe",
      subjectPlaceholder: "Nk'ishikanwa, ukwishura, canke konti…",
      message: "Ubutumwa",
      messagePlaceholder: "Sigura ico ukeneye canke ikibazo wahuye na co.",
      submit: "Rungika ku bufasha",
      recent: "Ubusabe bwa vuba",
      empty: "Nta busabe urarungika.",
      channel: "Umuhora",
      faqs: "Ibibazo bikunda kubazwa",
    },
  }[lang];
  const statusLabels: Record<string, string> = {
    open: copy.statusOpen,
    resolved: copy.statusResolved,
  };

  const loadData = async (userId: number) => {
    const [settingsData, ticketsData] = await Promise.all([
      apiFetch("/platform/settings"),
      apiFetch(`/support/tickets/${userId}`),
    ]);
    setSettings(settingsData);
    setTickets(ticketsData);
  };

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    loadData(session.userId)
      .then(() => setError(null))
      .catch((err: unknown) => {
        logIfNotNetworkError("Support fetch error", err);
        setError(getDisplayErrorMessage(err, copy.loadError));
      })
      .finally(() => setLoading(false));
  }, [ready, session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;

    if (!subject.trim() || !message.trim()) {
      setError(copy.requiredFields);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const ticket = await apiFetch("/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          user_id: session.userId,
          channel: "app",
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      setTickets((current) => [ticket, ...current]);
      setSubject("");
      setMessage("");
      setFeedback(copy.sent);
    } catch (err: unknown) {
      logIfNotNetworkError("Support ticket error", err);
      setError(getDisplayErrorMessage(err, copy.sendError));
    } finally {
      setSubmitting(false);
    }
  };

  const openPhone = () => {
    if (settings?.support_phone) {
      window.open(`tel:${settings.support_phone}`);
    }
  };

  const openWhatsapp = () => {
    const digits = sanitizePhone(settings?.support_whatsapp);
    if (digits) {
      window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
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
    <div className="space-y-8">
      <div className="grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{whatsappTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{whatsappDescription}</p>
            </div>
            <Button
              type="button"
              className="mt-2 w-full gap-2 bg-green-600 text-white hover:bg-green-700"
              onClick={openWhatsapp}
              disabled={!settings?.support_whatsapp}
            >
              <MessageCircle className="h-4 w-4" />
              {copy.whatsapp}
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Phone className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{phoneTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{phoneDescription}</p>
            </div>
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={openPhone} disabled={!settings?.support_phone}>
              <Phone className="mr-2 h-4 w-4" />
              {settings?.support_phone || copy.unavailable}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{copy.create}</CardTitle>
            <p className="text-sm text-muted-foreground">{ticketIntro}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{copy.subject}</label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={copy.subjectPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{copy.message}</label>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={copy.messagePlaceholder}
                  className="min-h-28"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {feedback && <p className="text-sm text-primary">{feedback}</p>}

              <Button type="submit" disabled={submitting || !subject.trim() || !message.trim()} className="gap-2">
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
            {tickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                {copy.empty}
              </div>
            ) : (
              tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{ticket.subject}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{ticket.message}</p>
                    </div>
                    <Badge
                      className={cn(
                        "border-0",
                        ticket.status === "resolved"
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {statusLabels[ticket.status] || ticket.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {copy.channel} {ticket.channel} · {formatTicketDate(ticket.created_at, locale)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {faqs.length > 0 && (
        <div className="max-w-4xl">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <HelpCircle className="h-5 w-5 text-primary" /> {copy.faqs}
          </h3>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {faqs.map((faq) => (
                <div key={faq.question} className="p-4">
                  <p className="font-semibold text-foreground">{faq.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}