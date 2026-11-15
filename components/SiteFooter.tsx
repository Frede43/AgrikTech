"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Leaf, MapPin, Mail, Phone, Globe } from "lucide-react";
import { apiFetch, getLoginPath, getSignupPath } from "@/lib/api-config";

import { useLanguage } from "@/lib/LanguageContext";

interface PlatformContact {
    support_phone: string;
    support_whatsapp: string;
    support_email: string;
    support_address: string;
}

export function SiteFooter() {
    const { lang, setLang, text } = useLanguage();
    const adminPortalLabel = lang === "fr" ? "Portail Admin" : "Ikibanza c'Admin";
    const obrPortalLabel = lang === "fr" ? "Portail OBR" : "Ikibanza c'OBR";
    const ministryPortalLabel = lang === "fr" ? "Portail Ministère de l'Agriculture" : "Ikibanza c'Ubuyobozi bw'Uburimyi";
    const switchLanguageLabel = lang === "fr" ? "Passer en kirundi" : "Subira mu gifaransa";

    // Coordonnées de contact réellement modifiables par un admin (Paramètres
    // > support_phone/whatsapp/email/address), plutôt que codées en dur ici.
    // Repli sur les textes de traduction tant que l'appel n'a pas abouti.
    const [contact, setContact] = useState<PlatformContact | null>(null);
    useEffect(() => {
        let active = true;
        apiFetch("/platform/settings")
            .then((data) => {
                if (active) setContact(data as PlatformContact);
            })
            .catch(() => { /* Repli silencieux sur les valeurs statiques */ });
        return () => {
            active = false;
        };
    }, []);
    const contactAddress = contact?.support_address || text.footerAddress;
    const contactEmail = contact?.support_email || text.footerEmail;
    const contactPhone = contact?.support_phone || "+25776000000";

    return (
        <footer className="bg-secondary/70 text-muted-foreground border-t border-border">
            <div className="max-w-6xl mx-auto px-4 md:px-6 pt-12 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
                    {/* Column 1: Brand */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2.5">
                            <Leaf className="w-5 h-5 text-primary" aria-hidden="true" />
                            <div>
                                <p className="text-[15px] font-semibold text-foreground leading-none">AgriConnect</p>
                                <p className="text-[11px] text-muted-foreground leading-none mt-1">Burundi</p>
                            </div>
                        </Link>
                        <p className="text-sm leading-relaxed max-w-xs">
                            {text.aboutBody}
                        </p>
                    </div>

                    {/* Column 2: Platform */}
                    <div className="space-y-4">
                        <h4 className="text-foreground font-semibold text-sm">{text.colPlatform}</h4>
                        <ul className="space-y-2.5 text-sm">
                            <li><Link href="/produits" className="hover:text-primary transition-colors">{text.footerBrowse}</Link></li>
                            <li><Link href="/tarifs" className="hover:text-primary transition-colors">{text.feesTitle}</Link></li>
                            <li><Link href="/a-propos" className="hover:text-primary transition-colors">{text.aboutTitle}</Link></li>
                            <li><Link href="/meteo" className="hover:text-primary transition-colors">{text.weatherTitle}</Link></li>
                        </ul>
                    </div>

                    {/* Column 3: Espaces */}
                    <div className="space-y-4">
                        <h4 className="text-foreground font-semibold text-sm">{text.colSpaces}</h4>
                        <ul className="space-y-2.5 text-sm">
                            <li><Link href={getSignupPath("fermier")} className="hover:text-primary transition-colors">{text.roleFarmer}</Link></li>
                            <li><Link href={getSignupPath("acheteur")} className="hover:text-primary transition-colors">{text.roleBuyer}</Link></li>
                            <li><Link href={getSignupPath("logistique")} className="hover:text-primary transition-colors">{text.roleDriver}</Link></li>
                            <li><Link href={getLoginPath("admin")} className="hover:text-primary transition-colors">{adminPortalLabel}</Link></li>
                            <li><Link href={getLoginPath("obr")} className="hover:text-primary transition-colors">{obrPortalLabel}</Link></li>
                            <li><Link href={getLoginPath("ministere_agriculture")} className="hover:text-primary transition-colors">{ministryPortalLabel}</Link></li>
                        </ul>
                    </div>

                    {/* Column 4: Contact */}
                    <div className="space-y-4">
                        <h4 className="text-foreground font-semibold text-sm">{text.colContact}</h4>
                        <ul className="space-y-2.5 text-sm">
                            <li className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                <span>{contactAddress}</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                <a href={`mailto:${contactEmail}`} className="hover:text-white transition-colors">{contactEmail}</a>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                <a href={`tel:${contactPhone}`} className="hover:text-white transition-colors">{contactPhone}</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-5 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        {text.footer}
                    </p>
                    <div className="flex items-center gap-5 text-xs font-medium">
                        <Link href="/conditions" className="hover:text-white transition-colors">{text.legalTerms}</Link>
                        <Link href="/confidentialite" className="hover:text-white transition-colors">{text.legalPrivacy}</Link>
                        <button
                            onClick={() => setLang(lang === "fr" ? "ki" : "fr")}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-background transition-colors"
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
