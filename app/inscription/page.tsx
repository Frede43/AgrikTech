"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Leaf, Phone, Shield, Globe } from "lucide-react";
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

function SignupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedRole = normalizeRole(searchParams.get("role"));
    const role = requestedRole || "acheteur";
    const isAdminRole = role === "admin";
    const initialPhone = (searchParams.get("phone") || "").replace(/^\+?257/, "");

    const { lang, setLang, text } = useLanguage();
    const copy = lang === "fr"
        ? {
            sendError: "Erreur lors de l'envoi du code.",
            invalidOtp: "Code invalide ou expiré.",
            restrictedTitle: "Accès restreint",
            backHome: "Retour à l'accueil",
            switchLanguage: "Kirundi",
            chooseRoleTitle: "Choisissez votre profil",
            chooseRoleSubtitle: "Sélectionnez le type de compte que vous souhaitez créer sur AgriConnect.",
            buyerDescription: "Pour acheter des produits frais et suivre vos commandes.",
            farmerDescription: "Pour vendre vos récoltes et suivre vos revenus.",
            driverDescription: "Pour gérer les livraisons et courses attribuées.",
        }
        : {
            sendError: "Ntivyashobotse kurungika kode.",
            invalidOtp: "Kode siyo canke yarengeje igihe.",
            restrictedTitle: "Ntivyemewe",
            backHome: "Subira ku ntango",
            switchLanguage: "Igifaransa",
            chooseRoleTitle: "Hitamwo ubwoko bwa konti",
            chooseRoleSubtitle: "Hitamwo konti ushaka kurema kuri AgriConnect.",
            buyerDescription: "Yo kugura ibidandazwa bishasha no gukurikirana amabwirizwa yawe.",
            farmerDescription: "Yo kugurisha umwimbu wawe no gukurikirana amafaranga winjiza.",
            driverDescription: "Yo gucunga gutanga no kurondera ibikorwa wagenewe.",
        };
    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState(initialPhone);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const roleOptions = [
        { role: "acheteur", label: getRoleLabel("acheteur", lang), description: copy.buyerDescription },
        { role: "fermier", label: getRoleLabel("fermier", lang), description: copy.farmerDescription },
        { role: "logistique", label: getRoleLabel("logistique", lang), description: copy.driverDescription },
    ] as const;

    if (!requestedRole) {
        return (
            <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto px-6 py-10">
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

                <div className="flex-1 flex flex-col gap-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-foreground text-balance">{copy.chooseRoleTitle}</h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">{copy.chooseRoleSubtitle}</p>
                    </div>

                    <div className="space-y-3">
                        {roleOptions.map((option) => (
                            <Link
                                key={option.role}
                                href={getSignupPath(option.role)}
                                className="block rounded-2xl border border-border bg-card p-4 hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <p className="font-semibold text-foreground">{text.signupTitle} {option.label}</p>
                                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                            </Link>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                        <p className="font-semibold text-foreground">{text.adminTitle}</p>
                        <p className="text-sm text-muted-foreground mt-1">{text.authAdminOnly}</p>
                    </div>

                    <p className="text-sm text-center text-muted-foreground">
                        {text.signupHaveAccount}{" "}
                        <Link href="/connexion" className="font-medium text-primary hover:underline">
                            {text.loginButton}
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

            if (verification.registered) {
                const session = await fetchCurrentSession();
                persistSessionSnapshot(session);
                router.push(getRoleHomePath(session.role || verification.role || role));
                router.refresh();
                return;
            }

            router.push(`/inscription/profil?role=${role}&phone=${encodeURIComponent(phone)}`);
        } catch (err: any) {
            setError(err.message || copy.invalidOtp);
        } finally {
            setLoading(false);
        }
    };

    if (isAdminRole) {
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

                <div className="flex-1 flex flex-col gap-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-foreground text-balance">
                            {copy.restrictedTitle}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {text.authAdminOnly}
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/">{copy.backHome}</Link>
                    </Button>
                </div>
            </div>
        );
    }

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
                            {text.signupTitle} {getRoleLabel(role, lang)}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {text.signupSubtitle}
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

                        <Button onClick={handleSendOtp} disabled={phone.length < 8 || loading} className="w-full h-12 font-semibold gap-2">
                            {loading ? text.authSending : text.authSmsButton}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </Button>
                        {error && <p className="text-sm text-destructive text-center">{error}</p>}

                        <p className="text-sm text-center text-muted-foreground">
                            {text.signupHaveAccount}{" "}
                            <Link href={getLoginPath(role)} className="font-medium text-primary hover:underline">
                                {text.loginButton}
                            </Link>
                        </p>
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

                        <Button onClick={handleVerifyOtp} disabled={otp.length < 4 || loading} className="w-full h-12 font-semibold">
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

export default function SignupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Leaf className="w-8 h-8 text-primary animate-bounce" />
            </div>
        }>
            <SignupContent />
        </Suspense>
    );
}