import { CreditCard, Clock } from "lucide-react";

export default function BorrowPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">Borrow Against Cards</h1>
        <p className="text-muted-foreground mt-1">Use your card IOUs as collateral for instant liquidity.</p>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/50 p-16 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CreditCard className="h-7 w-7 text-primary" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary mb-4">
          <Clock className="h-3 w-3" />
          Coming in Phase 2
        </div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">Collateralized Borrowing</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Use your card IOUs as collateral to borrow capital. Launching soon.
        </p>
      </div>
    </div>
  );
}
