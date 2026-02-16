import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { CardDetail as CardDetailType } from "@/types/card";

interface CardDetailProps {
  card: CardDetailType;
}

export function CardDetail({ card }: CardDetailProps) {
  const imageUrl = card.imageUrlHiRes || card.imageUrl;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Image */}
      <div className="flex justify-center">
        <div className="relative aspect-[2.5/3.5] w-full max-w-sm bg-muted rounded-lg overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={card.name}
              fill
              className="object-contain"
              unoptimized
              sizes="(max-width: 768px) 100vw, 384px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No Image Available
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {card.set.game.name} &middot; {card.set.name}
          </p>
          <h1 className="text-3xl font-bold mt-1">{card.name}</h1>
          {card.number && (
            <p className="text-muted-foreground mt-1">#{card.number}</p>
          )}
        </div>

        {/* Price */}
        <div>
          <p className="text-sm text-muted-foreground">Market Price</p>
          <p className="text-3xl font-bold">{formatPrice(card.marketPrice)}</p>
          {card.lastPriceSync && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(card.lastPriceSync).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {card.rarity && <Badge variant="secondary">{card.rarity}</Badge>}
          {card.supertype && <Badge variant="outline">{card.supertype}</Badge>}
          {card.subtypes?.map((subtype) => (
            <Badge key={subtype} variant="outline">
              {subtype}
            </Badge>
          ))}
        </div>

        {/* Price History */}
        {card.priceHistory.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Recent Price History</h2>
            <div className="space-y-1">
              {card.priceHistory.slice(0, 10).map((entry, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm py-1 border-b last:border-0"
                >
                  <span className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                  <span className="font-medium">{formatPrice(entry.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
