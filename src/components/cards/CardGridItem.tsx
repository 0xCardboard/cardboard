import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { CardWithSet } from "@/types/card";

interface CardGridItemProps {
  card: CardWithSet;
}

export function CardGridItem({ card }: CardGridItemProps) {
  return (
    <Link href={`/cards/${card.id}`}>
      <Card className="overflow-hidden transition-colors hover:border-primary/50">
        <div className="relative aspect-[2.5/3.5] bg-muted">
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              className="object-contain"
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
              No Image
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-1">
          <p className="text-sm font-medium leading-tight truncate" title={card.name}>
            {card.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {card.set.game.name} &middot; {card.set.name}
          </p>
          <div className="flex items-center justify-between gap-1">
            {card.rarity && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {card.rarity}
              </Badge>
            )}
            <span className="text-sm font-semibold ml-auto">
              {formatPrice(card.marketPrice)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
