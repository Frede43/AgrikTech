"use client";

import Link from "next/link";
import { Leaf, MapPin, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Globe } from "lucide-react";
import { getLoginPath, getSignupPath } from "@/lib/api-config";

import { useLanguage } from "@/lib/LanguageContext";

export function SiteFooter() {
    const { lang, setLang, text } = useLanguage();
    const adminPortalLabel = lang === "fr" ? "Portail Admin" : "Ikibanza c'Admin";
    const switchLanguageLabel = lang === "fr" ? "Passer en kirundi" : "Subira mu gifaransa";

    return (
        <footer className="bg-slate-950 text-slate-400 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 md:px-6 pt-16 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Column 1: Brand */}
                    <div className="space-y-6">
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                                <Leaf className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <div>
                                <p className="text-base font-bold text-white leading-none">AgriConnect</p>
                                <p className="text-[10px] text-primary leading-none mt-1 uppercase tracking-widest font-bold">Burundi</p>
                            </div>
                        </Link>
                        <p className="text-sm leading-relaxed max-w-xs transition-colors hover:text-slate-300">
                            {text.aboutBody}
                        </p>
                        <div className="flex items-center gap-4 pt-2">
                            {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                                <a key={i} href="#" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-300">
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Platform */}
                    <div className="space-y-6">
                        <h4 className="text-white font-bold text-sm uppercase tracking-wider">{text.colPlatform}</h4>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/produits" className="hover:text-primary transition-colors">{text.footerBrowse}</Link></li>
                            <li><Link href="/tarifs" className="hover:text-primary transition-colors">{text.feesTitle}</Link></li>
                            <li><Link href="/a-propos" className="hover:text-primary transition-colors">{text.aboutTitle}</Link></li>
                            <li><Link href="/meteo" className="hover:text-primary transition-colors">{text.weatherTitle}</Link></li>
                        </ul>
                    </div>

                    {/* Column 3: Espaces */}
                    <div className="space-y-6">
                        <h4 className="text-white font-bold text-sm uppercase tracking-wider">{text.colSpaces}</h4>
                        <ul className="space-y-4 text-sm">
                            <li><Link href={getSignupPath("fermier")} className="hover:text-primary transition-colors">{text.roleFarmer}</Link></li>
                            <li><Link href={getSignupPath("acheteur")} className="hover:text-primary transition-colors">{text.roleBuyer}</Link></li>
                            <li><Link href={getSignupPath("logistique")} className="hover:text-primary transition-colors">{text.roleDriver}</Link></li>
                            <li><Link href={getLoginPath("admin")} className="hover:text-primary transition-colors">{adminPortalLabel}</Link></li>
                        </ul>
                    </div>

                    {/* Column 4: Contact */}
                    <div className="space-y-6">
                        <h4 className="text-white font-bold text-sm uppercase tracking-wider">{text.colContact}</h4>
                        <ul className="space-y-4 text-sm">
                            <li className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{text.footerAddress}</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="w-4 h-4 text-primary shrink-0" />
                                <a href={`mailto:${text.footerEmail}`} className="hover:text-white transition-colors">{text.footerEmail}</a>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone className="w-4 h-4 text-primary shrink-0" />
                                <a href="tel:+25776000000" className="hover:text-white transition-colors">+257 76 000 000</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-xs text-slate-500">
                        {text.footer}
                    </p>
                    <div className="flex items-center gap-8 text-xs font-medium">
                        <a href="#" className="hover:text-white transition-colors">{text.legalTerms}</a>
                        <a href="#" className="hover:text-white transition-colors">{text.legalPrivacy}</a>
                        <button
                            onClick={() => setLang(lang === "fr" ? "ki" : "fr")}
                            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                        >
                            <Globe className="w-3 h-3" />
                            {switchLanguageLabel}
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
}
