import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <section className="flex flex-col items-center text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Trade Graded TCG Cards
        </h1>
        <p className="max-w-[600px] text-lg text-muted-foreground">
          The peer-to-peer marketplace for authenticated, graded trading cards.
          Pokemon, One Piece, and more — with full exchange-style order books.
        </p>
        <div className="flex gap-4">
          <Button size="lg" asChild>
            <Link href="/cards">Browse Cards</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/register">Start Trading</Link>
          </Button>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Verified Authenticity</CardTitle>
            <CardDescription>
              Every card verified via PSA, BGS, or CGC certification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cards are held in custody and verified against grading company
              databases before IOUs are issued for trading.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Exchange-Style Trading</CardTitle>
            <CardDescription>
              Full order book with limit and market orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Place bids and asks just like a stock exchange. Price-time priority
              matching ensures fair execution for all traders.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Secure Escrow</CardTitle>
            <CardDescription>
              Payments held safely until verification is complete
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Stripe-powered escrow protects both buyers and sellers. Funds are
              only released after card authenticity is confirmed.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
