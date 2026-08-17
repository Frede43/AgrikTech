"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { AlertTriangle, ScrollText } from "lucide-react";

interface PlatformInfo {
  support_email: string;
  standard_commission_rate?: number;
  promo_commission_rate?: number;
  promo_sales_threshold?: number;
}

const FALLBACK: Required<PlatformInfo> = {
  support_email: "contact@agriconnect.bi",
  standard_commission_rate: 0.05,
  promo_commission_rate: 0.02,
  promo_sales_threshold: 20,
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_li]:list-disc [&_li]:ml-5">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  const [info, setInfo] = useState<Required<PlatformInfo>>(FALLBACK);

  useEffect(() => {
    let active = true;
    Promise.all([apiFetch("/platform/settings"), apiFetch("/stats/public")])
      .then(([settings, stats]) => {
        if (!active) return;
        const s = settings as Partial<PlatformInfo>;
        const st = stats as Partial<PlatformInfo>;
        setInfo({
          support_email: s.support_email || FALLBACK.support_email,
          standard_commission_rate: st.standard_commission_rate ?? FALLBACK.standard_commission_rate,
          promo_commission_rate: st.promo_commission_rate ?? FALLBACK.promo_commission_rate,
          promo_sales_threshold: st.promo_sales_threshold ?? FALLBACK.promo_sales_threshold,
        });
      })
      .catch(() => { /* Repli silencieux sur les valeurs par défaut */ });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <ScrollText className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-widest">AgriConnect Burundi</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">Conditions d&apos;utilisation</h1>
          <p className="mt-3 text-sm text-muted-foreground">Dernière mise à jour : à définir lors de la publication finale.</p>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              <strong>Brouillon en cours de validation juridique.</strong> Ce document décrit fidèlement le
              fonctionnement réel de l&apos;application, mais n&apos;a pas encore été relu par un juriste et pourra
              être révisé avant d&apos;être considéré comme définitif.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <Section id="objet" title="1. Objet">
            <p>
              AgriConnect Burundi (« AgriConnect », exploité par{" "}
              <strong>[Nom de l&apos;entité juridique à préciser]</strong>) est une marketplace mettant en relation
              des fermiers, des acheteurs et des livreurs au Burundi. AgriConnect agit comme intermédiaire
              technique et facilite le paiement et la livraison ; les fermiers restent seuls responsables de
              l&apos;exactitude de leurs annonces et de la qualité des produits vendus.
            </p>
          </Section>

          <Section id="compte" title="2. Créer un compte">
            <ul>
              <li>Un compte nécessite un numéro de téléphone valide ; la connexion se fait par code à usage unique envoyé par SMS, sans mot de passe.</li>
              <li>Les comptes Administrateur, OBR et Ministère de l&apos;Agriculture sont créés uniquement par un administrateur AgriConnect, pas par inscription publique.</li>
              <li>Vous êtes responsable de la confidentialité de l&apos;accès à votre numéro de téléphone, seul moyen de connexion à votre compte.</li>
            </ul>
          </Section>

          <Section id="vente" title="3. Vendre sur AgriConnect (fermiers)">
            <ul>
              <li>Vous garantissez l&apos;exactitude des informations publiées (prix, quantité, catégorie, provenance).</li>
              <li>
                Certaines catégories peuvent être temporairement restreintes à la vente le temps d&apos;une
                clarification réglementaire — c&apos;est actuellement le cas du café et du thé, régulés par
                l&apos;ODECA et l&apos;OTB.
              </li>
              <li>
                Une commission de <strong>{Math.round(info.promo_commission_rate * 100)} %</strong> s&apos;applique
                sur vos <strong>{info.promo_sales_threshold} premières ventes livrées</strong>, puis de{" "}
                <strong>{Math.round(info.standard_commission_rate * 100)} %</strong> ensuite. Cette commission ne
                porte que sur le prix de vos produits — jamais sur les frais de livraison, intégralement reversés
                au livreur.
              </li>
              <li>
                Un retrait vers votre compte mobile money nécessite un montant minimum de {formatBIF(10000)} et que
                votre identité soit vérifiée (KYC).
              </li>
            </ul>
          </Section>

          <Section id="achat" title="4. Acheter sur AgriConnect (acheteurs)">
            <ul>
              <li>Le montant affiché au paiement correspond exactement à ce qui vous est demandé : prix des produits plus les frais de livraison réels, sans frais caché.</li>
              <li>
                Votre paiement est conservé par AgriConnect (séquestre) et n&apos;est reversé au fermier
                qu&apos;après confirmation de la livraison au moyen d&apos;un code que vous communiquez au livreur.
              </li>
              <li>En cas de problème (produit non conforme, non-livraison), vous pouvez ouvrir un litige depuis le suivi de votre commande.</li>
            </ul>
          </Section>

          <Section id="livraison" title="5. Livraison">
            <p>
              Les livreurs confirment la collecte auprès du fermier via un QR code, puis la livraison auprès de
              l&apos;acheteur via un code de validation. Ces deux étapes déclenchent respectivement le début et la
              fin du transport de la commande, et conditionnent le versement du paiement au fermier.
            </p>
          </Section>

          <Section id="litiges" title="6. Litiges et remboursements">
            <p>
              Tout litige ouvert est examiné par l&apos;équipe AgriConnect, qui peut valider un remboursement
              partiel ou total, ou rejeter la demande avec motif. AgriConnect s&apos;efforce de traiter les litiges
              dans un délai raisonnable, sans garantir de délai fixe à ce stade.
            </p>
          </Section>

          <Section id="suspension" title="7. Suspension et résiliation">
            <p>
              AgriConnect peut suspendre ou clôturer un compte en cas de fraude, de fausse déclaration, de
              non-respect de ces conditions, ou d&apos;usage abusif de la plateforme. Vous pouvez à tout moment
              demander la clôture de votre compte en contactant le support.
            </p>
          </Section>

          <Section id="responsabilite" title="8. Limitation de responsabilité">
            <p>
              AgriConnect met en relation les utilisateurs et facilite le paiement et la livraison, mais
              n&apos;est ni le vendeur ni l&apos;acheteur des produits échangés. Dans la limite permise par la loi
              burundaise, AgriConnect ne saurait être tenu responsable de la qualité des produits, d&apos;un retard
              de livraison imputable à un tiers, ou d&apos;une interruption temporaire du service.
            </p>
          </Section>

          <Section id="droit" title="9. Droit applicable">
            <p>Ces conditions sont régies par le droit de la République du Burundi.</p>
          </Section>

          <Section id="modifications" title="10. Modifications">
            <p>
              Ces conditions peuvent évoluer avec les fonctionnalités de l&apos;application. Toute modification
              substantielle vous sera signalée dans l&apos;application.
            </p>
          </Section>

          <Section id="contact" title="11. Contact">
            <p>
              Pour toute question sur ces conditions :{" "}
              <a className="text-primary hover:underline" href={`mailto:${info.support_email}`}>
                {info.support_email}
              </a>
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
