import { ArrowUpRight, Loader2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatBIF } from "@/lib/currency";

export function WalletCard({ balance, pending }: { balance: number, pending: number }) {
  const displayBalance = balance !== null ? formatBIF(balance) : "---";

  return (
    <div className="rounded-xl bg-primary p-5 text-primary-foreground">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-primary-foreground/75">
            <WalletCards className="h-4 w-4" aria-hidden="true" />
            <p>Portefeuille AgriConnect</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-semibold mt-1 tracking-tight tabular-nums">
              {displayBalance}
            </p>
            {balance === null && <Loader2 className="w-4 h-4 animate-spin opacity-50" />}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/70" aria-hidden="true" />
        <p className="text-xs text-primary-foreground/75">
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
