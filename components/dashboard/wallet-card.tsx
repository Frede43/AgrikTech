import { ArrowUpRight, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatBIF } from "@/lib/currency";

export function WalletCard({ balance, pending }: { balance: number, pending: number }) {
  const displayBalance = balance !== null ? formatBIF(balance) : "---";

  return (
    <div
      className="rounded-2xl p-5 text-foreground"
      style={{
        background: "linear-gradient(135deg, oklch(0.42 0.13 145), oklch(0.55 0.14 160))",
        color: "white",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium opacity-75">Portefeuille AgriConnect</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold mt-1 tracking-tight">
              {displayBalance}
            </p>
            {balance === null && <Loader2 className="w-4 h-4 animate-spin opacity-50" />}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
        <p className="text-xs opacity-75">
          En attente: <span className="font-semibold">{formatBIF(pending)}</span>
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          asChild
          size="sm"
          className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold text-xs h-9 rounded-xl"
        >
          <Link href="/portefeuille">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
            Retirer vers Lumicash
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20 font-semibold text-xs h-9 rounded-xl"
        >
          <Link href="/transactions">Historique</Link>
        </Button>
      </div>
    </div>
  );
}
