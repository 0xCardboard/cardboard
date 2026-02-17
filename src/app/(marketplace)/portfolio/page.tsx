import { Wallet } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">My Portfolio</h1>
        <p className="text-muted-foreground mt-1">View your card IOUs and holdings.</p>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/50 p-16 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Wallet className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">No holdings yet</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Your card IOUs and holdings will appear here once you start trading
          on the exchange.
        </p>
      </div>
    </div>
  );
}
