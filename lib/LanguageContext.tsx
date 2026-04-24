"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Lang, t } from "./translations";

interface LanguageContextType {
    lang: Lang;
    setLang: (lang: Lang) => void;
    text: Record<string, string>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLang] = useState<Lang>("fr");

    useEffect(() => {
        const savedLang = localStorage.getItem("app-lang") as Lang;
        if (savedLang && (savedLang === "fr" || savedLang === "ki")) {
            setLang(savedLang);
        }
    }, []);

    const handleSetLang = (newLang: Lang) => {
        setLang(newLang);
        localStorage.setItem("app-lang", newLang);
    };

    const value = {
        lang,
        setLang: handleSetLang,
        text: t[lang],
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
