"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/LanguageContext";
import { Sprout, Target, Eye, Users } from "lucide-react";

export default function AboutPage() {
    const { text } = useLanguage();

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
                        <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                                <Target className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold mb-4">{text.aboutMission}</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                {text.aboutMissionBody}
                            </p>
                        </div>
                        <div className="p-8 rounded-3xl bg-accent/5 border border-accent/10">
                            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mb-6">
                                <Eye className="w-6 h-6 text-amber-800" />
                            </div>
                            <h2 className="text-2xl font-bold mb-4">{text.aboutVision}</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                {text.aboutVisionBody}
                            </p>
                        </div>
                    </div>

                    {/* Why section */}
                    <section className="space-y-8">
                        <h2 className="text-3xl font-bold text-center">{text.aboutWhyTitle}</h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                { icon: Sprout, title: text.aboutWhy1Title, desc: text.aboutWhy1Desc },
                                { icon: Users, title: text.aboutWhy2Title, desc: text.aboutWhy2Desc },
                                { icon: Eye, title: text.aboutWhy3Title, desc: text.aboutWhy3Desc }
                            ].map((item, i) => (
                                <div key={i} className="text-center p-6 bg-white rounded-2xl border border-border">
                                    <item.icon className="w-8 h-8 mx-auto mb-4 text-primary" />
                                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
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
