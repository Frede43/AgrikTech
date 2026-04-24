"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";
import { useRequiredSession } from "@/lib/session";
import { Loader2, Phone, Save, Shield, Users, UserPlus } from "lucide-react";

interface AdminAgentSummary {
  id: number;
  name: string;
  phone_number: string;
  province?: string | null;
}

interface AdminSettingsData {
  commission_rate: number;
  maintenance_mode: boolean;
  support_phone: string;
  support_whatsapp: string;
  updated_at?: string | null;
  admins: AdminAgentSummary[];
}

const EMPTY_AGENT_FORM = {
  name: "",
  phone_number: "",
  province: "Bujumbura",
};

const formatUpdatedAt = (value: string | null | undefined, locale: string, neverLabel: string) => {
  if (!value) return neverLabel;
  return new Date(value).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminParametresPage() {
  const { lang } = useLanguage();
  const { session, ready } = useRequiredSession("admin");
  const [settings, setSettings] = useState<AdminSettingsData | null>(null);
  const [commissionPercent, setCommissionPercent] = useState("5");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [supportPhone, setSupportPhone] = useState("");
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  const [agentForm, setAgentForm] = useState(EMPTY_AGENT_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const locale = lang === "ki" ? "rn-BI" : "fr-FR";
  const copy = {
    fr: {
      title: "Paramètres admin",
      subtitle: "Configuration globale de la plateforme",
      loading: "Chargement des paramètres plateforme…",
      loadError: "Impossible de charger les paramètres.",
      invalidCommission: "Veuillez saisir un pourcentage de commission valide.",
      settingsUpdated: "Paramètres plateforme mis à jour.",
      saveError: "Impossible d'enregistrer les paramètres.",
      adminRequired: "Le nom et le numéro de téléphone sont requis pour créer un agent.",
      adminCreated: "Nouvel administrateur ajouté avec succès.",
      adminCreateError: "Impossible d'ajouter cet administrateur.",
      systemSettings: "Réglages système",
      updatedAt: "Dernière mise à jour : {value}",
      commissionLabel: "Commission plateforme (%)",
      commissionHelp: "Valeur appliquée sur les ventes livrées avant crédit au fermier.",
      supportPhone: "Téléphone support",
      supportWhatsapp: "WhatsApp support",
      maintenanceTitle: "Mode maintenance",
      maintenanceHelp: "Bloque les nouvelles commandes pendant une intervention technique.",
      save: "Enregistrer les réglages",
      teamTitle: "Équipe d'administration",
      teamHelp: "Gérer les accès à l'équipe plateforme et au support opérationnel.",
      addAgent: "Ajouter un agent",
      addAdminTitle: "Ajouter un administrateur",
      addAdminDescription: "Créez ici un nouvel accès admin pour l'équipe plateforme.",
      name: "Nom",
      agentNamePlaceholder: "Nom de l'agent",
      phone: "Téléphone",
      province: "Province",
      cancel: "Annuler",
      createAccess: "Créer l'accès admin",
      provinceMissing: "Province non renseignée",
      adminLabel: "Admin",
      noAdmins: "Aucun administrateur enregistré.",
      never: "Jamais",
    },
    ki: {
      title: "Amagenamiterere ya admin",
      subtitle: "Uko urubuga rwose rutunganijwe",
      loading: "Turiko turategura amagenamiterere y'urubuga…",
      loadError: "Ntivyashobotse kuronka amagenamiterere.",
      invalidCommission: "Injiza ijanisha ry'amafaranga y'ikorwa ribereye.",
      settingsUpdated: "Amagenamiterere y'urubuga yabitswe.",
      saveError: "Ntivyashobotse kubika amagenamiterere.",
      adminRequired: "Izina n'inomero ya telefone birakenewe kugira ngo wongereko agenti.",
      adminCreated: "Admin mushasha yongeweko neza.",
      adminCreateError: "Ntivyashobotse kwongerako uwu admin.",
      systemSettings: "Amategeko ya sisiteme",
      updatedAt: "Ivyahinduwe bwa nyuma: {value}",
      commissionLabel: "Amafaranga y'urubuga (%)",
      commissionHelp: "Bikurwa ku vyagurishijwe vyashikanywe imbere yo gushira amafaranga ku murimyi.",
      supportPhone: "Telefone y'ubufasha",
      supportWhatsapp: "WhatsApp y'ubufasha",
      maintenanceTitle: "Uburyo bwo gusanasana",
      maintenanceHelp: "Buhagarika ama komande mashasha mu gihe c'ikorwa rya tekinike.",
      save: "Bika amagenamiterere",
      teamTitle: "Umugwi w'ubuyobozi",
      teamHelp: "Cungera uburyo bwo kwinjira bw'umugwi w'urubuga n'ubufasha bwo mu kazi.",
      addAgent: "Ongerako agenti",
      addAdminTitle: "Ongerako admin",
      addAdminDescription: "Rema hano uburyo bushasha bwa admin bw'umugwi w'urubuga.",
      name: "Izina",
      agentNamePlaceholder: "Izina ry'agenti",
      phone: "Telefone",
      province: "Intara",
      cancel: "Kureka",
      createAccess: "Rema uburenganzira bwa admin",
      provinceMissing: "Intara ntiyuzujwe",
      adminLabel: "Admin",
      noAdmins: "Nta admin arandikwa.",
      never: "Nta na rimwe",
    },
  }[lang];

  const applySettings = (data: AdminSettingsData) => {
    setSettings(data);
    setCommissionPercent(((data.commission_rate || 0) * 100).toString());
    setMaintenanceMode(Boolean(data.maintenance_mode));
    setSupportPhone(data.support_phone || "");
    setSupportWhatsapp(data.support_whatsapp || "");
  };

  const loadSettings = async () => {
    const payload = await apiFetch("/admin/settings");
    applySettings(payload as AdminSettingsData);
  };

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    loadSettings()
      .then(() => {
        setError(null);
      })
      .catch((err: any) => {
        console.error("Admin settings error", err);
        setError(err.message || copy.loadError);
      })
      .finally(() => setLoading(false));
  }, [copy.loadError, ready, session]);

  const handleSave = async () => {
    const parsedPercent = Number(commissionPercent.replace(",", "."));
    if (Number.isNaN(parsedPercent)) {
      setError(copy.invalidCommission);
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const updated = await apiFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          commission_rate: parsedPercent / 100,
          maintenance_mode: maintenanceMode,
          support_phone: supportPhone.trim(),
          support_whatsapp: supportWhatsapp.trim(),
        }),
      });
      applySettings(updated as AdminSettingsData);
      setFeedback(copy.settingsUpdated);
    } catch (err: any) {
      setError(err.message || copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!agentForm.name.trim() || !agentForm.phone_number.trim()) {
      setError(copy.adminRequired);
      return;
    }

    setCreatingAdmin(true);
    setError(null);
    setFeedback(null);

    try {
      await apiFetch("/admin/settings/admins", {
        method: "POST",
        body: JSON.stringify({
          name: agentForm.name.trim(),
          phone_number: agentForm.phone_number.trim(),
          province: agentForm.province.trim() || "Bujumbura",
        }),
      });
      await loadSettings();
      setDialogOpen(false);
      setAgentForm(EMPTY_AGENT_FORM);
      setFeedback(copy.adminCreated);
    } catch (err: any) {
      setError(err.message || copy.adminCreateError);
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (!ready || loading) {
    return (
      <AdminLayout title={copy.title} subtitle={copy.subtitle}>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">{copy.loading}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={copy.title} subtitle={copy.subtitle}>
      <div className="max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              {copy.systemSettings}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {copy.updatedAt.replace("{value}", formatUpdatedAt(settings?.updated_at, locale, copy.never))}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{copy.commissionLabel}</label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step="0.1"
                  value={commissionPercent}
                  onChange={(event) => setCommissionPercent(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {copy.commissionHelp}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{copy.supportPhone}</label>
                <Input value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">{copy.supportWhatsapp}</label>
                <Input value={supportWhatsapp} onChange={(event) => setSupportWhatsapp(event.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-semibold text-foreground">{copy.maintenanceTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {copy.maintenanceHelp}
                </p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {feedback && <p className="text-sm text-primary">{feedback}</p>}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {copy.save}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-primary" />
                  {copy.teamTitle}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.teamHelp}
                </p>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    {copy.addAgent}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{copy.addAdminTitle}</DialogTitle>
                    <DialogDescription>
                      {copy.addAdminDescription}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">{copy.name}</label>
                      <Input
                        value={agentForm.name}
                        onChange={(event) => setAgentForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder={copy.agentNamePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">{copy.phone}</label>
                      <Input
                        value={agentForm.phone_number}
                        onChange={(event) =>
                          setAgentForm((current) => ({ ...current, phone_number: event.target.value }))
                        }
                        placeholder="+257..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">{copy.province}</label>
                      <Input
                        value={agentForm.province}
                        onChange={(event) => setAgentForm((current) => ({ ...current, province: event.target.value }))}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      {copy.cancel}
                    </Button>
                    <Button onClick={handleCreateAdmin} disabled={creatingAdmin} className="gap-2">
                      {creatingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {copy.createAccess}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {settings?.admins?.length ? (
                settings.admins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div>
                      <p className="font-semibold text-foreground">{admin.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {admin.phone_number}
                        </span>
                        <span>{admin.province || copy.provinceMissing}</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {copy.adminLabel}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  {copy.noAdmins}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
