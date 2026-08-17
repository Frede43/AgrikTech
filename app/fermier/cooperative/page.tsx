"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ShieldCheck, MapPin, Phone, Leaf, Package, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { formatBIF } from "@/lib/currency";

export default function FarmerCooperativePage() {
  const { session } = useRequiredSession("fermier");
  const { lang, text } = useLanguage();
  const [cooperative, setCooperative] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allCoops, setAllCoops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCoop, setNewCoop] = useState({ name: "", province: "", commune: "", contact_phone: "" });
  const [coopProducts, setCoopProducts] = useState<any[]>([]);
  const [coopStats, setCoopStats] = useState<{ total_stock_kg: number; total_sales: number } | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "legumes", price_per_kg: 0, quantity_kg: 0, province: "" });

  useEffect(() => {
    if (session) {
      // Charger le profil utilisateur pour voir s'il est dans une coop
      apiFetch(`/users/${session.userId}`).then(u => {
        if (u.cooperative_id) {
          apiFetch(`/cooperatives/${u.cooperative_id}/members`).then(setMembers);
          apiFetch(`/cooperatives/${u.cooperative_id}/products`).then(setCoopProducts);
          apiFetch(`/cooperatives/${u.cooperative_id}/stats`).then(setCoopStats).catch(() => setCoopStats(null));
          // On simule le chargement de la coop spécifique ou on peut fetcher
          apiFetch("/cooperatives").then(coops => {
             const myCoop = coops.find((c: any) => c.id === u.cooperative_id);
             if (myCoop) {
                setCooperative(myCoop);
                setNewProduct(prev => ({ ...prev, province: myCoop.province }));
             }
             else setCooperative({ id: u.cooperative_id, name: "Ma Coopérative", province: u.province });
          });
        } else {
          apiFetch("/cooperatives").then(setAllCoops);
        }
        setLoading(false);
      });
    }
  }, [session]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/cooperatives/${cooperative.id}/products`, {
        method: "POST",
        body: JSON.stringify(newProduct)
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async (id: number) => {
    try {
      await apiFetch(`/cooperatives/${id}/join`, { method: "POST" });
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Voulez-vous vraiment quitter cette coopérative ?")) return;
    try {
      await apiFetch(`/cooperatives/leave`, { method: "POST" });
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/cooperatives", {
        method: "POST",
        body: JSON.stringify(newCoop)
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <DashboardLayout title={text.coopTitle}><div className="py-20 text-center">{text.dashLoading}</div></DashboardLayout>;

  return (
    <DashboardLayout 
      title={text.coopTitle} 
      subtitle={text.coopSubtitle}
    >
      {cooperative ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Détails de la coop */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-xl shadow-primary/5 border-2">
            <CardContent className="pt-8 pb-8 flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 rounded-[2rem] bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 transform -rotate-3">
                <Leaf className="w-12 h-12 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <h2 className="text-4xl font-black tracking-tighter text-foreground">{cooperative.name}</h2>
                    {cooperative.is_verified && (
                        <Badge className="w-fit mx-auto md:mx-0 bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> {text.prodDetailCertified}
                        </Badge>
                    )}
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                  <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl border border-primary/10">
                    <MapPin className="w-4 h-4 text-primary" /> {cooperative.province}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl border border-primary/10">
                    <Users className="w-4 h-4 text-primary" /> {members.length} {text.coopMembers}
                  </span>
                </div>
              </div>
              <Button onClick={handleLeave} variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold gap-2 rounded-2xl h-12 px-6">
                {text.coopLeaveBtn}
              </Button>
            </CardContent>
          </Card>

          {/* Stock et ventes collectives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Package className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {lang === 'fr' ? 'Stock total' : 'Ibiri mu bubiko vyose'}
                  </p>
                  <p className="text-2xl font-black text-foreground tracking-tight">
                    {coopStats ? `${coopStats.total_stock_kg.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} kg` : '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {lang === 'fr' ? 'Ventes totales' : 'Amagurisha yose'}
                  </p>
                  <p className="text-2xl font-black text-foreground tracking-tight">
                    {coopStats ? formatBIF(coopStats.total_sales) : '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Liste des membres */}
            <Card className="lg:col-span-1 border-border/50 shadow-lg overflow-hidden rounded-[2rem]">
                <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-6">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" /> {text.coopMembers}
                </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                <div className="space-y-4">
                    {members.map(m => (
                    <div key={m.id} className="p-4 rounded-2xl border bg-accent/5 hover:bg-white hover:border-primary/20 transition-all duration-300 flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black group-hover:scale-110 transition-transform">
                        {m.name[0]}
                        </div>
                        <div>
                        <p className="font-bold text-sm">{m.name}</p>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                          {m.role === 'admin' ? (lang === 'fr' ? 'Gérant' : 'Uwayirongoye') : (lang === 'fr' ? 'Membre' : 'Umunywanyi')}
                        </p>
                        </div>
                    </div>
                    ))}
                </div>
                </CardContent>
            </Card>

            {/* Gestion des produits collectifs */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Leaf className="w-6 h-6 text-primary" /> {text.coopCollectiveSales}
                    </h3>
                    <Button 
                        onClick={() => setShowAddProduct(!showAddProduct)}
                        className="rounded-2xl font-bold px-6 shadow-lg shadow-primary/20"
                    >
                        {showAddProduct ? (lang === 'fr' ? "Fermer" : "Gufunga") : text.coopAddProductBtn}
                    </Button>
                </div>

                {showAddProduct && (
                    <Card className="border-primary/20 shadow-2xl rounded-[2rem] animate-in zoom-in-95">
                        <CardContent className="p-8">
                            <form onSubmit={handleAddProduct} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.addProdName}</label>
                                        <input 
                                            required
                                            type="text" 
                                            placeholder="ex: Haricots Jaunes"
                                            className="w-full h-14 px-5 rounded-2xl border border-input bg-background focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                            value={newProduct.name}
                                            onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.addProdCategory}</label>
                                        <select 
                                            className="w-full h-14 px-5 rounded-2xl border border-input bg-background font-medium"
                                            value={newProduct.category}
                                            onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                                        >
                                            <option value="legumes">{text.stockLegumes}</option>
                                            <option value="cereales">{text.stockCereales}</option>
                                            <option value="fruits">{text.stockFruits}</option>
                                            {/* "export" (Café/Thé) retiré temporairement : filière régulée par
                                                l'ODECA/OTB, en attente de clarification réglementaire — voir
                                                config.RESTRICTED_PRODUCT_CATEGORIES côté backend qui bloque
                                                aussi la création côté API, pas seulement ce menu. */}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.addProdPrice} / kg</label>
                                        <input 
                                            required
                                            type="number" 
                                            className="w-full h-14 px-5 rounded-2xl border border-input bg-background"
                                            value={newProduct.price_per_kg}
                                            onChange={e => setNewProduct({...newProduct, price_per_kg: Number(e.target.value)})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.addProdQuantity} (kg)</label>
                                        <input 
                                            required
                                            type="number" 
                                            className="w-full h-14 px-5 rounded-2xl border border-input bg-background"
                                            value={newProduct.quantity_kg}
                                            onChange={e => setNewProduct({...newProduct, quantity_kg: Number(e.target.value)})}
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-black shadow-xl shadow-primary/20">
                                    {text.coopProductFormBtn}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {coopProducts.length > 0 ? (
                        coopProducts.map(p => (
                            <Card key={p.id} className="border-border/50 hover:border-primary/30 transition-all rounded-3xl overflow-hidden group shadow-sm hover:shadow-md">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                        {p.category === "cereales" ? "🌽" : p.category === "legumes" ? "🥦" : "🍌"}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-foreground">{p.name}</h4>
                                        <p className="text-xs font-bold text-primary">{p.price_per_kg} BIF / kg</p>
                                        <div className="mt-2 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: '100%' }}></div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">{p.quantity_kg} kg {lang === 'fr' ? 'en stock' : 'ariho'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center rounded-[2rem] border-2 border-dashed bg-muted/20">
                            <Leaf className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground font-bold">{text.coopNoProduct}</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      ) : (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Header explicatif */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4" /> {lang === 'fr' ? 'Sécurité & Organisation' : 'Umutekano & Urubuga'}
                </div>
                <h2 className="text-4xl font-black tracking-tight text-foreground">{text.coopChoiceTitle}</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {text.coopChoiceDesc}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Option 1: Membre */}
                <Card className="relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-500 group rounded-[2.5rem] bg-card shadow-xl hover:shadow-primary/5">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-32 h-32" />
                    </div>
                    <CardContent className="p-10 space-y-6 relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                            <Users className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black tracking-tight">{text.coopJoinGroup}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {lang === 'fr' 
                                  ? "Vous êtes un fermier individuel et vous voulez bénéficier de la logistique et de la force de vente d'une coopérative existante." 
                                  : "Uri umurimyi wigenga kandi wipfuza gukoresha ubutunzi bw'ishirahamwe ririho."}
                            </p>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {lang === 'fr' ? 'Vente facilitée par le groupe' : 'Kugurisha byoroshejwe'}
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {lang === 'fr' ? 'Frais de transport partagés' : 'Ikiguzi co gutwara gisangiwe'}
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {lang === 'fr' ? 'Accès prioritaire aux crédits' : 'Kuronka ingane imbere y\'abandi'}
                            </li>
                        </ul>
                        <div className="pt-4">
                            <Button 
                                onClick={() => setShowCreateForm(false)} 
                                variant={!showCreateForm ? "default" : "outline"}
                                className="w-full h-14 rounded-2xl font-black text-base shadow-lg shadow-primary/10"
                            >
                                {text.coopAvailableTitle}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Option 2: Leader / Manager */}
                <Card className="relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-500 group rounded-[2.5rem] bg-card shadow-xl hover:shadow-primary/5">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ShieldCheck className="w-32 h-32" />
                    </div>
                    <CardContent className="p-10 space-y-6 relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black tracking-tight">{text.coopManageGroup}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {lang === 'fr'
                                  ? "Vous représentez une organisation légale (SANGWE, Association, etc.) et vous voulez centraliser la vente de vos membres."
                                  : "Uraserukira ishirahamwe mu mategeko (SANGWE, Association, n'ibindi) kandi wipfuza gushira hamwe ibicuruzwa vy'abanywanyi."}
                            </p>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {lang === 'fr' ? 'Gestion centralisée du stock' : 'Gucunga neza ibikuruzwa vyose hamwe'}
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {lang === 'fr' ? 'Rapports de vente par membre' : 'Amakuru y\'igurishe kuri buri munywanyi'}
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {lang === 'fr' ? 'Facturation OBR groupée' : 'Kuriha amakori ya OBR hamwe'}
                            </li>
                        </ul>
                        <div className="pt-4">
                            <Button 
                                onClick={() => setShowCreateForm(true)} 
                                variant={showCreateForm ? "default" : "outline"}
                                className="w-full h-14 rounded-2xl font-black text-base border-amber-200 text-amber-700 hover:bg-amber-50"
                            >
                                {text.coopCreateTitle}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Zone de contenu dynamique */}
            <div className="pt-10 border-t border-border/50">
                {showCreateForm ? (
                    <Card className="max-w-2xl mx-auto border-amber-200 shadow-2xl rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="bg-amber-500 px-8 py-4 flex items-center justify-between">
                            <span className="text-white font-black uppercase tracking-widest text-xs">{text.coopFormTitle}</span>
                            <ShieldCheck className="text-white/50 w-5 h-5" />
                        </div>
                        <CardContent className="p-10">
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.coopOfficialName}</label>
                                    <input 
                                        required
                                        type="text" 
                                        placeholder="ex: Coopérative SANGWE de Kayanza"
                                        className="w-full h-14 px-6 rounded-2xl border border-input bg-background focus:ring-4 focus:ring-amber-500/10 transition-all font-bold"
                                        value={newCoop.name}
                                        onChange={e => setNewCoop({...newCoop, name: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.coopProvince}</label>
                                        <input required type="text" placeholder="Kayanza" className="w-full h-14 px-6 rounded-2xl border border-input bg-background font-bold" value={newCoop.province} onChange={e => setNewCoop({...newCoop, province: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.coopCommune}</label>
                                        <input required type="text" placeholder="Gahombo" className="w-full h-14 px-6 rounded-2xl border border-input bg-background font-bold" value={newCoop.commune} onChange={e => setNewCoop({...newCoop, commune: e.target.value})} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{text.coopContact}</label>
                                    <input required type="tel" placeholder="+257 ..." className="w-full h-14 px-6 rounded-2xl border border-input bg-background font-bold" value={newCoop.contact_phone} onChange={e => setNewCoop({...newCoop, contact_phone: e.target.value})} />
                                </div>
                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <p className="text-[11px] text-amber-800 leading-relaxed font-bold">
                                        {text.coopLegalNote}
                                    </p>
                                </div>
                                <Button type="submit" className="w-full h-16 rounded-2xl text-lg font-black bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20">
                                    {text.coopFinalizeBtn}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black tracking-tight">{text.coopAvailableTitle}</h3>
                            <span className="text-xs font-bold text-muted-foreground bg-accent px-3 py-1 rounded-full">{allCoops.length} {lang === 'fr' ? 'groupes trouvés' : 'yabonetse'}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {allCoops.map(c => (
                            <Card key={c.id} className="hover:shadow-2xl transition-all duration-500 group border-border/50 rounded-3xl overflow-hidden bg-card">
                                <CardContent className="p-8 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 transform group-hover:rotate-6">
                                    <Leaf className="w-7 h-7" />
                                    </div>
                                    <div>
                                    <h3 className="font-black text-xl">{c.name}</h3>
                                    <p className="text-sm font-bold text-muted-foreground flex items-center gap-1.5 mt-1">
                                        <MapPin className="w-4 h-4 text-primary" /> {c.province}, {c.commune}
                                    </p>
                                    </div>
                                </div>
                                <Button onClick={() => handleJoin(c.id)} variant="outline" className="rounded-2xl border-primary/20 hover:bg-primary hover:text-white transition-all h-12 px-8 font-black text-sm">
                                    {text.coopJoinBtn}
                                </Button>
                                </CardContent>
                            </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
      )}
    </DashboardLayout>
  );
}
