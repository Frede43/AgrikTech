"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ShoppingBasket, Truck, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLoginPath } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function OnboardingPage() {
  const router = useRouter();
  const { lang, text } = useLanguage();
  const [current, setCurrent] = useState(0);

  const slides = [
    {
      icon: Leaf,
      color: "bg-primary",
      title: text.onboardS1Title,
      subtitle: text.onboardS1Sub,
      body: text.onboardS1Body,
    },
    {
      icon: ShoppingBasket,
      color: "bg-accent",
      title: text.onboardS2Title,
      subtitle: text.onboardS2Sub,
      body: text.onboardS2Body,
    },
    {
      icon: Truck,
      color: "bg-primary",
      title: text.onboardS3Title,
      subtitle: text.onboardS3Sub,
      body: text.onboardS3Body,
    },
    {
      icon: Star,
      color: "bg-accent",
      title: text.onboardS4Title,
      subtitle: text.onboardS4Sub,
      body: text.onboardS4Body,
    },
  ];

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      router.push(getLoginPath("acheteur"));
    }
  };

  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto px-6 py-10">
      {/* Skip */}
      <div className="flex justify-end">
        <button
          onClick={() => router.push(getLoginPath("acheteur"))}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors py-2 px-4 rounded-full hover:bg-secondary/50"
        >
          {text.onboardSkip}
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-10">
        <div className={cn("w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-xl shadow-primary/10 relative overflow-hidden group", slide.color)}>
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Icon className="w-14 h-14 text-white relative z-10 transition-transform group-hover:scale-110 duration-500" />
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{slide.subtitle}</p>
          <h1 className="text-3xl font-black text-foreground text-balance leading-[1.1] tracking-tight">{slide.title}</h1>
          <p className="text-sm font-medium text-muted-foreground leading-relaxed text-pretty max-w-[280px] mx-auto opacity-80">{slide.body}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto space-y-8">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === current ? "w-8 h-2.5 bg-primary shadow-sm" : "w-2.5 h-2.5 bg-border hover:bg-border/80"
              )}
            />
          ))}
        </div>

        {/* CTA */}
        <Button onClick={next} className="w-full h-14 text-sm font-black uppercase tracking-widest gap-3 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all bg-foreground text-white hover:bg-foreground/90">
          {current < slides.length - 1 ? text.onboardContinue : text.onboardStart}
          <ChevronRight className="w-5 h-5 opacity-50" />
        </Button>
      </div>
    </div>
  );
}
