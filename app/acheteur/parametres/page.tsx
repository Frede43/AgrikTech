"use client";

import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { ProfileSettingsForm } from "@/components/account/profile-settings-form";
import { useLanguage } from "@/lib/LanguageContext";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BuyerParametresPage() {
    const { lang, setLang, text } = useLanguage();

    const languages = [
        { code: "ki", label: "Kirundi", flag: "🇧🇮", native: "Ikirundi" },
        { code: "fr", label: "Français", flag: "🇫🇷", native: "Français" },
    ];

    return (
        <BuyerLayout title={text.settingsTitle} subtitle={text.settingsSubtitle}>
            <div className="space-y-8 max-w-2xl">
                {/* Language Selection Card */}
                <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-border bg-secondary/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Globe className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-foreground">{text.settingsLangTitle}</h2>
                                <p className="text-xs text-muted-foreground">{text.settingsLangSub}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-3">
                        {languages.map((l) => (
                            <button
                                key={l.code}
                                onClick={() => setLang(l.code as any)}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                                    lang === l.code
                                        ? "border-primary bg-primary/5 shadow-sm"
                                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl">{l.flag}</span>
                                    <div className="text-left">
                                        <p className={cn(
                                            "text-sm font-bold",
                                            lang === l.code ? "text-primary" : "text-foreground"
                                        )}>
                                            {l.label}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                            {l.native}
                                        </p>
                                    </div>
                                </div>
                                {lang === l.code && (
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Profile Settings Section */}
                <div>
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-foreground">{text.settingsProfileTitle}</h2>
                        <p className="text-sm text-muted-foreground">{text.settingsProfileSub}</p>
                    </div>
                    <ProfileSettingsForm
                        role="acheteur"
                        nameLabel={lang === "fr" ? "Nom / établissement" : "Izina ry'umuguzi / Ishirahamwe"}
                        intro={lang === "fr"
                            ? "Mettez à jour votre adresse principale et vos coordonnées GPS pour fiabiliser la livraison et vos dashboards."
                            : "Uzuza aho usanzwe uherereye kugira ngo boroherwe mu kukuzanira ivyo watumye."
                        }
                    />
                </div>
            </div>
        </BuyerLayout>
    );
}
