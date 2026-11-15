"use client";

import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/LanguageContext";
import { Compass, Eye, Sprout, Target, Users } from "lucide-react";

export default function AboutPage() {
    const { text } = useLanguage();
    // null tant que /stats/public n'a pas répondu : pas de faux chiffre
    // affiché puis remplacé par le vrai (voir app/page.tsx pour le même souci
    // sur la page d'accueil).
    const [farmerCount, setFarmerCount] = useState<number | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const { apiFetch } = await import("@/lib/api-config");
                const data = await apiFetch("/stats/public");
                if (data && typeof data.farmer_count === "number") {
                    setFarmerCount(data.farmer_count);
                }
            } catch (err) {
                console.error("Failed to load public stats", err);
            }
        };
        loadStats();
    }, []);

    const sections = [
        { icon: Sprout, title: text.aboutWhy1Title, desc: text.aboutWhy1Desc },
        {
            icon: Users,
            title: text.aboutWhy2Title,
            desc: farmerCount !== null
                ? text.aboutWhy2Desc.replace("{count}", farmerCount.toLocaleString())
                : text.aboutWhy2Desc.replace("+{count} ", ""),
        },
        { icon: Eye, title: text.aboutWhy3Title, desc: text.aboutWhy3Desc }
    ];

    return (
        <div className="min-h-screen bg-background">
            <SiteHeader />

            <main className="max-w-4xl mx-auto px-4 py-20">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">
                        {text.aboutTitle}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        {text.aboutSubtitle}
                    </p>
                </div>

                <div className="grid gap-12">
                    {/* Intro Section */}
                    <section className="bg-card p-8 rounded-3xl border border-border shadow-sm">
                        <p className="text-lg leading-relaxed text-foreground/80 italic">
                            "{text.aboutBody}"
                        </p>
                    </section>

                    {/* Mission & Vision */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-xl bg-card border border-border">
                            <div className="mb-4 flex items-center gap-3">
                                <Target className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h2 className="text-2xl font-semibold">{text.aboutMission}</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                                {text.aboutMissionBody}
                            </p>
                        </div>
                        <div className="p-8 rounded-xl bg-card border border-border">
                            <div className="mb-4 flex items-center gap-3">
                                <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h2 className="text-2xl font-semibold">{text.aboutVision}</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                                {text.aboutVisionBody}
                            </p>
                        </div>
                    </div>

                    {/* Why section */}
                    <section className="space-y-8">
                        <h2 className="text-3xl font-bold text-center">{text.aboutWhyTitle}</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {sections.map((item, i) => (
                                <div key={i} className="p-5 bg-card rounded-xl border border-border">
                                    <item.icon className="h-5 w-5 mb-4 text-primary" aria-hidden="true" />
                                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
