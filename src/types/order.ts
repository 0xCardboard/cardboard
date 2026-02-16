export interface OrderBookEntry {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  cardId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastTradePrice?: number;
  lastTradeTime?: string;
}
