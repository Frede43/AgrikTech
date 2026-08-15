"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";

export default function FarmerCreditsPage() {
  const { session } = useRequiredSession("fermier");
  const { lang, text } = useLanguage();
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (session) {
      apiFetch("/credits/me")
        .then(setCredits)
        .finally(() => setLoading(false));
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !reason) return;

    try {
      const res = await apiFetch("/credits/request", {
        method: "POST",
        body: JSON.stringify({
          amount_requested: parseFloat(amount),
          reason: reason,
          user_id: session?.userId
        })
      });
      setCredits([res, ...credits]);
      setAmount("");
      setReason("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout 
      title={text.creditTitle} 
      subtitle={text.creditSubtitle}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire de demande */}
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {text.creditNewRequest}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{text.creditAmountLabel}</label>
                <Input 
                   type="number" 
                   placeholder="ex: 100000" 
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{text.creditReasonLabel}</label>
                <textarea 
                  className="w-full min-h-[100px] p-3 rounded-xl border bg-background text-sm"
                  placeholder={lang === "fr" ? "ex: Achat de semences de maïs pour la Saison B" : "Akarorero: Kugura imbuto z'ibigori mu gihe c'ishira"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full rounded-xl">{text.creditSendBtn}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Historique */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              {text.creditHistoryTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-center py-10 text-muted-foreground">{text.dashLoading}</p>
              ) : credits.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-2xl">
                  <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">{text.creditEmpty}</p>
                </div>
              ) : (
                credits.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl border bg-accent/30">
                    <div>
                      <p className="font-bold">{parseFloat(c.amount_requested).toLocaleString()} BIF</p>
                      <p className="text-sm text-muted-foreground">{c.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className={
                      c.status === "approved" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                      c.status === "pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      "bg-red-500/10 text-red-500 border-red-500/20"
                    }>
                      {c.status === "approved" ? text.creditStatusApproved : c.status === "pending" ? text.creditStatusPending : text.creditStatusRejected}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
