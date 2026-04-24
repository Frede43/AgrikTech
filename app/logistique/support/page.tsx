"use client";

import { LogisticsLayout } from "@/components/logistics/logistics-layout";
import { SupportCenter } from "@/components/support/support-center";
import { useLanguage } from "@/lib/LanguageContext";

export default function LogisticsSupportPage() {
  const { text } = useLanguage();

  const logisticsFaqs = [
    {
      question: text.logiFaq1Q,
      answer: text.logiFaq1A,
    },
    {
      question: text.logiFaq2Q,
      answer: text.logiFaq2A,
    },
  ];

  return (
    <LogisticsLayout title="Aide & Support" subtitle={text.logiSupportSub}>
      <SupportCenter
        role="logistique"
        whatsappTitle={text.logiSupportWaTitle}
        whatsappDescription={text.logiSupportWaDesc}
        phoneTitle={text.logiSupportPhoneTitle}
        phoneDescription={text.logiSupportPhoneDesc}
        ticketIntro={text.logiSupportTicketIntro}
        faqs={logisticsFaqs}
      />
    </LogisticsLayout>
  );
}
