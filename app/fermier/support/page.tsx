"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SupportCenter } from "@/components/support/support-center";
import { useLanguage } from "@/lib/LanguageContext";

export default function SupportPage() {
  const { lang, text } = useLanguage();

  const farmerFaqs = [
    {
      question: lang === "fr" ? "Comment retirer mes revenus vers Lumicash ?" : "Nshobora gute gukura amafaranga yanje kuri Lumicash ?",
      answer:
        lang === "fr"
          ? "Ouvrez Portefeuille, vérifiez votre numéro lié puis lancez un retrait d'au moins 10 000 BIF."
          : "Fungura Uruhago, suzuma inomero yawe maze utume amafaranga atari musi ya 10 000 BIF.",
    },
    {
      question: lang === "fr" ? "À qui montrer le QR de prise en charge ?" : "Nkwiriye kwereka nde inomero ya QR ?",
      answer:
        lang === "fr"
          ? "Présentez ce QR uniquement au livreur AgriConnect chargé de récupérer votre récolte pour la commande concernée."
          : "Ereka iyi QR umutunzi wa AgriConnect aje gutwara ibimera vyawe gusa.",
    },
  ];

  return (
    <DashboardLayout title={text.supportTitle} subtitle={text.supportSubtitle}>
      <SupportCenter
        role="fermier"
        whatsappTitle={text.supportWhatsappSales}
        whatsappDescription={text.supportWhatsappDesc}
        phoneTitle={text.supportHotlineTitle}
        phoneDescription={text.supportHotlineDesc}
        ticketIntro={text.supportTicketIntro}
        faqs={farmerFaqs}
      />
    </DashboardLayout>
  );
}
