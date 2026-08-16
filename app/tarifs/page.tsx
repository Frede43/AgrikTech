"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/LanguageContext";
import { apiFetch } from "@/lib/api-config";
import { CheckCircle2, Truck, WalletCards, ShieldCheck, Sparkles } from "lucide-react";

interface CommissionInfo {
    standard_commission_rate: number;
    promo_commission_rate: number;
    promo_sales_threshold: number;
}

const FALLBACK_COMMISSION: CommissionInfo = {
    standard_commission_rate: 0.05,
    promo_commission_rate: 0.02,
    promo_sales_threshold: 20,
};

export default function FeesPage() {
    const { text } = useLanguage();
    const [commission, setCommission] = useState<CommissionInfo>(FALLBACK_COMMISSION);

    useEffect(() => {
        let active = true;
        apiFetch("/stats/public")
            .then((data) => {
                if (!active) return;
                const payload = data as Partial<CommissionInfo>;
                if (typeof payload.standard_commission_rate === "number") {
                    setCommission({
                        standard_commission_rate: payload.standard_commission_rate,
                        promo_commission_rate: payload.promo_commission_rate ?? FALLBACK_COMMISSION.promo_commission_rate,
                        promo_sales_threshold: payload.promo_sales_threshold ?? FALLBACK_COMMISSION.promo_sales_threshold,
                    });
                }
            })
            .catch(() => { /* Repli silencieux sur les valeurs par défaut */ });
        return () => {
            active = false;
        };
    }, []);

    const standardRateLabel = `${(commission.standard_commission_rate * 100).toFixed(0)}%`;
    const promoRateLabel = `${(commission.promo_commission_rate * 100).toFixed(0)}%`;
    const commissionBody = text.feesCommissionBody.replace("{standardRate}", standardRateLabel);
    const promoBody = text.feesPromoBody
        .replace("{promoRate}", promoRateLabel)
        .replace("{promoThreshold}", String(commission.promo_sales_threshold))
        .replace("{standardRate}", standardRateLabel);

    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />

            <main className="max-w-4xl mx-auto px-4 py-20">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">
                        {text.feesDetailTitle}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        {text.feesSubtitle}
                    </p>
                </div>

                <div className="grid gap-8">
                    {/* Main Pricing Card */}
                    <div className="relative p-10 rounded-[2.5rem] bg-slate-900 text-white overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 p-8">
                            <div className="bg-primary/20 text-primary-foreground px-4 py-1 rounded-full text-sm font-bold border border-primary/30 uppercase tracking-widest">
                                {text.feesPlan}
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl font-bold mb-6">{text.feesCommission}</h2>
                                <div className="flex items-baseline gap-2 mb-8">
                                    <span className="text-6xl font-black text-primary">{standardRateLabel}</span>
                                    <span className="text-slate-400">{text.feesPerSale}</span>
                                </div>
                                <ul className="space-y-4">
                                    {[
                                        text.feesNoSub,
                                        text.feesFreeCat,
                                        text.feesSupport,
                                        text.feesSecurePay
                                    ].map((fit, i) => (
                                        <li key={i} className="flex items-center gap-3 text-slate-300">
                                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                                            {fit}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                <p className="text-slate-300 leading-relaxed mb-6">
                                    {commissionBody}
                                </p>
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                                    <ShieldCheck className="w-6 h-6 text-primary" />
                                    <span className="text-sm font-medium">{text.feesFundsGuaranteed}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Promo onboarding rate */}
                    <div className="relative p-8 md:p-10 rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                <Sparkles className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                                    <h3 className="text-2xl font-bold text-foreground">{text.feesPromoTitle}</h3>
                                    <span className="text-3xl font-black text-primary">{promoRateLabel}</span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    {promoBody}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Detailed breakdown */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-3xl border border-border bg-card">
                            <Truck className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold mb-4 font-heading">{text.feesDelivery}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {text.feesDeliveryBody}
                            </p>
                            <div className="mt-6 pt-6 border-t border-border flex justify-between items-center text-sm">
                                <span className="font-medium text-foreground">{text.feesBaseDelivery}</span>
                                <span className="text-primary font-bold">{text.feesBaseDeliveryPrice}</span>
                            </div>
                        </div>

                        <div className="p-8 rounded-3xl border border-border bg-card">
                            <WalletCards className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold mb-4 font-heading">{text.feesWithdrawTitle}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {text.feesWithdrawBody}
                            </p>
                            <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-2 text-xs">
                                {["EcoCash", "Lumicash", "Airtel Money"].map(o => (
                                    <span key={o} className="px-2 py-1 rounded bg-secondary text-foreground italic">{o}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
