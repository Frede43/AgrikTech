"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Leaf, Phone, ArrowRight, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
    apiFetch,
    fetchCurrentSession,
    getLoginPath,
    getRoleHomePath,
    getRoleLabel,
    getSignupPath,
    normalizeRole,
    parseAppSession,
    persistSessionSnapshot,
} from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

type Step = "phone" | "otp";

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedRole = normalizeRole(searchParams.get("role"));
    const role = requestedRole || "acheteur";
    const isAdminRole = role === "admin";
    // admin / obr / ministere_agriculture : comptes créés uniquement par un
    // administrateur, jamais via l'inscription publique.
    const isRestrictedRole = isAdminRole || role === "obr" || role === "ministere_agriculture";
    const initialPhone = (searchParams.get("phone") || "").replace(/^\+?257/, "");

    const { lang, setLang, text } = useLanguage();
    const copy = lang === "fr"
        ? {
            sendError: "Erreur lors de l'envoi du code.",
            invalidOtp: "Code invalide ou expiré.",
            switchLanguage: "Kirundi",
            chooseRoleTitle: "Choisissez votre espace de connexion",
            chooseRoleSubtitle: "Sélectionnez votre rôle pour accéder au bon parcours de connexion.",
            buyerDescription: "Achetez des produits frais auprès des fermiers.",
            farmerDescription: "Gérez vos récoltes, ventes et retraits.",
            driverDescription: "Consultez et livrez les commandes assignées.",
        }
        : {
            sendError: "Ntivyashobotse kurungika kode.",
            invalidOtp: "Kode siyo canke yarengeje igihe.",
            switchLanguage: "Igifaransa",
            chooseRoleTitle: "Hitamwo aho winjirira",
            chooseRoleSubtitle: "Hitamwo uruhara rwawe kugira winjire mu nzira ibereye.",
            buyerDescription: "Gura ibidandazwa bishasha uciye ku barimyi.",
            farmerDescription: "Cungera umwimbu, amasoko n'amahera yawe.",
            driverDescription: "Raba kandi ushikirize amabwirizwa wagenewe.",
        };
    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState(initialPhone);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const signupPath = `${getSignupPath(role)}&phone=${encodeURIComponent(phone)}`;
    const roleOptions = [
        { role: "acheteur", label: getRoleLabel("acheteur", lang), description: copy.buyerDescription },
        { role: "fermier", label: getRoleLabel("fermier", lang), description: copy.farmerDescription },
        { role: "logistique", label: getRoleLabel("logistique", lang), description: copy.driverDescription },
    ] as const;

    if (!requestedRole) {
        return (
            <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <Leaf className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                            <p className="font-bold text-base text-foreground leading-none">AgriConnect</p>
                            <p className="text-xs text-muted-foreground">Burundi</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setLang(lang === "fr" ? "ki" : "fr")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {copy.switchLanguage}
                    </button>
                </div>

                <div className="flex-1 flex flex-col gap-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-foreground text-balance">{copy.chooseRoleTitle}</h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">{copy.chooseRoleSubtitle}</p>
                    </div>

                    <div className="space-y-6">
                        {/* Groupe Individus */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Particuliers</p>
                            <div className="grid gap-3">
                                {roleOptions.filter(o => o.role !== "logistique").map((option) => (
                                    <Link
                                        key={option.role}
                                        href={getLoginPath(option.role)}
                                        className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-primary hover:bg-primary/5 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            {option.role === "acheteur" ? <ArrowRight className="w-6 h-6" /> : <Leaf className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-foreground">{option.label}</p>
                                            <p className="text-xs text-muted-foreground">{option.description}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Groupe Organisations */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 ml-1">Professionnels & Groupements</p>
                            <div className="grid gap-3">
                                {/* Option Coopérative (Spéciale) */}
                                <Link
                                    href={getLoginPath("fermier")} // Le manager de coop utilise le login fermier mais verra son interface coop
                                    className="flex items-center gap-4 rounded-2xl border-2 border-amber-100 bg-amber-50/30 p-5 hover:border-amber-500 hover:bg-amber-50 transition-all group shadow-sm"
                                >
                                    <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                                        <Shield className="w-7 h-7" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-amber-900 text-lg">Responsable Coopérative</p>
                                        <p className="text-xs text-amber-700 font-medium">Gérez vos membres, vos stocks collectifs et votre Hub logistique.</p>
                                    </div>
                                </Link>

                                {/* Option Logistique */}
                                <Link
                                    href={getLoginPath("logistique")}
                                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-primary hover:bg-primary/5 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                                        <Globe className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-foreground">Transport & Logistique</p>
                                        <p className="text-xs text-muted-foreground">Accédez aux missions de ramassage et de livraison.</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-xs font-black text-foreground uppercase tracking-widest">Administration</p>
                            <p className="text-[10px] text-muted-foreground">Accès réservé au personnel AgriConnect</p>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="font-bold text-primary rounded-xl">
                            <Link href={getLoginPath("admin")}>S'identifier</Link>
                        </Button>
                    </div>

                    <p className="text-sm text-center text-muted-foreground">
                        {text.loginNoAccount}{" "}
                        <Link href="/inscription" className="font-medium text-primary hover:underline">
                            {text.authCreateAccount}
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    const handleSendOtp = async () => {
        if (phone.length < 8) return;
        setLoading(true);
        setError("");
        try {
            const phoneNumber = `+257${phone}`;
            await apiFetch(`/auth/request-otp?phone_number=${encodeURIComponent(phoneNumber)}`, {
                method: "POST",
            });
            setStep("otp");
        } catch (err: any) {
            setError(err.message || copy.sendError);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 4) return;
        setLoading(true);
        setError("");
        try {
            const phoneNumber = `+257${phone}`;
            const verification = await apiFetch(
                `/auth/verify-otp?phone_number=${encodeURIComponent(phoneNumber)}&code=${encodeURIComponent(otp)}`,
                {
                    method: "POST",
                },
            ) as { registered?: boolean; user_id?: number | string; role?: string };

            const directSession = parseAppSession(verification);
            if (directSession) {
                persistSessionSnapshot(directSession);
                router.push(getRoleHomePath(directSession.role));
                router.refresh();
                return;
            }

            if (verification.registered === false) {
                router.push(`/inscription/profil?role=${role}&phone=${encodeURIComponent(phone)}`);
                return;
            }

            const session = await fetchCurrentSession();
            persistSessionSnapshot(session);
            router.push(getRoleHomePath(session.role));
            router.refresh();
        } catch (err: any) {
            setError(err.message || copy.invalidOtp);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto px-6 py-10">
            {/* Header with Lang Toggle */}
            <div className="flex items-center justify-between mb-8">
                <Link href="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                        <Leaf className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                        <p className="font-bold text-base text-foreground leading-none">AgriConnect</p>
                        <p className="text-xs text-muted-foreground">Burundi</p>
                    </div>
                </Link>
                <button
                    onClick={() => setLang(lang === "fr" ? "ki" : "fr")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                >
                    <Globe className="w-3.5 h-3.5" />
                    {copy.switchLanguage}
                </button>
            </div>

            {step === "phone" ? (
                <div className="flex-1 flex flex-col gap-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-foreground text-balance">
                            {text.loginTitle} {getRoleLabel(role, lang)}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {isAdminRole
                                ? text.adminSub
                                : isRestrictedRole
                                    ? text.restrictedRoleSub
                                    : text.loginSubtitle}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">{text.loginPhone}</label>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 px-3 h-10 rounded-lg border border-input bg-secondary text-sm text-muted-foreground shrink-0">
                                    <span className="text-base">🇧🇮</span>
                                    <span className="font-medium">+257</span>
                                </div>
                                <Input
                                    type="tel"
                                    placeholder="76 000 000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                    className="h-10 text-base tracking-widest"
                                    maxLength={8}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleSendOtp}
                            disabled={phone.length < 8 || loading}
                            className="w-full h-12 font-semibold gap-2"
                        >
                            {loading ? text.authSending : text.authSmsButton}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </Button>
                        {error && <p className="text-sm text-destructive text-center">{error}</p>}

                        {isRestrictedRole ? (
                            <p className="text-sm text-center text-muted-foreground">
                                {isAdminRole ? text.authAdminOnly : text.authRestrictedOnly}
                            </p>
                        ) : (
                            <p className="text-sm text-center text-muted-foreground">
                                {text.loginNoAccount}{" "}
                                <Link href={signupPath} className="font-medium text-primary hover:underline">
                                    {text.authCreateAccount}
                                </Link>
                            </p>
                        )}
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary text-sm text-muted-foreground">
                        <Shield className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <p>{text.authShieldNote}</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-8">
                    <div className="space-y-2">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                            <Phone className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">{text.authOtpCode}</h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {text.authOtpSentTo} <strong>+257 {phone}</strong>
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-center">
                            <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                                <InputOTPGroup className="gap-2">
                                    {[0, 1, 2, 3].map((i) => (
                                        <InputOTPSlot key={i} index={i} className="w-12 h-14 text-xl font-bold border-2 rounded-xl focus:border-primary transition-all" />
                                    ))}
                                </InputOTPGroup>
                            </InputOTP>
                        </div>

                        <Button
                            onClick={handleVerifyOtp}
                            disabled={otp.length < 4 || loading}
                            className="w-full h-12 font-semibold"
                        >
                            {loading ? text.authVerifying : text.authVerifyButton}
                        </Button>

                        {error && <p className="text-sm text-destructive text-center leading-none mt-2">{error}</p>}

                        <button
                            onClick={() => setStep("phone")}
                            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {text.authResendCode}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Leaf className="w-8 h-8 text-primary animate-bounce" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
