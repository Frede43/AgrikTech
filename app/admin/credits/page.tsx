"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, X, User, ArrowUpRight } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function AdminCreditsPage() {
  const { lang, text } = useLanguage();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/credits");
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: number, action: "approve" | "reject") => {
    try {
      await apiFetch(`/credits/${id}/review?action=${action}`, { method: "PUT" });
      loadRequests();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AdminLayout title={text.creditAdminTitle} subtitle={text.creditAdminSubtitle}>
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                {lang === "fr" ? "Demandes en attente" : "Ideni ririndiranye"}
              </h2>
              <Badge variant="outline">{text.creditPendingTasks.replace("{count}", String(requests.filter(r => r.status === 'pending').length))}</Badge>
            </div>

            <div className="space-y-4">
              {loading ? (
                <p className="text-center py-10 text-muted-foreground">{text.dashLoading}</p>
              ) : requests.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">{text.creditEmpty}</p>
              ) : (
                requests.map((r) => (
                  <div key={r.id} className="p-5 rounded-2xl border bg-accent/20 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{lang === "fr" ? "Utilisateur" : "Uwukoresha"} #{r.user_id}</span>
                        <Badge className="bg-sidebar-primary/20 text-sidebar-primary border-0 ml-2">
                          {r.amount_requested.toLocaleString()} BIF
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground italic">"{r.reason}"</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{lang === "fr" ? "Récolte estimée" : "Umwimbu ugereranijwe"}: {r.harvest_estimate_kg} kg</span>
                        <span>{lang === "fr" ? "Produit" : "Igicuruzwa"}: {r.product_type}</span>
                        <span>Date: {new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {r.status === 'pending' ? (
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          onClick={() => handleReview(r.id, "reject")} 
                          variant="outline" 
                          className="rounded-xl border-red-500/50 text-red-500 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4 mr-1" /> {text.creditRejectBtn}
                        </Button>
                        <Button 
                          onClick={() => handleReview(r.id, "approve")} 
                          className="rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"
                        >
                          <Check className="w-4 h-4 mr-1" /> {text.creditApproveBtn}
                        </Button>
                      </div>
                    ) : (
                      <Badge className={
                        r.status === 'approved' ? "bg-green-500/10 text-green-500 border-0" : "bg-red-500/10 text-red-500 border-0"
                      }>
                        {r.status === 'approved' ? text.creditStatusApproved : text.creditStatusRejected}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
