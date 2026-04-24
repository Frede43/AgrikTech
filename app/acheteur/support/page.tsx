"use client";

import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { SupportCenter } from "@/components/support/support-center";
import { useLanguage } from "@/lib/LanguageContext";

export default function BuyerSupportPage() {
  const { text } = useLanguage();

  return (
    <BuyerLayout title={text.profMenuHelp} subtitle={text.supportBuyerSubtitle}>
      <SupportCenter
        role="acheteur"
        whatsappTitle={text.supportBuyerWhatsappTitle}
        whatsappDescription={text.supportBuyerWhatsappDesc}
        phoneTitle={text.supportBuyerPhoneTitle}
        phoneDescription={text.supportBuyerPhoneDesc}
        ticketIntro={text.supportBuyerTicketIntro}
      />
    </BuyerLayout>
  );
}
