"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { apiFetch, clearSessionSnapshot } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function LogoutPage() {
    const router = useRouter();
    const { lang } = useLanguage();
    const copy = lang === "fr"
        ? {
            title: "Déconnexion en cours…",
            subtitle: "Nous fermons votre session de manière sécurisée.",
        }
        : {
            title: "Turiko turagusohora…",
            subtitle: "Turiko turafunga session yawe mu mutekano.",
        };

    useEffect(() => {
        clearSessionSnapshot();
        apiFetch("/auth/logout", { method: "POST" })
            .catch(() => null)
            .finally(() => {
                router.replace("/");
            });
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <LogOut className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-2">
                <h1 className="text-xl font-semibold">{copy.title}</h1>
                <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
    );
}