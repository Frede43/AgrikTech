"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, Leaf, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch, buildImageUrl } from "@/lib/api-config";
import { formatBIF } from "@/lib/currency";
import { logIfNotNetworkError } from "@/lib/offline";
import { useSession } from "@/lib/session";
import { Pencil } from "lucide-react";

interface Product {
  id: number;
  name: string;
  category: string;
  price_per_kg: number;
  unit: string;
  quantity_kg: number;
  province: string;
  harvested_at: string;
  image_url: string | null;
  farmer_id: number;
  farmer_name?: string;
}

export default function PublicProductDetailPage() {
  const { session } = useSession();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    apiFetch(`/products/${id}`)
      .then((data) => setProduct(data as Product))
      .catch((error) => logIfNotNetworkError("Failed to load public product detail", error))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Chargement du produit...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Leaf className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-semibold text-foreground">Produit introuvable</h1>
        <Button asChild variant="outline">
          <Link href="/produits">Retour au catalogue</Link>
        </Button>
      </main>
    );
  }

  const imageUrl = buildImageUrl(product.image_url);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="text-lg font-bold text-foreground">AgriConnect Burundi</Link>
          <Button asChild className="font-semibold">
            <Link href="/connexion?role=acheteur">Se connecter pour commander</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-10">
        <div className="space-y-4">
          <Link href="/produits" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Retour au catalogue
          </Link>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-border bg-secondary text-7xl">
            {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" /> : "🌾"}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <Badge className="bg-primary/10 text-primary">Catalogue public</Badge>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {product.province}</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Récolté le {new Date(product.harvested_at).toLocaleDateString("fr-FR")}</span>
            </div>
            {session?.userId === product.farmer_id && (
              <Button asChild variant="secondary" className="rounded-xl font-bold gap-2 mt-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 shadow-none">
                <Link href="/stock">
                  <Pencil className="w-4 h-4" />
                  Modifier ce produit (Stock)
                </Link>
              </Button>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Prix public</p>
                <p className="text-2xl font-bold text-primary">{formatBIF(product.price_per_kg)}/{product.unit}</p>
              </div>
              <Badge variant="outline">{product.quantity_kg} {product.unit} disponibles</Badge>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Traçabilité, origine et vendeur affichés avant connexion.</span>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">À propos de ce produit</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Produit agricole proposé sur AgriConnect, issu de la province de {product.province}.
              Consultez les informations essentielles en public puis connectez-vous si vous souhaitez commander.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Producteur : <span className="font-medium text-foreground">{product.farmer_name || "Fermier vérifié"}</span>
            </p>
          </div>

          <Separator />

          <div className="rounded-3xl border border-primary/15 bg-primary/5 p-5">
            <h2 className="text-xl font-semibold text-foreground">Prêt à commander ?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous comme acheteur pour ajouter ce produit au panier, payer et suivre la livraison.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="font-semibold">
                <Link href="/connexion?role=acheteur">Se connecter comme acheteur</Link>
              </Button>
              <Button asChild variant="outline" className="font-semibold">
                <Link href="/produits">Continuer l’exploration</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">Vous êtes producteur ?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous dans l’espace fermier pour publier vos récoltes et gérer vos ventes.
            </p>
            <Button asChild variant="outline" className="mt-4 font-semibold">
              <Link href="/connexion?role=fermier">Accéder à l’espace fermier</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}