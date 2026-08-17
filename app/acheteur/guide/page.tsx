"use client";

import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { GuideSections, type GuideSection } from "@/components/guide/guide-sections";
import {
  UserCheck,
  Search,
  ShoppingCart,
  CreditCard,
  Truck,
  CloudSun,
  Star,
  MessageCircle,
  WifiOff,
  LifeBuoy,
} from "lucide-react";

const sections: GuideSection[] = [
  {
    id: "compte",
    icon: UserCheck,
    title: "Créer votre compte et vous connecter",
    summary: "Inscription, connexion par code SMS",
    content: (
      <p>
        Depuis l&apos;accueil, choisissez <strong>Acheteur</strong> puis renseignez votre numéro de téléphone. Un
        code à 4 chiffres vous est envoyé par SMS : saisissez-le pour vous connecter, aucun mot de passe
        n&apos;est nécessaire. Complétez ensuite votre profil (nom, adresse) pour faciliter vos futures livraisons.
      </p>
    ),
  },
  {
    id: "recherche",
    icon: Search,
    title: "Rechercher des produits",
    summary: "Catalogue, provenance et traçabilité",
    content: (
      <p>
        Utilisez <strong>Recherche</strong> pour parcourir les produits par catégorie ou par mot-clé. Chaque
        produit affiche son certificat de traçabilité (QR code) : vous pouvez y voir la province d&apos;origine et
        le fermier ou la coopérative qui l&apos;a publié.
      </p>
    ),
  },
  {
    id: "panier",
    icon: ShoppingCart,
    title: "Le panier",
    summary: "Fonctionne même hors connexion",
    content: (
      <p>
        Ajoutez des produits à votre <strong>Panier</strong> et ajustez les quantités librement — le panier est
        conservé sur votre appareil, il reste donc utilisable même sans connexion internet.
      </p>
    ),
  },
  {
    id: "paiement",
    icon: CreditCard,
    title: "Passer commande et payer",
    summary: "Lumicash, EcoCash, Airtel Money",
    content: (
      <>
        <p>
          Depuis le panier, renseignez votre adresse de livraison et choisissez votre mode de paiement mobile
          money. Le total affiché correspond exactement au montant demandé lors du paiement : prix des produits
          plus les frais de livraison réels (calculés selon la distance) — aucun frais caché.
        </p>
        <p>
          Votre paiement est conservé en séquestre par AgriConnect et n&apos;est reversé au fermier qu&apos;une
          fois la livraison confirmée, pour votre sécurité.
        </p>
      </>
    ),
  },
  {
    id: "livraison",
    icon: Truck,
    title: "Suivre votre commande et la livraison",
    summary: "Le code à donner au livreur",
    content: (
      <p>
        Suivez l&apos;avancement depuis <strong>Commandes</strong>. À la réception, communiquez au livreur le
        <strong> code de validation</strong> affiché sur votre commande : cela confirme la livraison et déclenche
        le paiement du fermier. En cas de problème, ouvrez un litige depuis la même page.
      </p>
    ),
  },
  {
    id: "meteo",
    icon: CloudSun,
    title: "Météo & conseils",
    summary: "Prévisions locales",
    content: (
      <p>
        La page <strong>Météo &amp; Conseils</strong> affiche les prévisions locales, utile pour anticiper vos
        achats de produits frais.
      </p>
    ),
  },
  {
    id: "temoignages",
    icon: Star,
    title: "Donner votre avis",
    summary: "Témoignages",
    content: (
      <p>
        Depuis <strong>Mes témoignages</strong>, partagez votre expérience sur AgriConnect — utile pour les autres
        acheteurs et pour l&apos;équipe AgriConnect.
      </p>
    ),
  },
  {
    id: "messagerie",
    icon: MessageCircle,
    title: "Messagerie",
    summary: "Échanger avec les fermiers",
    content: (
      <p>
        Utilisez la <strong>Messagerie</strong> pour poser une question à un fermier avant ou après votre achat.
      </p>
    ),
  },
  {
    id: "hors-ligne",
    icon: WifiOff,
    title: "Utiliser l'app sans connexion",
    summary: "Ce qui fonctionne, ce qui attend le réseau",
    content: (
      <p>
        Le catalogue déjà consulté et votre panier restent utilisables hors ligne. En revanche, <strong>valider un
        paiement</strong> nécessite une connexion active — le bouton reste désactivé avec un message explicatif
        tant que vous n&apos;êtes pas reconnecté, pour éviter tout paiement mal transmis.
      </p>
    ),
  },
  {
    id: "aide",
    icon: LifeBuoy,
    title: "Besoin d'aide ?",
    summary: "WhatsApp, téléphone, ticket",
    content: (
      <p>
        La page <strong>Aide &amp; Support</strong> permet de contacter l&apos;équipe AgriConnect par WhatsApp, par
        téléphone, ou en envoyant un ticket décrivant votre problème — vous pouvez y suivre le statut de vos
        demandes précédentes.
      </p>
    ),
  },
];

export default function BuyerGuidePage() {
  return (
    <BuyerLayout title="Guide d'utilisation" subtitle="Tout ce qu'il faut savoir pour acheter sur AgriConnect">
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <GuideSections sections={sections} />
      </div>
    </BuyerLayout>
  );
}
