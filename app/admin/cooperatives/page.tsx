"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, MapPin, Phone, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function AdminCooperativesPage() {
  const { lang, text } = useLanguage();
  const [cooperatives, setCooperatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  useEffect(() => {
    loadCooperatives();
  }, []);

  const loadCooperatives = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/cooperatives");
      setCooperatives(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number, currentlyVerified: boolean) => {
    setVerifyingId(id);
    try {
      const targetStatus = currentlyVerified ? "unverified" : "verified";
      await apiFetch(`/admin/cooperatives/${id}/verify?status=${targetStatus}`, { method: "POST" });
      await loadCooperatives();
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingId(null);
    }
  };

  const filtered = cooperatives.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.province.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout 
      title={lang === "fr" ? "Gestion des Coopératives" : "Gucunga Amashirahamwe"} 
      subtitle={lang === "fr" ? "Vérification des documents et badge de confiance" : "Gusuzuma amadosiye n'uburinzi"}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder={lang === "fr" ? "Rechercher une coopérative..." : "Rondera ishirahamwe..."}
              className="w-full h-12 pl-10 pr-4 rounded-2xl border bg-card text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={loadCooperatives} className="h-12 rounded-2xl px-6">
            {lang === "fr" ? "Actualiser" : "Kuvugurura"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{text.dashLoading}</p>
            </div>
          ) : filtered.length === 0 ? (
            <Card className="py-20 text-center border-dashed">
              <p className="text-muted-foreground">{lang === "fr" ? "Aucune coopérative trouvée." : "Nta shirahamwe ryabonetse."}</p>
            </Card>
          ) : (
            filtered.map((c) => (
              <Card key={c.id} className="overflow-hidden hover:shadow-lg transition-all border-border/50">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center">
                    <div className="p-6 flex-1 flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${c.is_verified ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {c.is_verified ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{c.name}</h3>
                          {c.is_verified && (
                            <Badge className="bg-green-500 text-white border-0 py-0 h-5 px-2 text-[10px] uppercase font-black">
                              {lang === "fr" ? "Vérifié" : "Yemejwe"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {c.province}, {c.commune}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> {c.contact_phone}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">
                          ID: #{c.id} • {lang === 'fr' ? 'Créé le' : 'Yashinzwe'} {new Date(c.created_at || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="p-6 bg-accent/20 md:border-l border-t md:border-t-0 border-border/50 flex flex-col justify-center gap-2 shrink-0 md:w-64">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase text-muted-foreground">{lang === 'fr' ? 'Statut' : 'Uko ameze'}</span>
                        <Badge variant={c.is_verified ? "outline" : "secondary"}>
                          {c.is_verified 
                            ? (lang === 'fr' ? "Approuvé" : "Imejwe") 
                            : (lang === 'fr' ? "En attente" : "Birindiranye")}
                        </Badge>
                      </div>
                      
                      <Button
                        onClick={() => handleVerify(c.id, c.is_verified)}
                        disabled={verifyingId === c.id}
                        variant={c.is_verified ? "outline" : "default"}
                        className={`w-full rounded-xl gap-2 font-bold ${!c.is_verified ? 'bg-sidebar-primary' : 'border-red-500/20 text-red-500 hover:bg-red-500/5'}`}
                      >
                        {verifyingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : c.is_verified ? (
                          <>
                            <XCircle className="w-4 h-4" />
                            {lang === "fr" ? "Révoquer" : "Gukura"}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            {lang === "fr" ? "Vérifier" : "Kwemeza"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
