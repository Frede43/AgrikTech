"use client";

import Link from "next/link";
import { Leaf, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginPath, getSignupPath } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export function SiteHeader() {
    const { lang, setLang, text } = useLanguage();
    const loginLabel = text.loginButton || (lang === "fr" ? "Se connecter" : "Kwinjira");
    const signupLabel = text.authCreateAccount || (lang === "fr" ? "S'inscrire" : "Kwiyandikisha");

    return (
        <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border">
            <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                        <Leaf className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground leading-none">AgriConnect</p>
                        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{text.sloganSub}</p>
                    </div>
                </Link>

                {/* Nav + lang */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                    <Link href="/produits" className="hover:text-primary transition-colors">{text.navProducts}</Link>
                    <Link href="/a-propos" className="hover:text-primary transition-colors">{text.aboutTitle}</Link>
                    <Link href="/tarifs" className="hover:text-primary transition-colors">{text.feesTitle}</Link>
                </nav>

                <div className="flex items-center gap-2">
                    {/* Language toggle */}
                    <button
                        onClick={() => setLang(lang === "fr" ? "ki" : "fr")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {lang === "fr" ? "Kirundi" : "Français"}
                    </button>

                    {/* Login button */}
                    <Button asChild size="sm" variant="outline" className="hidden md:flex rounded-lg border-primary text-primary hover:bg-primary/5 font-semibold">
                        <Link href="/connexion">{loginLabel}</Link>
                    </Button>
                    <Button asChild size="sm" className="hidden md:flex rounded-lg font-semibold shadow-sm translate-y-0 active:translate-y-0.5 transition-all">
                        <Link href="/inscription">{signupLabel}</Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
