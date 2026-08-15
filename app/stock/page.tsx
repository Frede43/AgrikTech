"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  QrCode,
  Printer,
  Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBIF } from "@/lib/currency";
import { apiFetch } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";

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
  trace_token: string | null;
}

interface ProductFormState {
  name: string;
  category: string;
  price_per_kg: string;
  unit: string;
  quantity_kg: string;
  min_stock: string;
  province: string;
  stock_reason_code: string;
  stock_reason_note: string;
}

interface StockMovement {
  id: number;
  product_id: number | null;
  farmer_id: number;
  movement_type: string;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  unit: string;
  product_name_snapshot: string;
  reason: string | null;
  created_at: string;
}

const UNIT_OPTIONS = ["kg", "tonne", "sac (50kg)", "caisse", "botte"];

export default function StockPage() {
  const { session, ready } = useRequiredSession("fermier");
  const { lang, text } = useLanguage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [movementProductFilter, setMovementProductFilter] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const CATEGORY_OPTIONS = [
    { label: text.stockLegumes, value: "legumes" },
    { label: text.stockFruits, value: "fruits" },
    { label: text.stockTubercules, value: "tubercules" },
    { label: text.stockCereales, value: "cereales" },
    { label: text.stockLegumineuses, value: "legumineuses" },
  ];

  const categoryLabels = useMemo(() => CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {}), [CATEGORY_OPTIONS]);

  const statusConfig = {
    active: {
      label: text.stockStatusActive,
      color: "bg-primary/10 text-primary border-primary/20",
      icon: CheckCircle,
    },
    "low-stock": {
      label: text.stockStatusLow,
      color: "bg-amber-100 text-amber-700 border-amber-200",
      icon: AlertTriangle,
    },
    "out-of-stock": {
      label: text.stockStatusOut,
      color: "bg-red-100 text-red-700 border-red-200",
      icon: XCircle,
    },
  } as const;

  const stockReasonOptions = useMemo(() => ([
    {
      value: "inventory_adjustment",
      label: lang === "fr" ? "Inventaire / correction" : "Iharura rya stock / correction",
    },
    {
      value: "stock_return",
      label: lang === "fr" ? "Retour de stock" : "Ugusubira muri stock",
    },
    {
      value: "order_cancellation",
      label: lang === "fr" ? "Annulation de commande" : "Uguhanagura commande",
    },
    {
      value: "loss",
      label: lang === "fr" ? "Perte" : "Igihombo",
    },
    {
      value: "damage",
      label: lang === "fr" ? "Avarie" : "Ibononekara",
    },
  ]), [lang]);

  const editQuantityDelta = useMemo(() => {
    if (!editProduct || !editForm) return 0;
    const nextQuantity = Number(editForm.quantity_kg);
    if (!Number.isFinite(nextQuantity)) return 0;
    return nextQuantity - editProduct.quantity_kg;
  }, [editForm, editProduct]);

  const editQuantityChanged = Math.abs(editQuantityDelta) >= 0.0001;

  const getMovementTypeLabel = (movementType: string) => {
    switch (movementType) {
      case "initial_stock":
        return lang === "fr" ? "Stock initial" : "Stoke ya mbere";
      case "manual_adjustment":
        return lang === "fr" ? "Ajustement manuel" : "Ihindurwa ryakozwe";
      case "inventory_adjustment":
        return lang === "fr" ? "Inventaire" : "Iharura rya stock";
      case "stock_return":
        return lang === "fr" ? "Retour" : "Ugusubira";
      case "order_cancel_return":
        return lang === "fr" ? "Retour après annulation" : "Ugusubira inyuma";
      case "loss":
        return lang === "fr" ? "Perte" : "Igihombo";
      case "damage":
        return lang === "fr" ? "Avarie" : "Ibononekara";
      case "order_out":
        return lang === "fr" ? "Sortie sur commande" : "Igisohoka ku commande";
      default:
        return movementType;
    }
  };

  const formatMovementDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const loadProducts = useCallback(async () => {
    if (!session) return;

    const movementProductQuery = movementProductFilter !== "all"
      ? `&product_id=${encodeURIComponent(movementProductFilter)}`
      : "";

    setLoading(true);
    try {
      const [productsResult, movementsResult] = await Promise.allSettled([
        apiFetch(`/products/?farmer_id=${session.userId}`, { cache: "no-store" }),
        apiFetch(`/stock-movements?farmer_id=${session.userId}${movementProductQuery}&limit=8`, { cache: "no-store" }),
      ]);

      if (productsResult.status === "fulfilled") {
        const nextProducts = Array.isArray(productsResult.value) ? productsResult.value : [];
        setProducts(nextProducts);
        if (
          movementProductFilter !== "all"
          && !nextProducts.some((product) => String(product.id) === movementProductFilter)
        ) {
          setMovementProductFilter("all");
        }
        setError(null);
      } else {
        logIfNotNetworkError("Stock fetch error", productsResult.reason);
        setProducts([]);
        setError(getDisplayErrorMessage(
          productsResult.reason,
          lang === "fr" ? "Impossible de charger votre stock." : "Ntivyashobotse gufungura ibirimwa vyawe.",
        ));
      }

      if (movementsResult.status === "fulfilled") {
        setMovements(Array.isArray(movementsResult.value) ? movementsResult.value : []);
      } else {
        logIfNotNetworkError("Stock movements fetch error", movementsResult.reason, "warn");
        setMovements([]);
      }
    } finally {
      setLoading(false);
    }
  }, [session, lang, movementProductFilter]);

  useEffect(() => {
    if (!ready || !session) return;
    void loadProducts();
  }, [ready, session, loadProducts]);

  const getProductStatus = (product: Product) => {
    if (product.quantity_kg <= 0) return "out-of-stock" as const;
    if (product.quantity_kg < product.min_stock) return "low-stock" as const;
    return "active" as const;
  };

  const filtered = useMemo(() => (
    products.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
      const status = getProductStatus(product);
      return matchSearch && (filter === "all" || status === filter);
    })
  ), [filter, products, search]);

  const openEditDialog = (product: Product) => {
    setMessage(null);
    setError(null);
    setEditProduct(product);
    setEditForm({
      name: product.name,
      category: product.category,
      price_per_kg: String(product.price_per_kg),
      unit: product.unit,
      quantity_kg: String(product.quantity_kg),
      min_stock: String(product.min_stock),
      province: product.province || "Burundi",
      stock_reason_code: "inventory_adjustment",
      stock_reason_note: "",
    });
  };

  const handleEditChange = (field: keyof ProductFormState, value: string) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSaveEdit = async () => {
    if (!session || !editProduct || !editForm) return;

    const price = Number(editForm.price_per_kg);
    const quantity = Number(editForm.quantity_kg);
    const minStock = Number(editForm.min_stock);
    const quantityChanged = Math.abs(quantity - editProduct.quantity_kg) >= 0.0001;
    if (!editForm.name.trim()) {
      setError(lang === "fr" ? "Le nom du produit est requis." : "Izina ry'igicuruzwa kirakenewe.");
      return;
    }
    if (![price, quantity, minStock].every((value) => Number.isFinite(value) && value >= 0)) {
      setError(lang === "fr" ? "Valeurs valides et positives requises." : "Ibice bikenerwa kuba ari ibiharuro bitari musi ya zero.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/products/${editProduct.id}?farmer_id=${session.userId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name.trim(),
          category: editForm.category,
          price_per_kg: price,
          unit: editForm.unit,
          quantity_kg: quantity,
          min_stock: minStock,
          province: editForm.province.trim() || "Burundi",
          ...(quantityChanged ? {
            stock_reason_code: editForm.stock_reason_code,
            ...(editForm.stock_reason_note.trim()
              ? { stock_reason_note: editForm.stock_reason_note.trim() }
              : {}),
          } : {}),
        }),
      });
      setEditProduct(null);
      setEditForm(null);
      await loadProducts();
      setMessage(text.stockUpdateSuccess);
    } catch (err: unknown) {
      logIfNotNetworkError("Stock update error", err);
      setError(getDisplayErrorMessage(err, text.settingsErrorMsg));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!session || !deleteProduct) return;

    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/products/${deleteProduct.id}?farmer_id=${session.userId}`, {
        method: "DELETE",
      });
      setDeleteProduct(null);
      await loadProducts();
      setMessage(text.stockDeleteSuccess);
    } catch (err: unknown) {
      logIfNotNetworkError("Stock delete error", err);
      setError(getDisplayErrorMessage(err, text.settingsErrorMsg));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout title={text.stockTitle} subtitle={text.stockSubtitle}>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: text.stockStatusActive, count: products.filter((p) => getProductStatus(p) === "active").length, color: "text-primary" },
          { label: text.stockStatusLow, count: products.filter((p) => getProductStatus(p) === "low-stock").length, color: "text-amber-700" },
          { label: text.stockStatusOut, count: products.filter((p) => getProductStatus(p) === "out-of-stock").length, color: "text-red-700" },
        ].map((summary) => (
          <div key={summary.label} className="bg-card rounded-2xl border border-border p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${summary.color}`}>{loading ? "..." : summary.count}</p>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5 tracking-wider">{summary.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={text.stockSearchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 rounded-xl border-input bg-card h-11"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {["all", "active", "low-stock", "out-of-stock"].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border h-11 flex items-center ${filter === value
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
            >
              {value === "all" ? (lang === "fr" ? "Tous" : "Vyose") : statusConfig[value as keyof typeof statusConfig]?.label || value}
            </button>
          ))}
        </div>
        <Button asChild className="bg-primary text-white hover:bg-primary/90 rounded-xl font-bold h-11 px-6 shadow-sm shrink-0">
          <Link href="/produits/ajouter">
            <Plus className="w-4 h-4 mr-2" />
            {text.stockAddBtn}
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive font-medium">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary font-medium">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">{text.stockLoading}</p>
          </div>
        ) : filtered.map((product) => {
          const statusSlug = getProductStatus(product);
          const status = statusConfig[statusSlug];
          const denominator = Math.max(product.min_stock * 3, 1);
          const stockPercent = Math.min(100, Math.max(0, (product.quantity_kg / denominator) * 100));
          const StatusIcon = status.icon;

          return (
            <div key={product.id} className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                    {categoryLabels[product.category] || product.category}
                  </p>
                </div>
                <Badge className={`shrink-0 border text-[10px] font-bold uppercase px-2 py-0.5 shadow-none ${status.color}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">{text.stockAvailable}</span>
                  <span className="font-bold text-foreground">{product.quantity_kg} {product.unit}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${statusSlug === "out-of-stock"
                      ? "bg-red-500"
                      : statusSlug === "low-stock"
                        ? "bg-amber-500"
                        : "bg-primary"
                      }`}
                    style={{ width: `${stockPercent}%` }}
                  />
                </div>
                <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-tight">
                  {text.stockMinRequired} {product.min_stock} {product.unit}
                </p>
              </div>

              <div className="flex items-center justify-between py-3 border-y border-border/50">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">{lang === "fr" ? "Prix" : "Igiciro"}</p>
                  <p className="text-sm font-bold text-foreground">{formatBIF(product.price_per_kg)}/{product.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">{text.stockSold}</p>
                  <p className="text-sm font-bold text-primary">{product.sold_quantity} {product.unit}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl text-xs font-bold h-9 border-border bg-secondary/30 hover:bg-secondary"
                  onClick={() => openEditDialog(product)}
                >
                  <Pencil className="w-3 h-3 mr-2" />
                  {lang === "fr" ? "Modifier" : "Hinyanyura"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 rounded-xl p-0 border-border text-primary hover:bg-primary/10"
                  onClick={() => setQrProduct(product)}
                >
                  <QrCode className="w-4 h-4" />
                  <span className="sr-only">QR Code</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 rounded-xl p-0 border-border text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteProduct(product)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="sr-only">Supprimer</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-card rounded-2xl border border-dashed border-border">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">
              {lang === "fr" ? "Aucun produit trouvé" : "Nta gicuruzwa twatoye"}
            </p>
            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
              {lang === "fr"
                ? "Modifiez votre recherche ou ajoutez un nouveau produit."
                : "Hindura ivyo urondera canke wongereko igicuruzwa gishasha."}
            </p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">
              {lang === "fr" ? "Mouvements récents du stock" : "Ivyo guhinduka vya vuba muri stock"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "fr"
                ? "Historique automatique des entrées, ajustements et sorties liées aux commandes."
                : "Amateka y'ivyinjira, amahinduka n'ibisohoka bifitaniye isano n'amacommande."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[220px] max-w-full">
              <Select value={movementProductFilter} onValueChange={setMovementProductFilter}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder={lang === "fr" ? "Filtrer par produit" : "Shungura ku gicuruzwa"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {lang === "fr" ? "Tous les produits" : "Ibicuruzwa vyose"}
                  </SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge className="rounded-full border border-border bg-secondary/40 text-foreground shadow-none">
              {movements.length}
            </Badge>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {lang === "fr" ? "Chargement de l'historique..." : "Turiko turazana amateka..."}
          </div>
        ) : movements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {lang === "fr"
              ? (movementProductFilter === "all"
                ? "Aucun mouvement n'a encore été enregistré pour votre stock."
                : "Aucun mouvement n'a encore été enregistré pour ce produit.")
              : (movementProductFilter === "all"
                ? "Nta gihindutse kirabikwa muri stock yawe."
                : "Nta gihindutse kirabikwa kuri iki gicuruzwa.")}
          </div>
        ) : (
          <div className="divide-y divide-border/50 rounded-xl border border-border/60 overflow-hidden">
            {movements.map((movement) => {
              const isPositive = movement.quantity_delta > 0;
              const deltaPrefix = isPositive ? "+" : "";

              return (
                <div key={movement.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">
                        {movement.product_name_snapshot}
                      </p>
                      <span className="text-[10px] uppercase font-bold tracking-wider rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">
                        {getMovementTypeLabel(movement.movement_type)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {movement.quantity_before} {movement.unit} → {movement.quantity_after} {movement.unit}
                      {movement.reason ? ` • ${movement.reason}` : ""}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className={`text-sm font-bold ${isPositive ? "text-primary" : "text-destructive"}`}>
                      {deltaPrefix}{movement.quantity_delta} {movement.unit}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatMovementDate(movement.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs and Alerts continue as before but with text object... */}
      <Dialog
        open={Boolean(editProduct && editForm)}
        onOpenChange={(open) => {
          if (saving || open) return;
          setEditProduct(null);
          setEditForm(null);
        }}
      >
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{text.stockEditTitle}</DialogTitle>
            <DialogDescription className="text-sm">
              {text.stockEditDesc}
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="max-h-[65vh] overflow-y-auto pr-2 py-2 -mr-2">
              <div className="grid gap-3 p-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Nom du produit" : "Izina ry'igicuruzwa"}</label>
                  <Input value={editForm.name} onChange={(event) => handleEditChange("name", event.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Catégorie" : "Ubushobozi"}</label>
                    <Select value={editForm.category} onValueChange={(value) => handleEditChange("category", value)}>
                      <SelectTrigger className="rounded-xl h-10 px-3 text-xs">
                        <SelectValue placeholder="Choisir une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Province</label>
                    <Input value={editForm.province} onChange={(event) => handleEditChange("province", event.target.value)} className="rounded-xl h-10 px-3" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Prix par unité (BIF)" : "Igiciro (BIF)"}</label>
                    <Input type="number" min={0} step="any" value={editForm.price_per_kg} onChange={(event) => handleEditChange("price_per_kg", event.target.value)} className="rounded-xl h-10 px-3 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Unité" : "Ingero"}</label>
                    <Select value={editForm.unit} onValueChange={(value) => handleEditChange("unit", value)}>
                      <SelectTrigger className="rounded-xl h-10 px-3 text-xs">
                        <SelectValue placeholder="Choisir une unité" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{text.stockAvailable}</label>
                    <Input type="number" min={0} step="any" value={editForm.quantity_kg} onChange={(event) => handleEditChange("quantity_kg", event.target.value)} className="rounded-xl h-10 px-3" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Seuil minimum" : "Ibikwiye kuba biraho"}</label>
                    <Input type="number" min={0} step="any" value={editForm.min_stock} onChange={(event) => handleEditChange("min_stock", event.target.value)} className="rounded-xl h-10 px-3" />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/15 p-3 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">
                      {lang === "fr" ? "Traçabilité du mouvement de stock" : "Kwamamaza ihinduka rya stock"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {editQuantityChanged
                        ? (editQuantityDelta > 0
                          ? (lang === "fr"
                            ? "Vous augmentez le stock : choisissez plutôt un retour, une annulation ou une correction d'inventaire."
                            : "Mwongeyeko stock: hitamwo retour, annulation canke correction d'inventaire.")
                          : (lang === "fr"
                            ? "Vous diminuez le stock : choisissez plutôt une perte, une avarie ou une correction d'inventaire."
                            : "Muragabanyije stock: hitamwo perte, avarie canke correction d'inventaire."))
                        : (lang === "fr"
                          ? "Un mouvement ne sera journalisé que si la quantité disponible est modifiée."
                          : "Ihinduka rizobikwa gusa nimwahindura igitigiri kiriho.")}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {lang === "fr" ? "Raison métier" : "Imvo y'ubudandaji"}
                      </label>
                      <Select value={editForm.stock_reason_code} onValueChange={(value) => handleEditChange("stock_reason_code", value)}>
                        <SelectTrigger className="rounded-xl h-10 px-3 text-xs">
                          <SelectValue placeholder={lang === "fr" ? "Choisir une raison" : "Hitamwo imvo"} />
                        </SelectTrigger>
                        <SelectContent>
                          {stockReasonOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {lang === "fr" ? "Note (optionnelle)" : "Akajambo k'inyongera (si ngombwa)"}
                      </label>
                      <Textarea
                        value={editForm.stock_reason_note}
                        onChange={(event) => handleEditChange("stock_reason_note", event.target.value)}
                        placeholder={lang === "fr" ? "Ex. retour du marché, sacs abîmés, inventaire hebdomadaire..." : "Nk'akarorero retour du marché, sacs abîmés, inventaire hebdomadaire..."}
                        className="rounded-xl min-h-16 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl h-11 font-bold px-6 border-border" onClick={() => { setEditProduct(null); setEditForm(null); }} disabled={saving}>
              {lang === "fr" ? "Annuler" : "Kureka"}
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm?.name.trim()} className="bg-primary text-white rounded-xl h-11 font-bold px-8 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              {lang === "fr" ? "Enregistrer" : "Bika"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteProduct)}
        onOpenChange={(open) => {
          if (deleting || open) return;
          setDeleteProduct(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-xl">{text.stockDeleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {deleteProduct
                ? (lang === "fr"
                  ? `Le produit « ${deleteProduct.name} » sera retiré de votre stock et ne sera plus visible aux acheteurs.`
                  : `Igicuruzwa « ${deleteProduct.name} » kigiye gukurwa mu birimwa vyawe maze ntikize kigumye kubonwa n'abaguzi.`)
                : text.stockDeleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting} className="rounded-xl h-11 border-border font-bold">
              {lang === "fr" ? "Annuler" : "Kureka"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-xl h-11 font-bold px-6 shadow-sm"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {lang === "fr" ? "Supprimer" : "Kuraho"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(qrProduct)} onOpenChange={() => setQrProduct(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-sm overflow-hidden p-0 border-0 shadow-2xl">
          <div className="bg-primary p-6 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute -top-10 -left-10 w-32 h-32 border-8 border-white rounded-full" />
            </div>
            <DialogHeader className="p-0 space-y-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Certificat de Traçabilité</p>
                <DialogTitle className="text-xl font-black text-white">{qrProduct?.name}</DialogTitle>
                <DialogDescription className="sr-only">
                    Ce QR Code contient les informations de traçabilité pour {qrProduct?.name}.
                </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 flex flex-col items-center gap-6">
            <div className="p-4 rounded-3xl bg-white shadow-inner border-2 border-primary/10">
              {qrProduct && (
                <QRCodeSVG 
                  value={`${window.location.origin}/trace/${qrProduct.trace_token}`}
                  size={180}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: "/favicon.ico",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              )}
            </div>

            <div className="text-center space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Code Unique</p>
              <p className="text-lg font-black text-foreground">{qrProduct?.trace_token || "AGRI-GEN-..."}</p>
            </div>

            <div className="w-full pt-4 space-y-3">
              <Button 
                onClick={() => window.print()}
                className="w-full h-14 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20"
              >
                <Printer className="w-4 h-4" /> Imprimer l'Étiquette
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setQrProduct(null)}
                className="w-full h-12 rounded-2xl font-bold text-muted-foreground"
              >
                Fermer
              </Button>
            </div>
          </div>
          
          <div className="bg-secondary/30 p-4 text-center">
            <p className="text-[9px] font-bold text-muted-foreground leading-relaxed">
              Ce QR Code permet au livreur et à l'acheteur de vérifier l'origine exacte du produit sur la plateforme AgriConnect.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
