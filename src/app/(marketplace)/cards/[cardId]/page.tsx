import Link from "next/link";
import { notFound } from "next/navigation";
import { getCardById } from "@/services/card-catalog.service";
import { CardDetail, CardImage, CardPriceHistory } from "@/components/cards/CardDetail";
import { OrderBook } from "@/components/order-book/OrderBook";
import { OrderForm } from "@/components/order-book/OrderForm";
import { TradeHistory } from "@/components/order-book/TradeHistory";
import { AppError } from "@/lib/errors";
import { ArrowLeft } from "lucide-react";

async function fetchCard(cardId: string) {
  try {
    return await getCardById(cardId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const card = await fetchCard(cardId);

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to browse
      </Link>
      <CardDetail card={card} />

      {/* Card Image + Order Book + Order Form */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">
        {/* Left: Card Image + Price History */}
        <div className="space-y-6">
          <CardImage card={card} />
          <CardPriceHistory card={card} />
        </div>

        {/* Middle: Order Book + Trade History */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
            <OrderBook cardId={cardId} />
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
            <TradeHistory cardId={cardId} />
          </div>
        </div>

        {/* Right: Place Order */}
        <div>
          <div className="sticky top-24 rounded-2xl border border-border/50 bg-card/50 p-5">
            <OrderForm cardId={cardId} />
          </div>
        </div>
      </div>
    </div>
  );
}
