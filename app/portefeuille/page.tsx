"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { formatBIF } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowUpRight,
  Smartphone,
  Shield,
  Info,
  CheckCircle,
  Clock,
  Banknote,
  RefreshCw,
} from "lucide-react";

import { apiFetch, redirectToLoginIfUnauthorized } from "@/lib/api-config";
import { getDisplayErrorMessage, logIfNotNetworkError } from "@/lib/offline";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";

interface WalletUser {
  phone_number: string;
  balance: number;
}

interface WalletTransaction {
  id: string;
  date: string;
  type: string;
  status: string;
  gross: number;
  net: number;
  channel?: string | null;
  destination_phone?: string | null;
  note?: string | null;
}

interface FarmerStats {
  balance: number;
  pending_payout: number;
}

export default function WalletPage() {
  const { session, ready } = useRequiredSession("fermier");
  const [user, setUser] = useState<WalletUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lang, text } = useLanguage();

  const loadData = async (userId: number) => {
    const [userData, transData, statsData] = await Promise.all([
      apiFetch(`/users/${userId}`),
      apiFetch(`/users/${userId}/transactions`),
      apiFetch(`/stats/farmer/${userId}`),
    ]);

    const currentUser = userData as WalletUser;
    const currentStats = statsData as FarmerStats;

    setUser(currentUser);
    setBalance(currentUser.balance ?? currentStats.balance ?? 0);
    setPending(currentStats.pending_payout ?? 0);
    setTransactions((transData as WalletTransaction[]).filter((t) => t.type === "payout"));
    setPhoneNumber(currentUser.phone_number || "");
  };

  useEffect(() => {
    if (!ready || !session) return;

    const fetchData = async () => {
      try {
        await loadData(session.userId);
        setError(null);
      } catch (err) {
        if (redirectToLoginIfUnauthorized(err, session.role)) {
          return;
        }

        logIfNotNetworkError("Wallet error", err);
        setError(lang === "fr" ? "Impossible de charger votre portefeuille." : "Ntivyashobotse gufungura uruhago rwawe.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ready, session, lang]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const result = await apiFetch("/wallet/withdrawals", {
        method: "POST",
        body: JSON.stringify({
          user_id: session.userId,
          amount: Number(amount),
          channel: "Lumicash",
          phone_number: phoneNumber.trim() || undefined,
        }),
      });

      setAmount("");
      setFeedback((result as { message?: string }).message || text.walletWithdrawSuccess);
      await loadData(session.userId);
    } catch (err: unknown) {
      if (redirectToLoginIfUnauthorized(err, session.role)) {
        return;
      }

      logIfNotNetworkError("Wallet withdrawal error", err);
      setError(getDisplayErrorMessage(err, text.walletWithdrawError));
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawalHelpText =
    lang === "fr"
      ? "Les retraits simples sont traités automatiquement. Les montants élevés ou sensibles sont validés par l'administration sous 24h."
      : "Amafaranga yoroshe gukura aca atunganywa ubwo nyene. Ayinshi canke ateye amakenga asubirwamwo n'ubuyobozi mu masaha 24.";

  const minWithdrawalAmount = 10_000;
  const parsedAmount = Number(amount);
  const isAmountEntered = amount.trim() !== "";
  const isBelowMinimumWithdrawal =
    isAmountEntered && parsedAmount > 0 && parsedAmount < minWithdrawalAmount;
  const isTransferDisabled =
    submitting ||
    balance === null ||
    !phoneNumber.trim() ||
    !amount ||
    isBelowMinimumWithdrawal ||
    parsedAmount > balance;

  const getPayoutStatusMeta = (transaction: WalletTransaction) => {
    if (transaction.status === "completed" || transaction.status === "paid") {
      return {
        label: lang === "fr" ? "Retrait traité" : "Gukura vyatunganijwe",
        className: "bg-primary/10 text-primary",
        description:
          transaction.note ||
          (lang === "fr"
            ? "Votre retrait a été validé et marqué comme traité."
            : "Amafaranga yawe yemejwe kandi afatwa nk'ayarungitswe."),
      };
    }

    if (transaction.status === "rejected") {
      return {
        label: lang === "fr" ? "Retrait rejeté" : "Gukura vyanzwe",
        className: "bg-destructive/10 text-destructive",
        description:
          transaction.note ||
          (lang === "fr"
            ? "Le montant a été recrédité sur votre solde."
            : "Amafaranga yasubijwe kuri solde yawe."),
      };
    }

    return {
      label: lang === "fr" ? "Retrait demandé" : "Gukura vyasabwe",
      className: "bg-amber-100 text-amber-700",
      description:
        transaction.note ||
        (lang === "fr"
          ? "Validation par l'administration sous 24h. Vous serez notifié dès l'approbation."
          : "Biri kugenzurwa n'ubuyobozi mu masaha 24. Uzomenyeshwa bimaze kwemezwa."),
    };
  };

  if (loading || balance === null) {
    return (
      <DashboardLayout title={text.dashLoading} subtitle={text.walletSecuring}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{text.walletSecuring}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={text.walletTitle} subtitle={text.walletSubtitle}>
      {/* Main wallet card */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.22 0.05 145), oklch(0.38 0.12 148))",
        }}
      >
        {/* Decorative circle */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-2 bottom-4 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm opacity-75 font-medium">{text.walletBalance}</p>
              <p className="text-4xl font-bold mt-1 tracking-tight">
                {formatBIF(balance)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <Banknote className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-70 mb-1">{text.walletPending}</p>
              <p className="text-lg font-bold">{formatBIF(pending)}</p>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 opacity-70" />
                <p className="text-xs opacity-70">{text.walletUnder48h}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-70 mb-1">{text.walletLinked}</p>
              <p className="text-sm font-bold text-white truncate">{user?.phone_number || text.walletNotSet}</p>
              <div className="flex items-center gap-1 mt-1">
                <Shield className="w-3 h-3 opacity-70" />
                <p className="text-xs opacity-70">{text.walletVerified}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer form */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{text.walletWithdrawTitle}</h2>
              <p className="text-xs text-muted-foreground">{text.walletWithdrawSub}</p>
            </div>
          </div>

          <form onSubmit={handleTransfer} className="space-y-4">
            {feedback && (
              <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-sm text-primary">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{feedback}</p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-2">
              <Label className="text-sm font-medium">{text.walletDestPhone}</Label>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+257..."
                className="rounded-xl border-input bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{text.walletWithdrawAmount}</Label>
              <Input
                type="number"
                placeholder={text.walletMinAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minWithdrawalAmount}
                max={balance}
                required
                className="rounded-xl border-input bg-background text-lg font-bold"
              />
              {isBelowMinimumWithdrawal && (
                <p className="text-xs font-medium text-amber-600">
                  {lang === "fr"
                    ? "Le montant minimum de retrait est 10 000 BIF."
                    : "Amahera make ushobora gukura ni 10 000 BIF."}
                </p>
              )}
              {amount && Number(amount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {text.walletRemaining}{" "}
                  <span className="font-semibold text-foreground">
                    {formatBIF(Math.max(balance - Number(amount), 0))}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{text.walletQuickAmounts}</p>
              <div className="flex flex-wrap gap-2">
                {[50_000, 100_000, 200_000, 500_000].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${amount === amt.toString()
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                  >
                    {formatBIF(amt)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{withdrawalHelpText}</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground rounded-xl font-semibold h-11"
              disabled={isTransferDisabled}
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <ArrowUpRight className="w-4 h-4 mr-1.5 text-white" />
              )}
              {text.walletWithdrawBtn}
            </Button>
          </form>
        </div>

        {/* Payout history */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">{text.walletHistoryTitle}</h2>
          <div className="space-y-3">
            {transactions.map((p) => (
              (() => {
                const statusMeta = getPayoutStatusMeta(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-4 py-3 px-4 rounded-xl bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {lang === "fr" ? "Retrait" : "Gukura"} {p.channel || "Mobile Money"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "rn-BI", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{p.destination_phone || user?.phone_number}</p>
                        <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                          {statusMeta.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatBIF(Math.abs(p.gross || p.net))}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })()
            ))}
            {transactions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {text.walletHistoryEmpty}
              </div>
            )}
          </div>

          {/* Credit score hint */}
          <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary">{text.walletCreditScoreTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {text.walletCreditScoreDesc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
