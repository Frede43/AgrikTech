"use client";

import { ObrSidebar } from "./obr-sidebar";
import { Menu, Landmark } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/lib/LanguageContext";

interface ObrLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function ObrLayout({ children, title, subtitle }: ObrLayoutProps) {
  const { lang } = useLanguage();
  const copy = {
    fr: {
      openMenu: "Ouvrir le menu",
      navTitle: "Navigation OBR",
      navDescription: "Menu de navigation OBR",
      space: "Espace OBR",
    },
    ki: {
      openMenu: "Gufungura menu",
      navTitle: "Ugucungera kwa OBR",
      navDescription: "Menu ya OBR",
      space: "Ikibanza c'OBR",
    },
  }[lang];

  return (
    <div className="flex min-h-screen bg-background">
      <ObrSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center gap-4 px-4 md:px-6 py-4 bg-card border-b border-border">
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label={copy.openMenu}
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <SheetTitle className="sr-only">{copy.navTitle}</SheetTitle>
              <SheetDescription className="sr-only">{copy.navDescription}</SheetDescription>
              <ObrSidebar mobile />
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground shrink-0">
            <Landmark className="w-3.5 h-3.5 text-primary" />
            {copy.space}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
