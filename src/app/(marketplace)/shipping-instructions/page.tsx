import Link from "next/link";
import { ArrowLeft, Package, ShieldCheck, Truck, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Shipping Instructions | Cardboard",
  description: "How to ship your graded cards to the Cardboard warehouse.",
};

export default function ShippingInstructionsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to orders
      </Link>

      <h1 className="text-3xl font-bold font-[family-name:var(--font-display)] mb-2">
        Shipping Instructions
      </h1>
      <p className="text-muted-foreground mb-8">
        Everything you need to know about sending your graded cards to our warehouse.
      </p>

      {/* Warehouse Address */}
      <section className="rounded-2xl border border-border/50 bg-card/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Warehouse Address
          </h2>
        </div>
        <div className="rounded-xl bg-secondary/50 border border-border/40 p-4 font-medium text-sm leading-relaxed">
          <p>Cardboard Warehouse</p>
          <p>Attn: Card Verification</p>
          <p>123 Trading Card Lane</p>
          <p>Suite 100</p>
          <p>Austin, TX 78701</p>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Include your username and cert number(s) on a note inside the package.
        </p>
      </section>

      {/* Packing Guidelines */}
      <section className="rounded-2xl border border-border/50 bg-card/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Packing Guidelines
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">1.</span>
            <span>
              <strong className="text-foreground">Protect the slab.</strong> Wrap each graded card slab in bubble wrap or foam padding.
              The PSA case should not be able to shift freely inside the package.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">2.</span>
            <span>
              <strong className="text-foreground">Use a sturdy box.</strong> Ship in a rigid box (not a padded envelope).
              Fill any empty space with packing material to prevent movement.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">3.</span>
            <span>
              <strong className="text-foreground">Include a packing slip.</strong> Write your Cardboard username and the PSA cert number(s) on a piece of paper inside the box.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">4.</span>
            <span>
              <strong className="text-foreground">Ship with tracking.</strong> Use a carrier that provides tracking (USPS Priority, UPS, FedEx).
              You&apos;ll need to enter the tracking number on your orders page.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">5.</span>
            <span>
              <strong className="text-foreground">Insure your shipment.</strong> We recommend purchasing shipping insurance for valuable cards.
              Cardboard is not responsible for cards lost or damaged in transit to our warehouse.
            </span>
          </li>
        </ul>
      </section>

      {/* Verification Process */}
      <section className="rounded-2xl border border-border/50 bg-card/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            What Happens After We Receive Your Card
          </h2>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">1.</span>
            <span>
              <strong className="text-foreground">Receiving.</strong> Our ops team logs your package and matches the card to your account using the cert number.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">2.</span>
            <span>
              <strong className="text-foreground">Cert lookup.</strong> We verify the PSA cert number against PSA&apos;s database to confirm grade, card identity, and authenticity.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">3.</span>
            <span>
              <strong className="text-foreground">Approval or rejection.</strong> If everything checks out, the card is marked as <strong className="text-green-400">Verified</strong> and vaulted.
              If there&apos;s an issue (cert mismatch, damage, suspected counterfeit), we&apos;ll notify you and arrange a return.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-foreground shrink-0">4.</span>
            <span>
              <strong className="text-foreground">Trade settlement.</strong> If the card was sold before shipping (sell-first flow),
              the buyer&apos;s escrowed funds are released to you upon verification. If you vaulted the card without a sale, it appears in your portfolio ready to list.
            </span>
          </li>
        </ol>
      </section>

      {/* Deadlines */}
      <section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Shipping Deadline
          </h2>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            After your sell order matches a buyer, you have <strong className="text-foreground">3 business days</strong> to ship your card.
          </p>
          <p>
            If you miss the deadline, the trade will be automatically cancelled and the buyer will be refunded.
            Repeated deadline misses may affect your account standing.
          </p>
          <p>
            The exact deadline is shown on your{" "}
            <Link href="/orders" className="text-primary hover:underline">
              orders page
            </Link>{" "}
            after a match.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="rounded-2xl border border-border/50 bg-card/50 p-6">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">
          FAQ
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground">Can I ship multiple cards in one package?</p>
            <p className="text-muted-foreground mt-1">
              Yes. Include all cert numbers on your packing slip. Each card must be individually wrapped.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Which carriers do you accept?</p>
            <p className="text-muted-foreground mt-1">
              Any carrier with tracking works: USPS, UPS, FedEx, DHL. We recommend USPS Priority Mail for domestic shipments.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">How long does verification take?</p>
            <p className="text-muted-foreground mt-1">
              Typically 1-2 business days after we receive your card. You&apos;ll get a notification when verification is complete.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">What if my card fails verification?</p>
            <p className="text-muted-foreground mt-1">
              We&apos;ll notify you with the reason (cert mismatch, damage, etc.) and ship the card back to you at our expense.
              If there was a pending trade, the buyer is automatically refunded.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do I need to pay for return shipping?</p>
            <p className="text-muted-foreground mt-1">
              No. If we reject a card or you redeem a card from the vault, return shipping is on us during the beta period.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
