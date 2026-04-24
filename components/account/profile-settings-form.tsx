"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Save, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch, getRoleLabel, type CanonicalRole } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { formatUserCoordinates, formatUserLocation, useSessionUserProfile } from "@/lib/user-profile";
import { useLanguage } from "@/lib/LanguageContext";

interface ProfileSettingsFormProps {
    role: CanonicalRole;
    nameLabel?: string;
    intro?: string;
}

interface FormState {
    name: string;
    province: string;
    address: string;
    commune: string;
    latitude: string;
    longitude: string;
}

const EMPTY_FORM: FormState = { name: "", province: "", address: "", commune: "", latitude: "", longitude: "" };

export function ProfileSettingsForm({ role, nameLabel, intro }: ProfileSettingsFormProps) {
    const { session, ready } = useRequiredSession(role);
    const { user, setUser, loading } = useSessionUserProfile(session, ready);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { lang, text } = useLanguage();
    const copy = lang === "fr"
        ? { nameRequired: "Le nom est requis." }
        : { nameRequired: "Izina ni ngombwa." };

    useEffect(() => {
        if (!user) return;
        setForm({
            name: user.name || "",
            province: user.province || "",
            address: user.address || "",
            commune: user.commune || "",
            latitude: user.latitude == null ? "" : String(user.latitude),
            longitude: user.longitude == null ? "" : String(user.longitude),
        });
    }, [user]);

    const locationSummary = useMemo(() => formatUserLocation(user), [user]);
    const coordinatesSummary = useMemo(() => formatUserCoordinates(user), [user]);

    const handleChange = (field: keyof FormState, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSave = async () => {
        if (!session) return;
        if (!form.name.trim()) {
            setError(copy.nameRequired);
            return;
        }

        setSaving(true);
        setError(null);
        setFeedback(null);

        try {
            const payload = {
                name: form.name.trim(),
                province: form.province.trim() || null,
                address: form.address.trim() || null,
                commune: form.commune.trim() || null,
                latitude: form.latitude.trim() === "" ? null : Number(form.latitude),
                longitude: form.longitude.trim() === "" ? null : Number(form.longitude),
            };

            const updated = await apiFetch(`/users/${session.userId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            setUser(updated as any);
            setFeedback(text.settingsSuccessMsg);
        } catch (err: any) {
            setError(err.message || text.settingsErrorMsg);
        } finally {
            setSaving(false);
        }
    };

    if (!ready || (loading && !user)) {
        return (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{text.settingsLoading}</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{text.settingsProfileTitle}</CardTitle>
                    <CardDescription>
                        {intro || text.settingsProfileSub}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{nameLabel || text.settingsName}</label>
                            <Input value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{text.settingsProvince}</label>
                            <Input value={form.province} onChange={(e) => handleChange("province", e.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-foreground">{text.settingsAddress}</label>
                            <Input value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{text.settingsCommune}</label>
                            <Input value={form.commune} onChange={(e) => handleChange("commune", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{text.settingsPhone}</label>
                            <Input value={user?.phone_number || ""} disabled />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{text.settingsLatitude}</label>
                            <Input type="number" step="any" value={form.latitude} onChange={(e) => handleChange("latitude", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{text.settingsLongitude}</label>
                            <Input type="number" step="any" value={form.longitude} onChange={(e) => handleChange("longitude", e.target.value)} />
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {feedback && <p className="text-sm text-primary font-medium">{feedback}</p>}

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2 px-6">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-white" />}
                            {text.settingsSaveBtn}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-secondary/30 border-dashed">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        {text.settingsGpsTitle}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary text-white border-0">{getRoleLabel(user?.role || role, lang)}</Badge>
                        <Badge variant="outline" className="bg-white/50">{locationSummary}</Badge>
                    </div>
                    <div className="rounded-xl bg-white p-4 border border-border space-y-1 shadow-sm">
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">{text.settingsLatitude} & {text.settingsLongitude}</p>
                        <p className="text-sm text-primary font-mono font-medium">{coordinatesSummary}</p>
                    </div>
                    <div className="flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
                        <Shield className="w-4 h-4 text-primary shrink-0" />
                        <p>{text.settingsGpsNote}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}