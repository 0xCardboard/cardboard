import { CardGridItem } from "./CardGridItem";
import type { CardWithSet } from "@/types/card";

interface CardGridProps {
  cards: CardWithSet[];
}

export function CardGrid({ cards }: CardGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <CardGridItem key={card.id} card={card} />
      ))}
    </div>
  );
}
