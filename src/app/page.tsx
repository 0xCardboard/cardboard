"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  BarChart3,
  Lock,
  Zap,
  Globe,
  TrendingUp,
  ChevronDown,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Mail,
} from "lucide-react";

/* ── FAQ Accordion Item ─────────────────────────────────── */
function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-primary"
      >
        <span className="text-base font-medium pr-4">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
            isOpen ? "rotate-180 text-primary" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ${
          isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Landing Page ──────────────────────────────────── */
export default function Home() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  const features = [
    {
      icon: ShieldCheck,
      title: "Verified Authenticity",
      description:
        "Every card verified via PSA, BGS, or CGC certification. Cards are held in custody and verified against grading company databases before IOUs are issued.",
    },
    {
      icon: BarChart3,
      title: "Exchange-Style Order Books",
      description:
        "Place bids and asks just like a stock exchange. Price-time priority matching ensures fair execution for every trader on the platform.",
    },
    {
      icon: Lock,
      title: "Secure Escrow",
      description:
        "Stripe-powered escrow protects both sides of every trade. Funds are only released after card authenticity is confirmed and verified.",
    },
    {
      icon: Zap,
      title: "Instant Matching",
      description:
        "Our matching engine executes trades in real-time. Market orders fill instantly at the best available price, limit orders queue until matched.",
    },
    {
      icon: Globe,
      title: "Multi-Game Support",
      description:
        "Trade Pokemon TCG cards with full set catalog support. We sync the latest set releases automatically so new cards are available shortly after launch.",
    },
    {
      icon: TrendingUp,
      title: "Price Discovery",
      description:
        "Real-time market data shows you exactly where cards are trading. Track price history, order depth, and trading volume for informed decisions.",
    },
  ];

  const faqs = [
    {
      question: "How does Cardboard verify card authenticity?",
      answer:
        "Every card listed on Cardboard must be professionally graded by PSA, BGS, or CGC. Sellers ship their graded cards to our secure facility where we verify the certificate number against the grading company's database. Only after verification do we issue a tradeable IOU that can be bought and sold on the exchange.",
    },
    {
      question: "What are the fees for trading on Cardboard?",
      answer:
        "Cardboard charges a flat 5% transaction fee on completed trades — that's it. No listing fees, no subscription costs, no hidden charges. Compare that to eBay (12.9%), TCGPlayer (10.25%), or StockX (10%) and you'll see why traders are switching.",
    },
    {
      question: "How do limit and market orders work?",
      answer:
        "Just like a stock exchange! A market order executes immediately at the best available price. A limit order lets you set your price — it sits on the order book until another trader matches it. You can cancel open orders at any time.",
    },
    {
      question: "How are payments and escrow handled?",
      answer:
        "We use Stripe Connect for secure payment processing. When a trade is matched, the buyer's payment is held in escrow. Funds are only released to the seller after the card passes our verification process. If there's an issue, our dispute resolution team steps in.",
    },
    {
      question: "Which TCG games are supported?",
      answer:
        "We currently support Pokemon TCG, with more games being added soon. Our data syncs automatically with the official Pokemon TCG database, so new sets and cards appear shortly after release.",
    },
    {
      question: "Can I get my physical card back?",
      answer:
        "Absolutely. Any card IOU you hold can be redeemed at any time. Simply request a redemption through your portfolio and we'll ship the physical graded card to your address. Shipping fees apply.",
    },
  ];

  const pricingComparisons = [
    { platform: "eBay", fee: "12.9%", color: "oklch(0.6 0.22 25)" },
    { platform: "TCGPlayer", fee: "10.25%", color: "oklch(0.6 0.2 30)" },
    { platform: "StockX", fee: "10%", color: "oklch(0.6 0.18 35)" },
    { platform: "Cardboard", fee: "5%", color: "oklch(0.82 0.16 75)" },
  ];

  return (
    <div className="relative">
      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
        </div>

        <div className="container relative mx-auto px-4 pt-24 pb-20 md:pt-36 md:pb-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="animate-slide-up inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              <span>The TCG exchange, reimagined</span>
            </div>

            {/* Headline */}
            <h1 className="animate-slide-up-delay-1 text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl leading-[0.95]">
              Trade Graded Cards
              <br />
              <span className="text-gradient">Like Wall Street</span>
            </h1>

            {/* Subheadline */}
            <p className="animate-slide-up-delay-2 mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
              The peer-to-peer exchange for authenticated, graded trading cards.
              Real order books. Secure escrow. Just 5% fees.
              <br className="hidden sm:block" />
              Pokemon TCG and more coming soon.
            </p>

            {/* CTA Buttons */}
            <div className="animate-slide-up-delay-3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-base font-semibold" asChild>
                <Link href="/cards">
                  Browse Cards
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base font-semibold border-border/60 hover:border-primary/40 hover:bg-primary/5"
                asChild
              >
                <Link href="/register">Create Account</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="animate-slide-up-delay-4 mt-16 grid grid-cols-3 gap-8 mx-auto max-w-lg">
              {[
                { value: "5%", label: "Transaction Fee" },
                { value: "24/7", label: "Trading" },
                { value: "3", label: "Grading Companies" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-gradient font-[family-name:var(--font-display)]">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built for <span className="text-gradient">serious collectors</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to trade graded TCG cards with confidence,
              speed, and the lowest fees in the market.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border/50 bg-card/50 p-6 transition-all duration-300 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary/15">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2 font-[family-name:var(--font-display)]">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              How it <span className="text-gradient">works</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              From submission to trade in three simple steps.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Submit Your Card",
                description:
                  "Ship your PSA, BGS, or CGC graded card to our secure facility. We verify it against the grading company database and issue a tradeable IOU.",
              },
              {
                step: "02",
                title: "Place Your Order",
                description:
                  "Set a limit price or execute at market. Our exchange-style order book matches buyers and sellers with price-time priority — just like Wall Street.",
              },
              {
                step: "03",
                title: "Trade or Redeem",
                description:
                  "Trade card IOUs instantly on the exchange, or redeem them any time to get the physical graded card shipped directly to your door.",
              },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
                  <span className="text-2xl font-bold text-gradient font-[family-name:var(--font-display)]">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-3 font-[family-name:var(--font-display)]">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8 text-border">
                    <ArrowRight className="h-5 w-5 mx-auto" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── PRICING ───────────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Keep more of <span className="text-gradient">your profits</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Why give away 10–13% of every sale? Cardboard charges a flat 5%
              transaction fee — no listing fees, no subscription costs.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Fee comparison bars */}
            <div className="space-y-4">
              {pricingComparisons.map((item) => (
                <div key={item.platform} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-medium ${
                        item.platform === "Cardboard" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {item.platform}
                    </span>
                    <span
                      className={`text-sm font-bold font-[family-name:var(--font-mono)] ${
                        item.platform === "Cardboard"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.fee}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width:
                          item.platform === "Cardboard"
                            ? "38.7%"
                            : item.platform === "StockX"
                              ? "77.5%"
                              : item.platform === "TCGPlayer"
                                ? "79.4%"
                                : "100%",
                        background:
                          item.platform === "Cardboard"
                            ? "linear-gradient(90deg, oklch(0.82 0.16 75), oklch(0.72 0.18 55))"
                            : "oklch(0.4 0.02 260)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Savings callout */}
            <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <p className="text-2xl font-bold font-[family-name:var(--font-display)]">
                Save up to <span className="text-gradient">61%</span> on fees
              </p>
              <p className="text-muted-foreground mt-2">
                On a $500 card, that&apos;s $39.50 back in your pocket compared to
                eBay.
              </p>
            </div>

            {/* Feature list */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                "No listing fees",
                "No monthly subscription",
                "Free cancellations",
                "Transparent pricing",
                "Escrow protection",
                "Dispute resolution",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Frequently asked <span className="text-gradient">questions</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to know about trading on Cardboard.
            </p>
          </div>

          <div className="max-w-2xl mx-auto rounded-2xl border border-border/50 bg-card/50 px-6">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── NEWSLETTER CTA ────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-xl text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3 mb-6">
              <Mail className="h-6 w-6 text-primary" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Stay ahead of the <span className="text-gradient">market</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Get weekly insights on TCG market trends, new set releases, and
              trading tips delivered to your inbox.
            </p>

            {subscribed ? (
              <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-lg font-semibold">You&apos;re in!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Watch your inbox for the next market update.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleNewsletterSubmit}
                className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="flex-1 h-12 rounded-xl border border-border/60 bg-secondary/50 px-4 text-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                />
                <Button type="submit" size="lg" className="h-12 px-6 font-semibold shrink-0">
                  Subscribe
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              No spam, ever. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="relative border-t border-border/50 py-24 md:py-32">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        </div>
        <div className="container relative mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Ready to trade?
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
            Join the next generation of TCG trading. Lower fees, real order
            books, verified cards.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base font-semibold" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base font-semibold border-border/60"
              asChild
            >
              <Link href="/cards">Explore Cards</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
