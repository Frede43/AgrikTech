"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { TestimonialCenter } from "@/components/testimonials/testimonial-center";
import { useLanguage } from "@/lib/LanguageContext";

export default function FarmerTestimonialsPage() {
  const { lang } = useLanguage();
  const copy = {
    fr: {
      title: "Mes témoignages",
      subtitle: "Racontez votre expérience vendeur et suivez la décision admin.",
    },
    ki: {
      title: "Ivyagiriza vyanje",
      subtitle: "Sigura uko vyagenze mu kugurisha kandi ukurikirane ingingo ya admin.",
    },
  }[lang];

  return (
    <DashboardLayout title={copy.title} subtitle={copy.subtitle}>
      <TestimonialCenter role="fermier" />
    </DashboardLayout>
  );
}