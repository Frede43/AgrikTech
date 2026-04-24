"use client";

import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminTestimonialModeration } from "@/components/testimonials/admin-testimonial-moderation";
import { useLanguage } from "@/lib/LanguageContext";

export default function AdminTestimonialsPage() {
  const { lang } = useLanguage();
  const copy = {
    fr: {
      title: "Validation des témoignages",
      subtitle: "Décider quels témoignages utilisateur seront publiés sur la page d'accueil.",
    },
    ki: {
      title: "Kwemeza ivyagiriza",
      subtitle: "Fata ingingo ku vyagiriza vy'abakoresha bizoshirwa ku rubuga rw'intango.",
    },
  }[lang];

  return (
    <AdminLayout title={copy.title} subtitle={copy.subtitle}>
      <AdminTestimonialModeration />
    </AdminLayout>
  );
}