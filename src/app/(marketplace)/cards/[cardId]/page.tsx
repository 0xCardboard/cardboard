import Link from "next/link";
import { notFound } from "next/navigation";
import { getCardById } from "@/services/card-catalog.service";
import { CardDetail } from "@/components/cards/CardDetail";
import { OrderBook } from "@/components/order-book/OrderBook";
import { OrderForm } from "@/components/order-book/OrderForm";
import { TradeHistory } from "@/components/order-book/TradeHistory";
import { AppError } from "@/lib/errors";

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
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
      >
        &larr; Back to browse
      </Link>
      <CardDetail card={card} />

      {/* Order Book + Trading Section */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <OrderBook cardId={cardId} />
          <TradeHistory cardId={cardId} />
        </div>
        <div>
          <OrderForm cardId={cardId} />
        </div>
      </div>
    </div>
  );
}
