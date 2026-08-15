"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck, MapPin, Calendar, User, Leaf, ArrowLeft, Award, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch, buildImageUrl } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function TraceabilityPage() {
  const { token } = useParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (token) {
      apiFetch(`/products/trace/${token}`)
        .then(data => {
          setProduct(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError(true);
          setLoading(false);
        });
    }
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-muted-foreground font-medium animate-pulse">Vérification du passeport digital...</p>
    </div>
  );

  if (error || !product) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
        <ShieldCheck className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-black mb-2">Certificat Invalide</h1>
      <p className="text-muted-foreground mb-8">Ce code de traçabilité ne semble pas correspondre à un produit certifié AgriConnect.</p>
      <Button onClick={() => router.push("/")} className="rounded-2xl px-8">Retour à l'accueil</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAF8] pb-20">
      {/* Header avec sceau de garantie */}
      <div className="bg-primary pt-12 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10 w-32 h-32 border-8 border-white rounded-full" />
            <div className="absolute bottom-10 right-10 w-48 h-48 border-8 border-white rounded-full" />
        </div>
        
        <Badge className="bg-white/20 text-white border-0 backdrop-blur-md mb-4 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            Passeport Digital Certifié
        </Badge>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2">Traçabilité du Produit</h1>
        <p className="text-primary-foreground/80 text-sm">Garantie d'origine et de qualité AgriConnect Burundi</p>
      </div>

      <div className="max-w-md mx-auto -mt-16 px-6 space-y-6">
        {/* Carte Produit */}
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
            <div className="h-48 bg-secondary relative overflow-hidden">
                {product.image_url ? (
                    <img src={buildImageUrl(product.image_url) ?? ""} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🌱</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-6 left-6">
                    <h2 className="text-2xl font-black text-white">{product.name}</h2>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Lot: {token}</p>
                </div>
            </div>
            <CardContent className="p-8 space-y-8">
                {/* Producteur */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Producteur</p>
                        <p className="font-black text-lg text-foreground">{product.seller_name}</p>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground mt-1">
                            <MapPin className="w-3.5 h-3.5 text-primary" /> {product.province}
                        </div>
                    </div>
                </div>

                {/* Récolte */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Date de Récolte</p>
                        <p className="font-black text-lg text-foreground">
                            {new Date(product.harvested_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Produit Frais
                        </div>
                    </div>
                </div>

                {/* Certification */}
                <div className="pt-6 border-t border-dashed flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                        <Award className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="font-black text-lg">Produit Certifié</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed px-4">
                            Ce produit a été vérifié par les services de contrôle qualité de la plateforme AgriConnect en collaboration avec sa coopérative locale.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Action de retour */}
        <div className="pt-4">
            <Button 
                variant="outline" 
                onClick={() => router.push("/")}
                className="w-full h-14 rounded-2xl border-2 border-primary/20 text-primary font-black gap-2 hover:bg-primary/5"
            >
                <ArrowLeft className="w-4 h-4" /> Acheter ce produit sur le marché
            </Button>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] pt-4">
            AgriConnect Burundi — Technologie Blockchain de confiance
        </p>
      </div>
    </div>
  );
}
