"use client";

import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { TestimonialCenter } from "@/components/testimonials/testimonial-center";
import { useLanguage } from "@/lib/LanguageContext";

export default function BuyerTestimonialsPage() {
  const { lang } = useLanguage();
  const copy = {
    fr: {
      title: "Mes témoignages",
      subtitle: "Partagez votre retour d'expérience et suivez la validation admin.",
    },
    ki: {
      title: "Ivyagiriza vyanje",
      subtitle: "Sangiza uko vyagenze kandi ukurikirane isuzumwa rya admin.",
    },
  }[lang];

  return (
    <BuyerLayout title={copy.title} subtitle={copy.subtitle}>
      <TestimonialCenter role="acheteur" />
    </BuyerLayout>
  );
}