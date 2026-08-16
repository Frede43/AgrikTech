"use client";

import { LogisticsSidebar } from "./logistics-sidebar";
import { Menu, Truck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/lib/LanguageContext";
import { LogisticsSidebar as MobileSidebar } from "./logistics-sidebar";

interface LogisticsLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function LogisticsLayout({ children, title, subtitle }: LogisticsLayoutProps) {
  const { lang } = useLanguage();
  const copy = {
    fr: {
      openMenu: "Ouvrir le menu",
      navTitle: "Navigation Livreur",
      navDescription: "Menu de navigation livreur",
      space: "Espace Livreur",
    },
    ki: {
      openMenu: "Gufungura menu",
      navTitle: "Ugucungera kw'umushikiriza",
      navDescription: "Menu y'umushikiriza",
      space: "Ikibanza c'Umushikiriza",
    },
  }[lang];

  return (
    <div className="flex min-h-screen bg-background">
      <LogisticsSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 flex items-center gap-4 px-4 md:px-6 py-4 bg-card border-b border-border">
          {/* Mobile menu trigger */}
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
              <MobileSidebar mobile />
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground shrink-0">
            <Truck className="w-3.5 h-3.5 text-primary" />
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
