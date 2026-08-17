"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api-config";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface PlatformContact {
  support_email: string;
  support_address: string;
}

const FALLBACK_CONTACT: PlatformContact = {
  support_email: "contact@agriconnect.bi",
  support_address: "Bujumbura, Burundi (Rohero II)",
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

export default function PrivacyPage() {
  const [contact, setContact] = useState<PlatformContact>(FALLBACK_CONTACT);

  useEffect(() => {
    let active = true;
    apiFetch("/platform/settings")
      .then((data) => {
        const payload = data as Partial<PlatformContact>;
        if (active && payload.support_email) {
          setContact({
            support_email: payload.support_email,
            support_address: payload.support_address || FALLBACK_CONTACT.support_address,
          });
        }
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
            <ShieldCheck className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-widest">AgriConnect Burundi</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">Politique de confidentialité</h1>
          <p className="mt-3 text-sm text-muted-foreground">Dernière mise à jour : à définir lors de la publication finale.</p>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              <strong>Brouillon en cours de validation juridique.</strong> Ce document décrit fidèlement les données
              réellement traitées par l&apos;application, mais n&apos;a pas encore été relu par un juriste et
              pourra être révisé avant d&apos;être considéré comme définitif.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <Section id="intro" title="1. Qui traite vos données">
            <p>
              AgriConnect Burundi (« AgriConnect », « nous ») est exploité par{" "}
              <strong>[Nom de l&apos;entité juridique à préciser]</strong>. Pour toute question relative à vos
              données personnelles, contactez-nous à{" "}
              <a className="text-primary hover:underline" href={`mailto:${contact.support_email}`}>
                {contact.support_email}
              </a>{" "}
              ou à l&apos;adresse : {contact.support_address}.
            </p>
          </Section>

          <Section id="donnees" title="2. Les données que nous collectons">
            <p>Selon votre rôle et votre usage de l&apos;application, nous collectons :</p>
            <ul>
              <li><strong>Identification</strong> — nom, numéro de téléphone (utilisé pour la connexion par code SMS, sans mot de passe), rôle sur la plateforme.</li>
              <li><strong>Localisation</strong> — province, commune, adresse et, si vous les renseignez, vos coordonnées GPS, pour situer vos produits ou calculer les frais de livraison.</li>
              <li><strong>Vérification d&apos;identité (KYC)</strong> — pour les fermiers demandant un retrait ou un crédit : numéro de pièce d&apos;identité et une photo ou un scan de cette pièce.</li>
              <li><strong>Transactions</strong> — historique de vos commandes, ventes, retraits et demandes de crédit, y compris les montants.</li>
              <li><strong>Communications</strong> — messages échangés avec d&apos;autres utilisateurs, tickets envoyés au support, avis et témoignages publiés.</li>
              <li><strong>Technique</strong> — un cookie de session nécessaire à la connexion (aucun cookie publicitaire ou de suivi tiers).</li>
            </ul>
          </Section>

          <Section id="usage" title="3. Pourquoi nous les utilisons">
            <ul>
              <li>Vous authentifier et sécuriser votre compte (code de connexion par SMS).</li>
              <li>Permettre les transactions entre fermiers, acheteurs et livreurs, et calculer les frais de livraison réels.</li>
              <li>Vérifier votre identité avant un retrait ou un crédit, conformément à nos obligations de vigilance financière.</li>
              <li>Produire les déclarations de TVA requises par l&apos;Office Burundais des Recettes (OBR) sur les ventes réalisées.</li>
              <li>Produire des statistiques agrégées et non-nominatives à destination du Ministère de l&apos;Agriculture (aucune donnée financière ni identité individuelle n&apos;y figure).</li>
              <li>Répondre à vos demandes de support.</li>
            </ul>
          </Section>

          <Section id="partage" title="4. Avec qui vos données sont partagées">
            <ul>
              <li><strong>Le fermier ou l&apos;acheteur concerné par une commande</strong> voit le nom, l&apos;adresse et le numéro de téléphone nécessaires à la livraison de cette commande précise.</li>
              <li><strong>Le livreur assigné</strong> voit les coordonnées de collecte et de livraison de la commande qui lui est confiée.</li>
              <li><strong>Notre opérateur SMS</strong> reçoit votre numéro de téléphone pour vous transmettre votre code de connexion.</li>
              <li><strong>L&apos;opérateur mobile money</strong> (Lumicash, EcoCash, Airtel Money) reçoit les informations nécessaires au paiement ou au retrait que vous initiez.</li>
              <li><strong>L&apos;OBR</strong> reçoit les données de ventes et de TVA des fermiers, comme l&apos;exige la réglementation fiscale burundaise.</li>
              <li><strong>Les administrateurs AgriConnect</strong> peuvent consulter vos documents KYC pour les vérifier, et vos tickets de support pour y répondre.</li>
            </ul>
            <p>Nous ne vendons aucune donnée personnelle à des tiers.</p>
          </Section>

          <Section id="conservation" title="5. Durée de conservation">
            <p>
              Vos données sont conservées tant que votre compte est actif. Les données de transaction et de
              facturation peuvent être conservées au-delà, pour la durée exigée par la réglementation fiscale et
              comptable burundaise.
            </p>
          </Section>

          <Section id="droits" title="6. Vos droits">
            <p>Vous pouvez à tout moment :</p>
            <ul>
              <li>Consulter et corriger vos informations de profil depuis les Paramètres de votre compte.</li>
              <li>Demander une copie des données vous concernant en contactant le support.</li>
              <li>Demander la suppression de votre compte, sous réserve des données que nous devons conserver pour nos obligations légales (notamment fiscales).</li>
              <li>Contester le rejet d&apos;un dossier KYC en ouvrant un ticket de support.</li>
            </ul>
          </Section>

          <Section id="securite" title="7. Sécurité">
            <p>
              La connexion se fait par code à usage unique envoyé par SMS, sans mot de passe stocké. Votre session
              est protégée par un cookie sécurisé. L&apos;accès aux documents KYC est restreint aux administrateurs
              chargés de leur vérification.
            </p>
          </Section>

          <Section id="modifications" title="8. Modifications de cette politique">
            <p>
              Cette politique peut évoluer, notamment à mesure que de nouvelles fonctionnalités sont ajoutées. Toute
              modification substantielle vous sera signalée dans l&apos;application.
            </p>
          </Section>

          <Section id="contact" title="9. Contact">
            <p>
              Pour toute question sur cette politique ou vos données personnelles :{" "}
              <a className="text-primary hover:underline" href={`mailto:${contact.support_email}`}>
                {contact.support_email}
              </a>
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
