import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { CardDetail as CardDetailType } from "@/types/card";

interface CardDetailProps {
  card: CardDetailType;
}

export function CardDetail({ card }: CardDetailProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {card.set.game.name} &middot; {card.set.name}
        </p>
        <h1 className="text-3xl font-bold mt-1 font-[family-name:var(--font-display)]">{card.name}</h1>
        {card.number && (
          <p className="text-muted-foreground mt-1 font-[family-name:var(--font-mono)]">#{card.number}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Price */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <p className="text-sm text-muted-foreground">Market Price</p>
          <p className="text-3xl font-bold text-gradient font-[family-name:var(--font-display)]">
            {formatPrice(card.marketPrice)}
          </p>
          {card.lastPriceSync && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(card.lastPriceSync).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {card.rarity && (
            <Badge variant="secondary" className="rounded-lg">{card.rarity}</Badge>
          )}
          {card.supertype && (
            <Badge variant="outline" className="rounded-lg">{card.supertype}</Badge>
          )}
          {card.subtypes?.map((subtype) => (
            <Badge key={subtype} variant="outline" className="rounded-lg">
              {subtype}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardImage({ card }: CardDetailProps) {
  const imageUrl = card.imageUrlHiRes || card.imageUrl;

  return (
    <div className="relative aspect-[2.5/3.5] w-full rounded-2xl overflow-hidden bg-secondary/30 border border-border/50">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={card.name}
          fill
          className="object-contain"
          unoptimized
          sizes="(max-width: 768px) 100vw, 280px"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          No Image Available
        </div>
      )}
    </div>
  );
}

export function CardPriceHistory({ card }: CardDetailProps) {
  if (card.priceHistory.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 font-[family-name:var(--font-display)]">
        Recent Price History
      </h2>
      <div className="rounded-xl border border-border/50 bg-card/50 divide-y divide-border/30">
        {card.priceHistory.slice(0, 10).map((entry, i) => (
          <div key={i} className="flex justify-between text-sm px-4 py-2.5">
            <span className="text-muted-foreground">
              {new Date(entry.timestamp).toLocaleDateString()}
            </span>
            <span className="font-medium font-[family-name:var(--font-mono)]">
              {formatPrice(entry.price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
