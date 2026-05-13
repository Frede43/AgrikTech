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
            "sticky top-0 z-[100] w-full border-b transition-all duration-300",
            isMenuOpen 
                ? "bg-background border-transparent" 
                : "bg-background/95 backdrop-blur-md border-border"
        )}>
            <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
                {/* Logo */}
                <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity z-[110]">
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                        <Leaf className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground leading-none tracking-tight">AgriConnect</p>
                        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{text.sloganSub}</p>
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
                    <Button asChild size="sm" variant="outline" className="hidden md:flex rounded-lg border-primary/50 text-primary hover:bg-primary/5 font-semibold px-5">
                        <Link href="/connexion">{loginLabel}</Link>
                    </Button>
                    <Button asChild size="sm" className="hidden md:flex rounded-lg font-bold shadow-sm px-5">
                        <Link href="/inscription">{signupLabel}</Link>
                    </Button>

                    {/* Mobile Toggle */}
                    <button 
                        className="md:hidden p-2 text-foreground hover:bg-secondary rounded-xl transition-all border border-border shadow-sm active:shadow-inner"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="w-6 h-6 animate-in spin-in-90 duration-200" /> : <Menu className="w-6 h-6 animate-in zoom-in-50 duration-200" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="md:hidden fixed inset-0 top-16 z-[100] bg-background w-full h-[calc(100vh-4rem)] animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex flex-col h-full overflow-y-auto p-6 pb-32">
                        <nav className="flex flex-col space-y-1 mt-4">
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
                                    className="flex items-center h-16 px-5 text-xl font-bold text-foreground hover:bg-secondary rounded-2xl transition-colors border-b border-border/5 last:border-0"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                        
                        <div className="flex flex-col gap-4 mt-12">
                            <Button asChild variant="outline" className="w-full h-16 rounded-2xl text-xl font-bold border-2 border-primary/20 bg-background">
                                <Link href="/connexion" onClick={() => setIsMenuOpen(false)}>{loginLabel}</Link>
                            </Button>
                            <Button asChild className="w-full h-16 rounded-2xl text-xl font-bold shadow-2xl shadow-primary/20">
                                <Link href="/inscription" onClick={() => setIsMenuOpen(false)}>{signupLabel}</Link>
                            </Button>
                        </div>

                        <div className="mt-auto pt-16">
                            <button
                                onClick={() => { setLang(lang === "fr" ? "ki" : "fr"); setIsMenuOpen(false); }}
                                className="w-full flex items-center justify-between p-6 rounded-2xl bg-secondary border border-border text-sm font-bold text-muted-foreground transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm">
                                        <Globe className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground opacity-70 mb-0.5">Langue actuelle</p>
                                        <p className="text-foreground">{lang === "fr" ? "Passer en Kirundi" : "Hindura mu Gifaransa"}</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-black">
                                    {lang === "fr" ? "KI" : "FR"}
                                </span>
                            </button>
                            <div className="text-center mt-10 space-y-2 opacity-40">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">AgriConnect Burundi</p>
                                <p className="text-[9px] font-medium text-muted-foreground italic">Tekereza kazoza, rima kazoza.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
