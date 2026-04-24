"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, CheckCircle, ChevronRight, Loader2 } from "lucide-react";
import {
  getLivePriceActionText,
  getLivePriceConfidenceText,
  getLivePricePositioning,
  getLivePriceScopeText,
  useLivePrices,
} from "@/lib/live-market";
import { formatBIF } from "@/lib/currency";
import { apiFetch } from "@/lib/api-config";
import { isLikelyNetworkError, queueProductCreate, useOnlineStatus } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";

const units = ["kg", "tonne", "sac (50kg)", "caisse", "botte"];

export default function AddProductPage() {
  const { session, ready } = useRequiredSession("fermier");
  const { lang, text } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [submittedMode, setSubmittedMode] = useState<"online" | "queued">("online");
  const [imageDeferred, setImageDeferred] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("legumes");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("kg");
  const [quantity, setQuantity] = useState("");
  const [harvest, setHarvest] = useState(new Date().toISOString().split('T')[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [province, setProvince] = useState("Burundi");
  const { prices: livePrices, scope: livePriceScope } = useLivePrices({ province });
  const isOnline = useOnlineStatus();
  const [mounted, setMounted] = useState(false);

  const CATEGORY_OPTIONS = useMemo(() => [
    { label: text.stockLegumes, value: "legumes" },
    { label: text.stockFruits, value: "fruits" },
    { label: text.stockTubercules, value: "tubercules" },
    { label: text.stockCereales, value: "cereales" },
    { label: text.stockLegumineuses, value: "legumineuses" },
  ], [text]);

  useEffect(() => {
    if (!ready || !session) return;

    apiFetch(`/users/${session.userId}`)
      .then((user) => setProvince(user.province || "Burundi"))
      .catch((err) => console.error("User profile fetch error", err));
    
    setMounted(true);
  }, [ready, session]);

  const matchedSoko = livePrices.find((p) =>
    name.toLowerCase().includes(p.product.toLowerCase().split(" ")[0])
  );
  const numericPrice = Number(price);
  const sokoPositioning = useMemo(
    () => getLivePricePositioning(numericPrice, matchedSoko, lang),
    [numericPrice, matchedSoko, lang],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setError("");

    const productPayload = {
      name,
      category,
      price_per_kg: Number(price),
      unit,
      quantity_kg: Number(quantity),
      province,
    };

    const completeSubmission = (mode: "online" | "queued", deferredImage: boolean) => {
      setSubmittedMode(mode);
      setImageDeferred(deferredImage);
      setSubmitted(true);
      setName("");
      setPrice("");
      setQuantity("");
      setImageFile(null);
      setImagePreview(null);
    };

    const queueSubmission = () => {
      queueProductCreate({
        farmerId: session.userId,
        payload: productPayload,
        imageDeferred: Boolean(imageFile),
      });
      completeSubmission("queued", Boolean(imageFile));
    };

    try {
      if (!isOnline) {
        queueSubmission();
        return;
      }

      const newProduct = await apiFetch(`/products/?farmer_id=${session.userId}`, {
        method: 'POST',
        body: JSON.stringify(productPayload),
      });

      let deferredImage = false;
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append('file', imageFile);
          await apiFetch(`/products/${newProduct.id}/upload-image/`, {
            method: 'POST',
            body: formData
          });
        } catch (uploadError) {
          if (isLikelyNetworkError(uploadError)) {
            deferredImage = true;
          } else {
            throw uploadError;
          }
        }
      }

      completeSubmission("online", deferredImage);
    } catch (err: any) {
      if (isLikelyNetworkError(err)) {
        queueSubmission();
        return;
      }
      console.error(err);
      setError(err.message || (lang === "fr" ? "Erreur lors de la mise en vente." : "Ntivyashobotse gushira igicuruzwa kw'isoko."));
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <DashboardLayout
      title={text.addProdTitle}
      subtitle={text.addProdSubtitle}
    >
      <div className="max-w-xl mx-auto pb-10">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6 bg-card rounded-2xl border border-border shadow-sm">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-foreground">{submittedMode === "queued" ? text.addProdQueuedSuccess : text.addProdSuccess}</h2>
              <p className="text-sm text-muted-foreground px-10">
                {submittedMode === "queued" ? text.addProdQueuedDesc : text.addProdSuccessDesc}
              </p>
              {imageDeferred && <p className="text-xs font-medium text-muted-foreground px-10">{text.addProdImageDeferred}</p>}
            </div>
            <Button
              onClick={() => {
                setSubmitted(false);
                setImageDeferred(false);
              }}
              className="bg-primary text-white hover:bg-primary/90 rounded-xl px-8 font-bold h-11 shadow-sm mt-2"
            >
              {text.addProdAnother}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo upload */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">{text.addProdPhoto}</h2>
              {mounted && !isOnline && (
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
                  {text.addProdOfflineHint}
                </div>
              )}
              <input
                type="file"
                id="image-upload"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
              <button
                type="button"
                onClick={() => document.getElementById('image-upload')?.click()}
                className="w-full h-48 rounded-2xl border-2 border-dashed border-border bg-secondary/30 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all overflow-hidden relative shadow-inner"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">
                        {text.addProdPhotoTap}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">{text.addProdPhotoLimit}</p>
                    </div>
                  </>
                )}
              </button>
            </div>

            {/* Product info */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{text.addProdInfo}</h2>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{text.addProdName} *</Label>
                <Input
                  id="name"
                  placeholder={text.addProdNamePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-xl border-input bg-background h-11"
                />
                {matchedSoko && (
                  <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs text-primary space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{text.addProdSokoPrice}</p>
                        <p className="mt-1 text-muted-foreground">
                          {getLivePriceConfidenceText(matchedSoko.confidence_label, lang)} · {getLivePriceActionText(matchedSoko.recommended_action, lang)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {getLivePriceScopeText(matchedSoko.market_scope ?? livePriceScope.type, matchedSoko.market_scope_label ?? livePriceScope.label, lang)}
                        </p>
                      </div>
                      <span className="font-black whitespace-nowrap">{formatBIF(matchedSoko.price)}/{matchedSoko.unit}</span>
                    </div>
                    {sokoPositioning && (
                      <div className={`rounded-lg px-3 py-2 ${sokoPositioning.status === "above" ? "bg-amber-100/80 text-amber-800" : sokoPositioning.status === "below" ? "bg-emerald-100/80 text-emerald-800" : "bg-white/70 text-foreground"}`}>
                        <p className="font-bold">
                          {sokoPositioning.label} {sokoPositioning.deltaPercent > 0 ? `(+${sokoPositioning.deltaPercent}%)` : `(${sokoPositioning.deltaPercent}%)`}
                        </p>
                        <p className="mt-1 text-[11px]">{sokoPositioning.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{text.addProdCategory} *</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger id="category" className="rounded-xl border-input bg-background h-11">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="harvest" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{text.addProdHarvestDate} *</Label>
                  <Input
                    id="harvest"
                    type="date"
                    value={harvest}
                    onChange={(e) => setHarvest(e.target.value)}
                    required
                    className="rounded-xl border-input bg-background h-11 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{text.addProdPriceQty}</h2>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{text.addProdPrice} *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="2500"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    min={0}
                    className="rounded-xl border-input bg-background h-11 font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{text.addProdUnit} *</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger id="unit" className="rounded-xl border-input bg-background h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{text.addProdQuantity} *</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="150"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min={0}
                  className="rounded-xl border-input bg-background h-11"
                />
              </div>

              {price && quantity && (
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                  <p className="text-[10px] text-primary/70 font-bold uppercase tracking-widest">{text.addProdTotalValue}</p>
                  <p className="text-2xl font-black text-primary tracking-tight mt-1">
                    {formatBIF(Number(price) * Number(quantity))}
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !ready || !session}
              className="w-full bg-primary text-white hover:bg-primary/90 rounded-2xl font-black h-14 text-base shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] gap-3"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : text.addProdSellBtn}
              {!loading && <ChevronRight className="w-5 h-5 opacity-50" />}
            </Button>
            {error && <p className="text-sm text-destructive text-center font-bold px-4">{error}</p>}
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
