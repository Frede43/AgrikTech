"use client";

import Link from "next/link";
import { Leaf, Globe, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

export function SiteHeader() {
    const { lang, setLang, text } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
    }, [isMenuOpen]);

    const loginLabel = text.loginButton || (lang === "fr" ? "Se connecter" : "Kwinjira");
    const signupLabel = text.authCreateAccount || (lang === "fr" ? "S'inscrire" : "Kwiyandikisha");

    return (
        <header className={cn(
            "sticky top-0 z-50 w-full border-b border-border bg-background",
            isMenuOpen 
                ? "border-transparent"
                : ""
        )}>
            <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
                {/* Logo */}
                <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5 text-foreground hover:text-primary transition-colors z-[110]">
                    <Leaf className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                    <div>
                        <p className="text-[15px] font-semibold leading-none tracking-tight">AgriConnect</p>
                        <p className="text-[11px] text-muted-foreground leading-none mt-1">{text.sloganSub}</p>
                    </div>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                    <Link href="/produits" className="hover:text-primary transition-colors">{text.navProducts}</Link>
                    <Link href="/meteo" className="hover:text-primary transition-colors">{text.sideWeather}</Link>
                    <Link href="/a-propos" className="hover:text-primary transition-colors">{text.aboutTitle}</Link>
                    <Link href="/tarifs" className="hover:text-primary transition-colors">{text.feesTitle}</Link>
                </nav>

                <div className="flex items-center gap-2 z-[110]">
                    {/* Language toggle (Desktop) */}
                    <button
                        onClick={() => setLang(lang === "fr" ? "ki" : "fr")}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {lang === "fr" ? "Kirundi" : "Français"}
                    </button>

                    {/* Desktop Auth Buttons */}
                    <Button asChild size="sm" variant="outline" className="hidden md:flex rounded-lg border-border text-foreground hover:bg-secondary font-medium px-4">
                        <Link href="/connexion">{loginLabel}</Link>
                    </Button>
                    <Button asChild size="sm" className="hidden md:flex rounded-lg font-medium px-4">
                        <Link href="/inscription">{signupLabel}</Link>
                    </Button>

                    {/* Mobile Toggle */}
                    <button 
                        className="md:hidden p-2 text-foreground hover:bg-secondary rounded-lg transition-colors border border-border"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="md:hidden fixed inset-0 top-16 z-[100] bg-background w-full h-[calc(100vh-4rem)]">
                    <div className="flex flex-col h-full overflow-y-auto p-5 pb-10">
                        <nav className="flex flex-col mt-2">
                            {[
                                { href: "/produits", label: text.navProducts },
                                { href: "/meteo", label: text.sideWeather },
                                { href: "/a-propos", label: text.aboutTitle },
                                { href: "/tarifs", label: text.feesTitle },
                            ].map((link) => (
                                <Link 
                                    key={link.href}
                                    href={link.href} 
                                    onClick={() => setIsMenuOpen(false)} 
                                    className="flex items-center h-12 px-3 text-base font-medium text-foreground hover:bg-secondary rounded-lg transition-colors border-b border-border last:border-0"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                        
                        <div className="flex flex-col gap-3 mt-8">
                            <Button asChild variant="outline" className="w-full h-12 rounded-lg font-medium border-border bg-background">
                                <Link href="/connexion" onClick={() => setIsMenuOpen(false)}>{loginLabel}</Link>
                            </Button>
                            <Button asChild className="w-full h-12 rounded-lg font-medium">
                                <Link href="/inscription" onClick={() => setIsMenuOpen(false)}>{signupLabel}</Link>
                            </Button>
                        </div>

                        <div className="mt-auto pt-16">
                            <button
                                onClick={() => { setLang(lang === "fr" ? "ki" : "fr"); setIsMenuOpen(false); }}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-secondary border border-border text-sm font-medium text-muted-foreground transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center border border-border">
                                        <Globe className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground opacity-70 mb-0.5">Langue actuelle</p>
                                        <p className="text-foreground">{lang === "fr" ? "Passer en Kirundi" : "Hindura mu Gifaransa"}</p>
                                    </div>
                                </div>
                                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                                    {lang === "fr" ? "KI" : "FR"}
                                </span>
                            </button>
                            <div className="mt-8 border-t border-border pt-4">
                                <p className="text-xs font-medium text-foreground">AgriConnect Burundi</p>
                                <p className="text-xs text-muted-foreground mt-1">{text.sloganSub}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
