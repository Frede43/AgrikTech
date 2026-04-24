"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { formatBIF } from "@/lib/currency";
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, QrCode, Search, RefreshCw, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch, redirectToLoginIfUnauthorized } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { logIfNotNetworkError } from "@/lib/offline";

interface Transaction {
  id: string;
  date: string;
  type: string;
  status: string;
  buyer: string;
  items: string;
  gross: number;
  commission: number;
  net: number;
  order_id?: number | null;
  order_reference?: string | null;
  pickup_qr?: string | null;
  channel?: string | null;
  destination_phone?: string | null;
  note?: string | null;
}

interface PlatformSettings {
  commission_rate: number;
}

export default function TransactionsPage() {
  const { session, ready } = useRequiredSession("fermier");
  const { lang, text } = useLanguage();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const statusConfig = {
    paid: { label: text.transStatusPaid, color: "bg-primary/10 text-primary border-primary/20" },
    pending: { label: text.transStatusPending, color: "bg-amber-100 text-amber-700 border-amber-200" },
    completed: { label: text.transStatusCompleted, color: "bg-muted text-muted-foreground border-border" },
    rejected: {
      label: lang === "fr" ? "Rejeté" : "Vyanzwe",
      color: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };

  const getTransactionStatusMeta = (txn: Transaction) => {
    if (txn.type === "payout") {
      if (txn.status === "completed" || txn.status === "paid") {
        return {
          label: lang === "fr" ? "Retrait traité" : "Gukura vyatunganijwe",
          color: "bg-primary/10 text-primary border-primary/20",
          Icon: CheckCircle,
        };
      }

      if (txn.status === "rejected") {
        return {
          label: lang === "fr" ? "Retrait rejeté" : "Gukura vyanzwe",
          color: "bg-destructive/10 text-destructive border-destructive/20",
          Icon: XCircle,
        };
      }

      return {
        label: lang === "fr" ? "Retrait demandé" : "Gukura vyasabwe",
        color: "bg-amber-100 text-amber-700 border-amber-200",
        Icon: Clock,
      };
    }

    const status = statusConfig[txn.status as keyof typeof statusConfig] || statusConfig.pending;
    return {
      ...status,
      Icon: txn.status === "paid" ? CheckCircle : Clock,
    };
  };

  useEffect(() => {
    if (!ready || !session) return;

    setLoading(true);
    Promise.all([
      apiFetch(`/users/${session.userId}/transactions`),
      apiFetch("/platform/settings"),
    ])
      .then(([data, settingsData]) => {
        setTransactions(data as Transaction[]);
        setSettings(settingsData as PlatformSettings);
      })
      .catch((err) => {
        if (redirectToLoginIfUnauthorized(err, session.role)) {
          return;
        }

        logIfNotNetworkError("Transactions fetch error", err);
      })
      .finally(() => setLoading(false));
  }, [ready, session]);

  const filtered = transactions.filter((t) => {
    const matchFilter = filter === "all" || t.type === filter || t.status === filter;
    const normalizedSearch = search.toLowerCase();
    const haystack = [
      t.buyer,
      t.id,
      t.items,
      t.order_reference || "",
      t.destination_phone || "",
      t.channel || "",
      t.note || "",
    ]
      .join(" ")
      .toLowerCase();
    const matchSearch = haystack.includes(normalizedSearch);
    return matchFilter && matchSearch;
  });

  const totalSales = transactions
    .filter((t) => t.type === "sale" && t.status === "paid")
    .reduce((s, t) => s + t.net, 0);
  const totalPayouts = transactions
    .filter((t) => t.type === "payout")
    .reduce((s, t) => s + Math.abs(t.net), 0);
  const pendingTotal = transactions
    .filter((t) => t.type === "sale" && (t.status === "pending" || t.status === "completed"))
    .reduce((s, t) => s + t.net, 0);

  return (
    <DashboardLayout title={text.transTitle} subtitle={text.transSubtitle}>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">{text.transTotalReceived}</p>
          <p className="text-2xl font-bold text-primary tracking-tight">{formatBIF(totalSales)}</p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
            {text.transAfterComm} ({((settings?.commission_rate || 0) * 100).toFixed(1)}%)
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">{text.transPayouts}</p>
          <p className="text-2xl font-bold text-foreground tracking-tight">{formatBIF(totalPayouts)}</p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-tight">{text.transThisMonth}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">{text.transPending}</p>
          <p className="text-2xl font-bold text-amber-600 tracking-tight">{formatBIF(pendingTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-tight">{text.transWorking}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={text.transSearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 rounded-xl border border-input bg-card h-11 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {[
            { id: "all", label: text.transTypeAll },
            { id: "sale", label: text.transTypeSales },
            { id: "payout", label: text.transTypePayouts },
            { id: "pending", label: text.transTypePending },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border h-11 flex items-center ${filter === f.id
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 border-b border-border bg-secondary/30">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{text.transColHeader}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{text.transColGross}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{text.transColNet}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{text.transColStatus}</span>
        </div>

        <div className="divide-y divide-border/50">
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-4">
              <RefreshCw className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">{text.dashLoading}</p>
            </div>
          ) : filtered.map((txn) => {
            const isSale = txn.type === "sale";
            const status = getTransactionStatusMeta(txn);
            const StatusIcon = status.Icon;

            return (
              <div
                key={txn.id}
                className="flex items-center gap-4 px-6 py-5 hover:bg-secondary/20 transition-colors"
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isSale ? "bg-primary/10 text-primary border border-primary/5" : "bg-secondary text-muted-foreground border border-border/50"
                    }`}
                >
                  {isSale ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{txn.buyer}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline font-mono">
                      #{txn.order_reference || txn.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate leading-tight">
                    {txn.type === "sale"
                      ? txn.items
                      : `${txn.channel || "Mobile Money"}${txn.destination_phone ? ` · ${txn.destination_phone}` : ""}`}
                  </p>
                  {txn.type === "payout" && txn.note && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {txn.note}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-bold tracking-tight">
                    {new Date(txn.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Amounts */}
                <div className="text-right hidden md:block shrink-0 min-w-[100px]">
                  {txn.type === "sale" ? (
                    <>
                      <p className="text-xs font-bold text-foreground">{formatBIF(txn.gross)}</p>
                      {txn.commission > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 font-medium">-{formatBIF(txn.commission)} comm.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{txn.channel || "Retrait"}</p>
                  )}
                </div>
                <div className="text-right shrink-0 min-w-[90px]">
                  <p className={`text-sm font-bold tracking-tight ${txn.net > 0 ? "text-primary" : "text-foreground"}`}>
                    {txn.net > 0 ? "+" : "-"}
                    {formatBIF(Math.abs(txn.net))}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-none ${status.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {status.label}
                  </span>

                  {/* QR Code Action for Pending Sales */}
                  {txn.status === "pending" && isSale && txn.pickup_qr && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="w-9 h-9 rounded-xl border-primary/20 hover:bg-primary/10 text-primary shadow-sm">
                          <QrCode className="w-4.5 h-4.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="text-center text-lg font-bold pb-4 border-b border-border">{text.transQrTitle}</DialogTitle>
                          <DialogDescription className="text-center pt-2 font-mono text-sm">
                            #{txn.order_reference || txn.id.slice(0, 12)}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center space-y-6 py-8">
                          <div className="p-4 bg-white rounded-2xl shadow-md border border-border flex items-center justify-center">
                            <QrCode className="w-32 h-32 text-primary" />
                          </div>
                          <p className="text-sm font-bold text-foreground uppercase tracking-widest">{text.transQrCodeDesc}</p>
                          <p className="text-xs text-center text-muted-foreground px-6 leading-relaxed">
                            {text.transQrNote}
                          </p>
                          <div className="bg-primary/10 px-6 py-3 rounded-xl border border-primary/20 font-mono font-black text-2xl text-primary tracking-widest shadow-inner">
                            {txn.pickup_qr}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">{text.transNoFound}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
