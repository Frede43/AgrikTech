"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, FileText, Loader2, Search, ShieldAlert, XCircle } from "lucide-react";
import { apiFetch, buildImageUrl } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

interface KycUser {
  id: number;
  name: string;
  phone_number: string;
  role: string;
  id_number?: string | null;
  id_document_url?: string | null;
  kyc_status?: string | null;
  kyc_notes?: string | null;
}

type StatusFilter = "all" | "pending" | "verified" | "rejected";

export default function AdminKycPage() {
  const { lang, text } = useLanguage();
  const [users, setUsers] = useState<KycUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [actionId, setActionId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/users") as KycUser[];
      setUsers(Array.isArray(data) ? data.filter((u) => !!u.id_document_url) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleReview = async (id: number, status: "verified" | "rejected") => {
    setActionId(id);
    try {
      const noteValue = notes[id]?.trim() || "";
      await apiFetch(`/admin/users/${id}/verify-kyc?status=${status}${noteValue ? `&notes=${encodeURIComponent(noteValue)}` : ""}`, {
        method: "POST",
      });
      await loadUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesStatus = statusFilter === "all" || u.kyc_status === statusFilter;
      const matchesSearch = !search
        || u.name.toLowerCase().includes(search.toLowerCase())
        || u.phone_number.includes(search)
        || (u.id_number || "").toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [users, statusFilter, search]);

  const counts = {
    pending: users.filter((u) => u.kyc_status === "pending").length,
    verified: users.filter((u) => u.kyc_status === "verified").length,
    rejected: users.filter((u) => u.kyc_status === "rejected").length,
  };

  const statusBadge = (status?: string | null) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-primary text-white border-0 gap-1"><CheckCircle2 className="w-3 h-3" />{lang === "fr" ? "Vérifié" : "Yemejwe"}</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{lang === "fr" ? "Rejeté" : "Yahakanywe"}</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{lang === "fr" ? "En attente" : "Birindiranye"}</Badge>;
    }
  };

  return (
    <AdminLayout
      title={lang === "fr" ? "Vérification KYC" : "Kwemeza uwo bari"}
      subtitle={lang === "fr" ? "Valider ou rejeter les pièces d'identité soumises" : "Kwemeza canke guhakana ivyangombwa vyarungitswe"}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={lang === "fr" ? "Rechercher par nom, téléphone, N° pièce..." : "Rondera izina, terefone..."}
              className="w-full h-12 pl-10 pr-4 rounded-2xl border bg-card text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={loadUsers} className="h-12 rounded-2xl px-6">
            {lang === "fr" ? "Actualiser" : "Kuvugurura"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { key: "pending" as const, label: lang === "fr" ? "En attente" : "Birindiranye", count: counts.pending },
            { key: "verified" as const, label: lang === "fr" ? "Vérifiés" : "Yemejwe", count: counts.verified },
            { key: "rejected" as const, label: lang === "fr" ? "Rejetés" : "Yahakanywe", count: counts.rejected },
            { key: "all" as const, label: lang === "fr" ? "Tous" : "Vyose", count: users.length },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                statusFilter === key ? "bg-sidebar-primary text-sidebar-primary-foreground border-transparent" : "bg-card border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{text.dashLoading}</p>
            </div>
          ) : filtered.length === 0 ? (
            <Card className="py-20 text-center border-dashed">
              <p className="text-muted-foreground">
                {lang === "fr" ? "Aucun dossier KYC ne correspond." : "Nta dosiye ibonetse."}
              </p>
            </Card>
          ) : (
            filtered.map((u) => {
              const documentUrl = buildImageUrl(u.id_document_url);
              return (
                <Card key={u.id} className="overflow-hidden border-border/50">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{u.name}</h3>
                          {statusBadge(u.kyc_status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {u.phone_number} • {u.role} {u.id_number ? `• ${u.id_number}` : ""}
                        </p>
                      </div>
                      {documentUrl ? (
                        <a
                          href={documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline shrink-0"
                        >
                          <FileText className="w-4 h-4" />
                          {lang === "fr" ? "Voir la pièce" : "Raba ikarangamuntu"}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                          <ShieldAlert className="w-4 h-4" />
                          {lang === "fr" ? "Aucun document" : "Nta gikirungikanwe"}
                        </span>
                      )}
                    </div>

                    {u.kyc_status === "pending" && (
                      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                        <div className="flex-1 w-full space-y-1">
                          <label className="text-xs font-bold uppercase text-muted-foreground">
                            {lang === "fr" ? "Note (optionnelle, visible en cas de rejet)" : "Impamvu (bishoboka)"}
                          </label>
                          <Textarea
                            rows={2}
                            value={notes[u.id] || ""}
                            onChange={(e) => setNotes((current) => ({ ...current, [u.id]: e.target.value }))}
                            placeholder={lang === "fr" ? "Ex: photo illisible, document expiré..." : ""}
                          />
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            onClick={() => handleReview(u.id, "rejected")}
                            disabled={actionId === u.id}
                            variant="outline"
                            className="gap-2 border-red-500/20 text-red-500 hover:bg-red-500/5"
                          >
                            {actionId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            {lang === "fr" ? "Rejeter" : "Hakana"}
                          </Button>
                          <Button
                            onClick={() => handleReview(u.id, "verified")}
                            disabled={actionId === u.id}
                            className="gap-2 bg-sidebar-primary"
                          >
                            {actionId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {lang === "fr" ? "Valider" : "Emeza"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {u.kyc_status === "rejected" && u.kyc_notes && (
                      <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                        {lang === "fr" ? "Motif du rejet :" : "Impamvu:"} {u.kyc_notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
