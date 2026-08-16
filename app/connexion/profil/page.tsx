"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    apiFetch,
    fetchCurrentSession,
    getLoginPath,
    getRoleHomePath,
    normalizeRole,
    parseAppSession,
    persistSessionSnapshot,
    type CanonicalRole,
} from "@/lib/api-config";

function ProfileForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const phone = searchParams.get("phone") || "";
    const requestedRole = normalizeRole(searchParams.get("role"));
    const initialRole: CanonicalRole = requestedRole && requestedRole !== "admin" ? requestedRole : "acheteur";

    const [name, setName] = useState("");
    const [province, setProvince] = useState("");
    const [address, setAddress] = useState("");
    const [commune, setCommune] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [idNumber, setIdNumber] = useState("");
    const [role, setRole] = useState<CanonicalRole>(initialRole);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const provinces = [
        "Bujumbura Mairie", "Bujumbura Rural", "Bubanza", "Cibitoke", "Muramvya",
        "Kayanza", "Ngozi", "Karusi", "Muyinga", "Kirundo", "Gitega", "Ruyigi",
        "Cankuzo", "Rutana", "Bururi", "Makamba", "Rumonge", "Mwaro"
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !province) return;

        setLoading(true);
        setError("");

        try {
            const registration = await apiFetch("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    phone_number: `+257${phone}`,
                    name,
                    province,
                    address,
                    commune: commune || null,
                    latitude: latitude ? Number(latitude) : null,
                    longitude: longitude ? Number(longitude) : null,
                    id_number: idNumber || null,
                    role
                })
            }) as { user_id?: number | string; role?: string };

            const session = parseAppSession(registration) ?? await fetchCurrentSession();
            persistSessionSnapshot(session);
            router.push(getRoleHomePath(session.role));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = (value: string) => {
        const normalizedRole = normalizeRole(value);
        if (normalizedRole && normalizedRole !== "admin") {
            setRole(normalizedRole);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto px-6 py-10">
            <div className="space-y-2 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <User className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Complétez votre profil</h1>
                <p className="text-sm text-muted-foreground">
                    C'est presque fini ! Dites-nous qui vous êtes pour commencer avec le compte <strong>+257 {phone}</strong>.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Nom complet ou Entreprise</label>
                    <Input
                        placeholder="Ex: Pascal Niyomwungere"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="h-11 rounded-xl"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Votre Province</label>
                    <Select value={province} onValueChange={setProvince} required>
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Sélectionnez votre province" />
                        </SelectTrigger>
                        <SelectContent>
                            {provinces.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Adresse principale</label>
                    <Input
                        placeholder="Ex: Avenue du Large, Quartier Industriel"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                        className="h-11 rounded-xl"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Commune / zone</label>
                    <Input
                        placeholder="Ex: Rohero, Mukaza, Kabarore"
                        value={commune}
                        onChange={(e) => setCommune(e.target.value)}
                        className="h-11 rounded-xl"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Latitude</label>
                        <Input
                            type="number"
                            step="any"
                            placeholder="-3.3822"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Longitude</label>
                        <Input
                            type="number"
                            step="any"
                            placeholder="29.3644"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </div>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-2">
                    Coordonnées GPS facultatives mais recommandées pour améliorer la livraison et les dashboards.
                </p>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        Numéro CNI ou passeport <span className="text-muted-foreground font-normal">(optionnel)</span>
                    </label>
                    <Input
                        placeholder="Ex: CI123456789"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="h-11 rounded-xl"
                    />
                    <p className="text-[11px] text-muted-foreground">
                        Nécessaire pour retirer vos gains ou demander un crédit agricole. Vous pourrez aussi le renseigner plus tard, avec une photo de votre pièce, depuis vos paramètres.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Votre rôle principal</label>
                    <Select value={role} onValueChange={handleRoleChange} required>
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="acheteur">Acheteur / Particulier</SelectItem>
                            <SelectItem value="fermier">Fermier / Producteur</SelectItem>
                            <SelectItem value="logistique">Livreur / Transporteur</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Ce rôle définit les fonctionnalités auxquelles vous aurez accès.
                    </p>
                </div>

                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={loading || !name || !province || !address}
                        className="w-full h-12 font-semibold gap-2 rounded-xl"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Créer mon compte"}
                        {!loading && <CheckCircle className="w-4 h-4" />}
                    </Button>
                    {error && <p className="text-sm text-destructive text-center mt-3">{error}</p>}
                </div>
            </form>

            <div className="mt-auto pt-10 text-center">
                <p className="text-xs text-muted-foreground">
                    En créant un compte, vous acceptez nos <span className="underline">Conditions d'Utilisation</span>.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                    Vous avez déjà un compte ?{" "}
                    <Link href={getLoginPath(role)} className="font-medium text-primary hover:underline">
                        Se connecter
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
            <ProfileForm />
        </Suspense>
    );
}
