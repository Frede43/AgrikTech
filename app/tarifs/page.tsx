"use client";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/LanguageContext";
import { CheckCircle2, Truck, WalletCards, ShieldCheck } from "lucide-react";

export default function FeesPage() {
    const { text } = useLanguage();

    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />

            <main className="max-w-4xl mx-auto px-4 py-20">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">
                        {text.feesDetailTitle}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Une tarification transparente pour une agriculture durable.
                    </p>
                </div>

                <div className="grid gap-8">
                    {/* Main Pricing Card */}
                    <div className="relative p-10 rounded-[2.5rem] bg-slate-900 text-white overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 p-8">
                            <div className="bg-primary/20 text-primary-foreground px-4 py-1 rounded-full text-sm font-bold border border-primary/30 uppercase tracking-widest">
                                Standard
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl font-bold mb-6">{text.feesCommission}</h2>
                                <div className="flex items-baseline gap-2 mb-8">
                                    <span className="text-6xl font-black text-primary">5%</span>
                                    <span className="text-slate-400">par vente</span>
                                </div>
                                <ul className="space-y-4">
                                    {[
                                        "Aucun abonnement mensuel",
                                        "Accès gratuit au catalogue",
                                        "Support technique 7j/7",
                                        "Paiements mobiles sécurisés"
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
                                    {text.feesCommissionBody}
                                </p>
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                                    <ShieldCheck className="w-6 h-6 text-primary" />
                                    <span className="text-sm font-medium">Fonds garantis par Ikigega</span>
                                </div>
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
                                <span className="font-medium text-foreground">Base Bujumbura</span>
                                <span className="text-primary font-bold">À partir de 1 500 BIF</span>
                            </div>
                        </div>

                        <div className="p-8 rounded-3xl border border-border bg-card">
                            <WalletCards className="w-10 h-10 text-primary mb-6" />
                            <h3 className="text-xl font-bold mb-4 font-heading">Frais de retrait</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Les transferts vers vos comptes Lumicash ou EcoCash sont soumis aux tarifs en vigueur chez vos opérateurs respectifs.
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
