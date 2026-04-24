"use client";

import { LogisticsLayout } from "@/components/logistics/logistics-layout";
import { ProfileSettingsForm } from "@/components/account/profile-settings-form";
import { useLanguage } from "@/lib/LanguageContext";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LogisticsParametresPage() {
    const { lang, setLang, text } = useLanguage();

    const languages = [
        { code: "ki", label: "Kirundi", flag: "🇧🇮", native: "Ikirundi" },
        { code: "fr", label: "Français", flag: "🇫🇷", native: "Français" },
    ];

    return (
        <LogisticsLayout title={text.settingsTitle} subtitle={text.settingsSubtitle}>
            <div className="space-y-8 max-w-2xl mx-auto px-4 py-6 pb-24">
                {/* Language Selection Card */}
                <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-primary/10">
                                <Globe className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-foreground tracking-tight">{text.settingsLangTitle}</h2>
                                <p className="text-sm font-medium text-muted-foreground mt-0.5">{text.settingsLangSub}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-3">
                        {languages.map((l) => (
                            <button
                                key={l.code}
                                onClick={() => setLang(l.code as any)}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group",
                                    lang === l.code
                                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5 scale-[1.02]"
                                        : "border-border hover:border-primary/40 hover:bg-secondary/50 hover:scale-[1.01]"
                                )}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-white shadow-sm border transition-colors",
                                        lang === l.code ? "border-primary/20" : "border-border/50 group-hover:border-primary/20"
                                    )}>
                                        {l.flag}
                                    </div>
                                    <div className="text-left">
                                        <p className={cn(
                                            "text-base font-black tracking-tight",
                                            lang === l.code ? "text-primary" : "text-foreground group-hover:text-primary/80"
                                        )}>
                                            {l.label}
                                        </p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
                                            {l.native}
                                        </p>
                                    </div>
                                </div>
                                {lang === l.code && (
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm shadow-primary/20 animate-in zoom-in duration-300">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Profile Settings Section */}
                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 space-y-6">
                    <div>
                        <h2 className="text-xl font-black text-foreground tracking-tight">{text.logiSettingsProfileTitle}</h2>
                        <p className="text-sm font-medium text-muted-foreground mt-1">{text.logiSettingsProfileSub}</p>
                    </div>
                    <ProfileSettingsForm
                        role="logistique"
                        nameLabel={text.logiSettingsNameLabel}
                        intro={text.logiSettingsIntro}
                    />
                </div>
            </div>
        </LogisticsLayout>
    );
}
