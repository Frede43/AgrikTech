"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { GuideSections, type GuideSection } from "@/components/guide/guide-sections";
import {
  UserCheck,
  ShieldCheck,
  Package,
  Boxes,
  Truck,
  Percent,
  Wallet,
  Landmark,
  Users,
  CloudSun,
  MessageCircle,
  WifiOff,
  LifeBuoy,
} from "lucide-react";

const sections: GuideSection[] = [
  {
    id: "compte",
    icon: UserCheck,
    title: "Créer votre compte et vous connecter",
    summary: "Inscription, connexion par code SMS, profil",
    content: (
      <>
        <p>
          Depuis l&apos;accueil, choisissez <strong>Fermier</strong> puis renseignez votre numéro de téléphone.
          Un code à 4 chiffres vous est envoyé par SMS : saisissez-le pour vous connecter, aucun mot de passe
          n&apos;est nécessaire.
        </p>
        <p>
          Lors de votre première connexion, complétez votre profil : nom, province, adresse et, si possible, vos
          coordonnées GPS — cela améliore le calcul des frais de livraison et l&apos;affichage sur les tableaux de
          bord.
        </p>
      </>
    ),
  },
  {
    id: "kyc",
    icon: ShieldCheck,
    title: "Vérifier votre identité (KYC)",
    summary: "Nécessaire pour retirer vos gains ou demander un crédit",
    content: (
      <>
        <p>
          Pour retirer de l&apos;argent vers Lumicash ou demander un crédit agricole, votre identité doit être
          vérifiée. Depuis <strong>Paramètres</strong>, renseignez votre numéro de CNI ou passeport et joignez une
          photo ou un scan lisible de votre pièce.
        </p>
        <p>
          Votre dossier passe ensuite en statut <strong>« En attente de vérification »</strong>, puis
          <strong> « Vérifié »</strong> ou <strong>« Rejeté »</strong> (avec le motif) une fois traité par un
          administrateur AgriConnect.
        </p>
      </>
    ),
  },
  {
    id: "publier",
    icon: Package,
    title: "Publier une récolte",
    summary: "Ajouter un produit à vendre",
    content: (
      <>
        <p>
          Depuis <strong>Ajouter une récolte</strong>, renseignez le nom du produit, sa catégorie, le prix par kg,
          la quantité disponible et votre province. Un certificat de traçabilité (QR code) est généré
          automatiquement pour chaque produit, consultable par les acheteurs.
        </p>
        <p>
          La catégorie <strong>Café/Thé</strong> est temporairement indisponible à la vente, le temps qu&apos;une
          clarification réglementaire soit obtenue auprès de l&apos;ODECA et de l&apos;OTB.
        </p>
      </>
    ),
  },
  {
    id: "stock",
    icon: Boxes,
    title: "Gérer votre stock",
    summary: "Suivre et ajuster vos quantités",
    content: (
      <p>
        La page <strong>Gestion du stock</strong> liste tous vos produits actifs. Vous pouvez y ajuster une
        quantité (récolte supplémentaire, perte, correction) en indiquant un motif — chaque changement est gardé en
        historique.
      </p>
    ),
  },
  {
    id: "livraison",
    icon: Truck,
    title: "Recevoir et livrer une commande",
    summary: "Du QR de collecte au paiement",
    content: (
      <>
        <p>Une fois qu&apos;un acheteur passe commande, suivez ces étapes :</p>
        <ol>
          <li>Préparez la commande depuis <strong>Transactions</strong>.</li>
          <li>
            Au moment du ramassage, présentez le <strong>QR code</strong> de la commande au livreur AgriConnect
            venu récupérer votre récolte.
          </li>
          <li>
            Une fois livrée chez l&apos;acheteur, le livreur confirme la livraison avec le <strong>code de
            validation</strong> que l&apos;acheteur lui communique.
          </li>
          <li>
            Le paiement est alors transféré automatiquement dans votre <strong>Portefeuille</strong>, commission
            déduite.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "commission",
    icon: Percent,
    title: "Comprendre la commission",
    summary: "Taux promotionnel puis taux standard",
    content: (
      <>
        <p>
          AgriConnect applique un taux de commission réduit sur vos <strong>20 premières ventes livrées</strong>,
          pour vous laisser le temps de juger la valeur de la plateforme. Au-delà, le taux standard s&apos;applique
          (visible sur votre tableau de bord).
        </p>
        <p>
          La commission ne porte que sur le prix de vos produits — jamais sur les frais de livraison, qui sont
          entièrement reversés au livreur.
        </p>
      </>
    ),
  },
  {
    id: "portefeuille",
    icon: Wallet,
    title: "Le portefeuille et les retraits",
    summary: "Retirer vos gains vers Lumicash",
    content: (
      <>
        <p>
          Votre <strong>Portefeuille</strong> affiche votre solde disponible et les montants en attente (commandes
          non encore livrées). Le retrait minimum est de <strong>10 000 BIF</strong>, transféré vers votre numéro
          Lumicash.
        </p>
        <p>
          Les retraits nécessitent que votre <strong>identité soit vérifiée (KYC)</strong>. Les montants les plus
          élevés ou jugés sensibles sont validés manuellement par un administrateur sous 24h ; les autres sont
          traités automatiquement.
        </p>
      </>
    ),
  },
  {
    id: "credit",
    icon: Landmark,
    title: "Crédit Agricole",
    summary: "Demander une avance",
    content: (
      <p>
        Depuis <strong>Crédit Agricole</strong>, faites une demande en indiquant le montant souhaité et le motif
        (semences, matériel...). Suivez son statut — en attente, validée ou refusée — directement sur la même page.
      </p>
    ),
  },
  {
    id: "cooperative",
    icon: Users,
    title: "Rejoindre ou créer une coopérative",
    summary: "Vendre en groupe",
    content: (
      <>
        <p>
          Depuis <strong>Ma Coopérative</strong>, rejoignez un groupe déjà enregistré ou créez le vôtre (nom,
          province, commune, contact) si vous représentez une association reconnue.
        </p>
        <p>
          Le responsable de la coopérative peut y publier des produits collectifs et consulter le
          <strong> stock total</strong> et les <strong>ventes totales</strong> du groupe.
        </p>
      </>
    ),
  },
  {
    id: "meteo",
    icon: CloudSun,
    title: "Météo & conseils agricoles",
    summary: "Prévisions et recommandations",
    content: (
      <p>
        La page <strong>Météo &amp; Conseils</strong> affiche les prévisions locales et des recommandations liées
        aux saisons agricoles du Burundi (Saison A, B, C).
      </p>
    ),
  },
  {
    id: "messagerie",
    icon: MessageCircle,
    title: "Messagerie",
    summary: "Échanger avec vos acheteurs",
    content: (
      <p>
        Utilisez la <strong>Messagerie</strong> pour répondre aux questions d&apos;un acheteur sur une commande ou
        un produit.
      </p>
    ),
  },
  {
    id: "hors-ligne",
    icon: WifiOff,
    title: "Utiliser l'app sans connexion",
    summary: "Ce qui fonctionne, ce qui attend le réseau",
    content: (
      <>
        <p>
          Le catalogue déjà consulté et les pages déjà visitées restent accessibles hors ligne. Une <strong>récolte
          ajoutée hors ligne</strong> est automatiquement mise en file d&apos;attente et envoyée dès que la
          connexion revient.
        </p>
        <p>
          En revanche, les <strong>retraits</strong> et les actions touchant à votre identité ne peuvent pas être
          effectués hors ligne — le bouton concerné reste désactivé avec un message explicatif tant que vous
          n&apos;êtes pas reconnecté.
        </p>
      </>
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

export default function FarmerGuidePage() {
  return (
    <DashboardLayout
      title="Guide d'utilisation"
      subtitle="Tout ce qu'il faut savoir pour vendre sur AgriConnect"
    >
      <GuideSections sections={sections} />
    </DashboardLayout>
  );
}
