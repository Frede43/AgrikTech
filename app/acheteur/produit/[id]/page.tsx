"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, Clock, Shield, MapPin, Minus, Plus, ShoppingCart, CheckCircle, Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BuyerLayout } from "@/components/buyer/buyer-layout";
import { formatBIF } from "@/lib/currency";
import { useCart } from "@/components/cart-context";
import { useLanguage } from "@/lib/LanguageContext";
import { apiFetch, API_BASE_URL } from "@/lib/api-config";
import { logIfNotNetworkError } from "@/lib/offline";

interface Product {
  id: number;
  name: string;
  category: string;
  price_per_kg: number;
  unit: string;
  quantity_kg: number;
  min_stock: number;
  sold_quantity: number;
  province: string;
  harvested_at: string;
  rating: number;
  image_url: string | null;
  farmer_id: number;
  farmer_name?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const { lang, text } = useLanguage();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (id) {
      apiFetch(`/products/${id}`)
        .then(data => {
          setProduct(data);
          setQty(1); // Default to 1
        })
        .catch(err => logIfNotNetworkError("Product detail fetch error", err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const { addItem } = useCart();

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price_per_kg,
      quantity: qty,
      unit: product.unit,
      image_url: product.image_url,
      category: product.category
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background max-w-md mx-auto p-8 text-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text.dashLoading}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background max-w-md mx-auto px-6 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
          <Leaf className="w-10 h-10 text-muted-foreground/30" />
        </div>
        <p className="text-lg font-bold text-foreground">{text.prodDetailNotFound}</p>
        <Button className="bg-primary text-white hover:bg-primary/90 rounded-xl px-8" onClick={() => router.back()}>{text.prodDetailBack}</Button>
      </div>
    );
  }

  const total = product.price_per_kg * qty;

  const categoryEmoji: Record<string, string> = {
    legumes: "🥦",
    tubercules: "🥔",
    cereales: "🌽",
    fruits: "🍌",
    export: "☕",
  };

  return (
    <BuyerLayout title={product.name} subtitle={`${product.farmer_name || text.prodDetailFarmer} — ${product.province}`}>
      <div className="max-w-md mx-auto px-4 py-6 space-y-6 pb-28">
        {/* Product image */}
        <div className="relative h-64 bg-secondary flex items-center justify-center text-7xl rounded-3xl overflow-hidden mx-0 border border-border shadow-sm group">
          {product.image_url ? (
            <img
              src={`${API_BASE_URL}${product.image_url}`}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <span className="opacity-80 group-hover:scale-110 transition-transform duration-500">{categoryEmoji[product.category] ?? "🌱"}</span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/30 hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <Badge className="absolute top-4 right-4 bg-green-500 text-white font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 border-0 shadow-lg shadow-green-500/20">
            {text.prodDetailCertified}
          </Badge>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-black text-foreground text-balance leading-tight tracking-tight">{product.name}</h1>
              <span className="text-xl font-black text-primary shrink-0 tracking-tighter">{formatBIF(product.price_per_kg)}<span className="text-sm font-bold text-muted-foreground">/{product.unit}</span></span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <div className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-lg">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-foreground">{product.rating} <span className="text-[9px] opacity-60 normal-case">{text.prodDetailSimulated}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary/60" />
                <span>{text.prodDetailHarvestedOn} {new Date(product.harvested_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI", { day: 'numeric', month: 'long' })}</span>
              </div>
            </div>
          </div>

          {/* Farmer */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm group hover:border-primary/20 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0 group-hover:scale-105 transition-transform">
              {(product.farmer_name || "F").split(" ").map((n: string) => n[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground truncate">{product.farmer_name || text.prodDetailFarmer}</p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                <MapPin className="w-3 h-3 text-primary/60" />
                <span>{product.province}</span>
              </div>
            </div>
            <Badge className="shrink-0 bg-primary/10 text-primary border-0 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
              {text.prodDetailVerified}
            </Badge>
          </div>

          {/* Description */}
          <div className="space-y-2.5">
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{text.prodDetailDescription}</h2>
            <p className="text-sm font-medium text-foreground leading-relaxed bg-secondary/30 p-4 rounded-2xl border border-border/50">
              {text.prodDetailDescBody.replace("{province}", product.province)}
            </p>
          </div>

          {/* Traceability */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Shield className="w-4 h-4" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">{text.prodDetailTraceability}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: text.prodDetailHarvestedOn, value: new Date(product.harvested_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI") },
                { label: "Province", value: product.province },
                { label: text.prodDetailQuality, value: text.prodDetailPremium },
                { label: text.prodDetailCertification, value: "AgriConnect Burundi" },
              ].map(({ label, value }, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-sm font-bold text-foreground leading-tight truncate">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quantity selector */}
          <div className="space-y-3 pt-2">
            <div className="flex items-end justify-between">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{text.prodDetailQuantity}</p>
              <Badge className="bg-secondary text-muted-foreground hover:bg-secondary font-bold text-[9px] uppercase tracking-widest border-0">
                {text.prodDetailStock}: {product.quantity_kg} {product.unit}
              </Badge>
            </div>
            <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2 shadow-sm">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-12 h-12 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors active:scale-95"
              >
                <Minus className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-foreground">{qty}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{product.unit}</span>
              </div>
              <button
                onClick={() => setQty(Math.min(product.quantity_kg, qty + 1))}
                className="w-12 h-12 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors active:scale-95"
              >
                <Plus className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky add to cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-4 z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="min-w-[80px]">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{text.prodDetailTotal}</p>
            <p className="text-xl font-black text-primary tracking-tighter">{formatBIF(total)}</p>
          </div>
          <Button
            onClick={handleAddToCart}
            className="flex-1 h-14 rounded-2xl font-black text-sm bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2 transition-transform active:scale-[0.98]"
          >
            {added ? (
              <><CheckCircle className="w-5 h-5" /> {text.prodDetailAdded}</>
            ) : (
              <><ShoppingCart className="w-5 h-5" /> {text.prodDetailAddCart}</>
            )}
          </Button>
        </div>
      </div>
    </BuyerLayout>
  );
}
