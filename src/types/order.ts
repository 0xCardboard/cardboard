export interface OrderBookEntry {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  cardId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number | null;
  lastTradePrice: number | null;
  lastTradeTime: string | null;
}

export interface PlaceOrderInput {
  cardId: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  price?: number; // cents, required for LIMIT
  quantity?: number; // defaults to 1
  cardInstanceId?: string; // required for SELL
  gradingCompany?: "PSA" | "BGS" | "CGC"; // optional filter for BUY
  minGrade?: number; // optional filter for BUY
  idempotencyKey?: string;
}

export interface OrderWithDetails {
  id: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  price: number | null;
  quantity: number;
  filledQuantity: number;
  status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
  gradingCompany: string | null;
  minGrade: number | null;
  createdAt: Date;
  updatedAt: Date;
  card: {
    id: string;
    name: string;
    imageUrl: string | null;
    set: { id: string; name: string };
  };
  cardInstance: {
    id: string;
    certNumber: string;
    grade: number;
    gradingCompany: string;
  } | null;
}

export interface UserOrderFilters {
  side?: "BUY" | "SELL";
  status?: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
  cardId?: string;
  page?: number;
  limit?: number;
}

export interface TradeWithDetails {
  id: string;
  price: number;
  quantity: number;
  escrowStatus: string;
  createdAt: Date;
  buyOrder: {
    id: string;
    card: { id: string; name: string; imageUrl: string | null };
  };
  sellOrder: {
    id: string;
    cardInstance: {
      id: string;
      certNumber: string;
      grade: number;
      gradingCompany: string;
    } | null;
  };
  buyer: { id: string; name: string | null };
  seller: { id: string; name: string | null };
  fee: { amount: number; rate: number } | null;
}

export interface TradeFilters {
  cardId?: string;
  page?: number;
  limit?: number;
}

export interface CardInstanceInput {
  cardId: string;
  gradingCompany: "PSA" | "BGS" | "CGC";
  certNumber: string;
  grade: number;
}

export interface CardInstanceWithDetails {
  id: string;
  cardId: string;
  gradingCompany: string;
  certNumber: string;
  grade: number;
  status: string;
  imageUrls: string[];
  verifiedAt: Date | null;
  createdAt: Date;
  card: {
    id: string;
    name: string;
    imageUrl: string | null;
    set: { id: string; name: string };
  };
  owner: { id: string; name: string | null };
}

export interface CardInstanceFilters {
  cardId?: string;
  status?: string;
  ownerId?: string;
  page?: number;
  limit?: number;
}
