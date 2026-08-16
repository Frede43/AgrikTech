"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, FileWarning, Loader2, MapPin, Save, Shield, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch, buildImageUrl, getRoleLabel, type CanonicalRole } from "@/lib/api-config";
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
    const [idNumber, setIdNumber] = useState("");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [submittingKyc, setSubmittingKyc] = useState(false);
    const [kycError, setKycError] = useState<string | null>(null);
    const [kycFeedback, setKycFeedback] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { lang, text } = useLanguage();
    const copy = lang === "fr"
        ? {
            nameRequired: "Le nom est requis.",
            kycTitle: "Vérification d'identité (KYC)",
            kycSub: "Requis pour retirer vos gains ou demander un crédit agricole.",
            kycIdNumber: "Numéro CNI ou passeport",
            kycDocument: "Photo ou scan de votre pièce",
            kycDocumentHint: "jpg, jpeg, png ou pdf, 5 Mo maximum.",
            kycSubmit: "Envoyer mon dossier",
            kycIdRequired: "Le numéro de pièce est requis.",
            kycDocRequired: "Merci de joindre une photo ou un scan de votre pièce d'identité.",
            kycSent: "Dossier envoyé, en attente de vérification par un administrateur.",
            kycStatusPending: "En attente de vérification",
            kycStatusVerified: "Vérifié",
            kycStatusRejected: "Rejeté",
            kycStatusNone: "Non soumis",
            kycViewDocument: "Voir le document envoyé",
            kycNotesLabel: "Motif :",
        }
        : {
            nameRequired: "Izina ni ngombwa.",
            kycTitle: "Kwemeza uwo uri we (KYC)",
            kycSub: "Bisabwa kugira ukure amahera yawe canke usabe ideni ry'uburimyi.",
            kycIdNumber: "Nomero y'ikarangamuntu canke pasiporo",
            kycDocument: "Ifoto canke scan y'ikarangamuntu",
            kycDocumentHint: "jpg, jpeg, png canke pdf, ntirengeze 5 Mo.",
            kycSubmit: "Rungika dosiye yanje",
            kycIdRequired: "Inomero y'ikarangamuntu irakenewe.",
            kycDocRequired: "Rungika ifoto canke scan y'ikarangamuntu yawe.",
            kycSent: "Dosiye yarungitswe, iriko irindira kwemezwa n'umutegetsi.",
            kycStatusPending: "Iriko irindira kwemezwa",
            kycStatusVerified: "Yemejwe",
            kycStatusRejected: "Yahakanywe",
            kycStatusNone: "Ntiyarungikwa",
            kycViewDocument: "Raba ikirungikanwe",
            kycNotesLabel: "Impamvu :",
        };

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
        setIdNumber(user.id_number || "");
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

    const handleKycSubmit = async () => {
        if (!session) return;
        if (!idNumber.trim()) {
            setKycError(copy.kycIdRequired);
            return;
        }

        setSubmittingKyc(true);
        setKycError(null);
        setKycFeedback(null);

        try {
            let documentUrl = user?.id_document_url || "";
            if (pendingFile) {
                const formData = new FormData();
                formData.append("file", pendingFile);
                const uploadResult = await apiFetch("/users/kyc/upload-document", {
                    method: "POST",
                    body: formData,
                }) as { document_url: string };
                documentUrl = uploadResult.document_url;
            }

            if (!documentUrl) {
                setKycError(copy.kycDocRequired);
                setSubmittingKyc(false);
                return;
            }

            const updated = await apiFetch("/users/kyc/submit", {
                method: "POST",
                body: JSON.stringify({ id_number: idNumber.trim(), id_document_url: documentUrl, nationality: "Burundi" }),
            });

            setUser(updated as any);
            setPendingFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setKycFeedback(copy.kycSent);
        } catch (err: any) {
            setKycError(err.message || text.settingsErrorMsg);
        } finally {
            setSubmittingKyc(false);
        }
    };

    const kycStatusBadge = () => {
        switch (user?.kyc_status) {
            case "verified":
                return <Badge className="bg-primary text-white border-0 gap-1"><CheckCircle2 className="w-3 h-3" />{copy.kycStatusVerified}</Badge>;
            case "rejected":
                return <Badge variant="destructive" className="gap-1"><FileWarning className="w-3 h-3" />{copy.kycStatusRejected}</Badge>;
            case "pending":
                return user?.id_document_url
                    ? <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{copy.kycStatusPending}</Badge>
                    : <Badge variant="outline" className="gap-1 text-muted-foreground">{copy.kycStatusNone}</Badge>;
            default:
                return <Badge variant="outline" className="gap-1 text-muted-foreground">{copy.kycStatusNone}</Badge>;
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

            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg">{copy.kycTitle}</CardTitle>
                            <CardDescription>{copy.kycSub}</CardDescription>
                        </div>
                        {kycStatusBadge()}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {user?.kyc_status === "rejected" && user?.kyc_notes && (
                        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                            {copy.kycNotesLabel} {user.kyc_notes}
                        </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{copy.kycIdNumber}</label>
                            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{copy.kycDocument}</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                                onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent text-sm shadow-xs file:mr-3 file:h-full file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium"
                            />
                            <p className="text-[11px] text-muted-foreground">{copy.kycDocumentHint}</p>
                        </div>
                    </div>

                    {user?.id_document_url && (
                        <a
                            href={buildImageUrl(user.id_document_url) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                            {copy.kycViewDocument}
                        </a>
                    )}

                    {kycError && <p className="text-sm text-destructive">{kycError}</p>}
                    {kycFeedback && <p className="text-sm text-primary font-medium">{kycFeedback}</p>}

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleKycSubmit} disabled={submittingKyc || !idNumber.trim()} variant="outline" className="gap-2 px-6">
                            {submittingKyc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {copy.kycSubmit}
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