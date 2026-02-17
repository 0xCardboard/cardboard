import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { CardWithSet } from "@/types/card";

interface CardGridItemProps {
  card: CardWithSet;
}

export function CardGridItem({ card }: CardGridItemProps) {
  return (
    <Link href={`/cards/${card.id}`} className="group">
      <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
        <div className="relative aspect-[2.5/3.5] bg-secondary/30">
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              className="object-contain transition-transform duration-300 group-hover:scale-105"
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
              No Image
            </div>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          <p className="text-sm font-medium leading-tight truncate" title={card.name}>
            {card.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {card.set.game.name} &middot; {card.set.name}
          </p>
          <div className="flex items-center justify-between gap-1">
            {card.rarity && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md">
                {card.rarity}
              </Badge>
            )}
            <span className="text-sm font-bold text-primary ml-auto font-[family-name:var(--font-mono)]">
              {formatPrice(card.marketPrice)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
