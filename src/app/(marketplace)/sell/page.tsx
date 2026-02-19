"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { formatPrice } from "@/lib/format";
import {
  Search,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Package,
  ExternalLink,
  AlertCircle,
  Lock,
  Info,
} from "lucide-react";
import type { OrderBookSnapshot } from "@/types/order";

interface CatalogCard {
  id: string;
  name: string;
  imageUrl: string | null;
  number: string | null;
  rarity: string | null;
  marketPrice: number | null;
  set: { id: string; name: string; game: { id: string; name: string } };
}

const STEPS = ["Find Your Card", "Card Details", "Set Your Price", "Review & Confirm"];

export default function SellPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>}>
      <SellPageContent />
    </Suspense>
  );
}

function SellPageContent() {
  const searchParams = useSearchParams();
  const { status: authStatus } = useAuth();
  const [step, setStep] = useState(0);

  // Step 1: Card search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Card details
  const [certNumber, setCertNumber] = useState("");
  const [certError, setCertError] = useState<string | null>(null);

  // Step 3: Pricing
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState("");
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [loadingOrderBook, setLoadingOrderBook] = useState(false);

  // Step 4: Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Tracks whether the card is already verified and in the warehouse
  const [isVaultedCard, setIsVaultedCard] = useState(false);

  // Pre-populate from query params (e.g., from portfolio "List for Sale")
  useEffect(() => {
    const cardId = searchParams.get("cardId");
    const cert = searchParams.get("certNumber");
    if (cardId) {
      fetch(`/api/cards/${cardId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            setSelectedCard(json.data);
            setStep(1);
          }
        })
        .catch(() => {});
    }
    if (cert) {
      setCertNumber(cert);
    }
    if (cardId && cert) {
      setIsVaultedCard(true);
    }
  }, [searchParams]);

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cards?name=${encodeURIComponent(query)}&limit=12`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Fetch order book when card is selected and we reach step 2
  useEffect(() => {
    if (!selectedCard) return;
    setLoadingOrderBook(true);
    fetch(`/api/orderbook/${selectedCard.id}`)
      .then((res) => res.json())
      .then((json) => setOrderBook(json.data ?? null))
      .catch(() => setOrderBook(null))
      .finally(() => setLoadingOrderBook(false));
  }, [selectedCard]);

  function validateCertNumber(value: string): string | null {
    if (!value.trim()) return "Certificate number is required";
    if (!/^\d{5,10}$/.test(value.trim())) return "PSA cert numbers are 5-10 digits";
    return null;
  }

  function handleSelectCard(card: CatalogCard) {
    setSelectedCard(card);
    setStep(1);
  }

  function handleStep2Next() {
    const err = validateCertNumber(certNumber);
    if (err) {
      setCertError(err);
      return;
    }
    setCertError(null);
    setStep(2);
  }

  function handleStep3Next() {
    if (orderType === "LIMIT") {
      const p = parseFloat(price);
      if (isNaN(p) || p <= 0) return;
    }
    setStep(3);
  }

  async function handleSubmit() {
    const token = getAccessToken();
    if (!token || !selectedCard) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const body: Record<string, unknown> = {
        cardId: selectedCard.id,
        side: "SELL",
        type: orderType,
        quantity: 1,
        certNumber: certNumber.trim(),
        gradingCompany: "PSA",
        grade: 10,
      };

      if (orderType === "LIMIT") {
        body.price = Math.round(parseFloat(price) * 100);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to place order");

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
          Sign in to sell
        </h1>
        <p className="text-muted-foreground mt-2 mb-6">
          You need an account to list cards for sale.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Success screen
  if (submitSuccess) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
          <Check className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
          Sell Order Placed
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Your sell order for <strong>{selectedCard?.name}</strong> is now on the order book.
          {isVaultedCard
            ? " Your card is already in our warehouse, so there's nothing else you need to do until it sells."
            : " When a buyer matches your price, you'll be notified to ship your card to our warehouse."}
        </p>
        <div className="mt-6 rounded-xl bg-secondary/50 border border-border/50 p-4 text-left text-sm space-y-2">
          <p className="font-medium">What happens next:</p>
          {isVaultedCard ? (
            <ul className="space-y-1.5 text-muted-foreground">
              <li>1. A buyer matches your order</li>
              <li>2. Payment is released to you</li>
            </ul>
          ) : (
            <ul className="space-y-1.5 text-muted-foreground">
              <li>1. A buyer matches your order</li>
              <li>2. You ship your card within 3 business days</li>
              <li>3. Our team verifies the card</li>
              <li>4. Payment is released to you</li>
            </ul>
          )}
        </div>
        <div className="flex gap-3 justify-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/orders">View My Trades</Link>
          </Button>
          <Button asChild>
            <Link href="/sell">Sell Another Card</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/cards"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to browse
        </Link>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">
          Sell a Card
        </h1>
        <p className="text-muted-foreground mt-1">
          List your PSA-graded card on the marketplace.
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              disabled={i > step}
              className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                i < step
                  ? "bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span
              className={`text-xs font-medium hidden sm:block ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  i < step ? "bg-green-500/30" : "bg-border/40"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Find Your Card */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by card name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-11 h-12 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 text-base"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {searchResults.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleSelectCard(card)}
                  className="text-left rounded-xl border border-border/50 bg-card/50 overflow-hidden transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="aspect-[2.5/3.5] relative bg-secondary/30">
                    {card.imageUrl ? (
                      <Image
                        src={card.imageUrl}
                        alt={card.name}
                        fill
                        className="object-contain"
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate">{card.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {card.set.name}
                    </p>
                    {card.marketPrice && (
                      <p className="text-xs font-semibold text-primary mt-1 font-[family-name:var(--font-mono)]">
                        {formatPrice(card.marketPrice)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery && !searching ? (
            <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
              <p className="text-muted-foreground text-sm">
                No cards found for &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : !searchQuery ? (
            <div className="rounded-xl border border-border/50 bg-card/50 p-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Start typing to search for a card to sell
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Step 2: Card Details */}
      {step === 1 && selectedCard && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-6">
                {/* Card image */}
                <div className="w-32 shrink-0">
                  <div className="aspect-[2.5/3.5] relative bg-secondary/30 rounded-lg overflow-hidden">
                    {selectedCard.imageUrl ? (
                      <Image
                        src={selectedCard.imageUrl}
                        alt={selectedCard.name}
                        fill
                        className="object-contain"
                        unoptimized
                        sizes="128px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </div>
                {/* Card info */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                      {selectedCard.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCard.set.game.name} &middot; {selectedCard.set.name}
                      {selectedCard.number && ` #${selectedCard.number}`}
                    </p>
                  </div>
                  {selectedCard.rarity && (
                    <Badge variant="secondary" className="text-xs">{selectedCard.rarity}</Badge>
                  )}
                  {selectedCard.marketPrice && (
                    <p className="text-sm text-muted-foreground">
                      Market price:{" "}
                      <span className="font-semibold text-foreground font-[family-name:var(--font-mono)]">
                        {formatPrice(selectedCard.marketPrice)}
                      </span>
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => { setStep(0); setSelectedCard(null); }}
                  >
                    Change card
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold font-[family-name:var(--font-display)] mb-1">
                  Grading Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  PSA 10 only at launch
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Grading Company</label>
                  <div className="flex h-10 w-full items-center rounded-xl border border-border/60 bg-secondary/50 px-3 text-sm font-medium">
                    PSA
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Grade</label>
                  <div className="flex h-10 w-full items-center rounded-xl border border-border/60 bg-secondary/50 px-3 text-sm font-medium font-[family-name:var(--font-mono)]">
                    10
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  PSA Certificate Number
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 44589233"
                  value={certNumber}
                  onChange={(e) => {
                    setCertNumber(e.target.value.replace(/\D/g, ""));
                    setCertError(null);
                  }}
                  className={`h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)] ${
                    certError ? "border-destructive" : ""
                  }`}
                />
                {certError && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {certError}
                  </p>
                )}
              </div>

              {/* PSA Scan Preview */}
              {certNumber.length >= 5 && (
                <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">PSA Scan Preview</p>
                    <a
                      href={`https://www.psacard.com/cert/${certNumber.trim()}/psa`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View on PSA <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Verify this cert matches your card before continuing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)} className="gap-1.5 rounded-xl">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button onClick={handleStep2Next} className="gap-1.5 rounded-xl">
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Set Your Price */}
      {step === 2 && selectedCard && (
        <div className="space-y-6">
          {/* Order book context */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold font-[family-name:var(--font-display)] mb-4">
                Market Context
              </h3>
              {loadingOrderBook ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading order book...
                </div>
              ) : orderBook ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Best Bid</p>
                    <p className="text-lg font-bold font-[family-name:var(--font-mono)] text-green-400">
                      {orderBook.bids.length > 0 ? formatPrice(orderBook.bids[0].price) : "---"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Best Ask</p>
                    <p className="text-lg font-bold font-[family-name:var(--font-mono)] text-red-400">
                      {orderBook.asks.length > 0 ? formatPrice(orderBook.asks[0].price) : "---"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Trade</p>
                    <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                      {orderBook.lastTradePrice ? formatPrice(orderBook.lastTradePrice) : "---"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Spread</p>
                    <p className="text-lg font-bold font-[family-name:var(--font-mono)]">
                      {orderBook.spread !== null ? formatPrice(orderBook.spread) : "---"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No order book data available.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold font-[family-name:var(--font-display)]">
                Order Type
              </h3>

              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary/50">
                <button
                  onClick={() => setOrderType("LIMIT")}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    orderType === "LIMIT"
                      ? "bg-accent text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Limit Order
                </button>
                <button
                  onClick={() => setOrderType("MARKET")}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    orderType === "MARKET"
                      ? "bg-accent text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Market Order
                </button>
              </div>

              {orderType === "LIMIT" ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Your Ask Price (USD)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="h-12 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)] text-lg"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Your card will be listed at this price until matched or cancelled.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/30 border border-border/50 p-4">
                  <p className="text-sm">
                    Your card will sell at the best available buy price.
                  </p>
                  {orderBook && orderBook.bids.length > 0 ? (
                    <p className="text-sm mt-1 text-muted-foreground">
                      Best bid:{" "}
                      <span className="font-semibold text-green-400 font-[family-name:var(--font-mono)]">
                        {formatPrice(orderBook.bids[0].price)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      No active buy orders. Your market order will be cancelled.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-secondary/30 px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Platform fee: $0 (beta)
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5 rounded-xl">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              onClick={handleStep3Next}
              disabled={orderType === "LIMIT" && (!price || parseFloat(price) <= 0)}
              className="gap-1.5 rounded-xl"
            >
              Review Order <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Confirm */}
      {step === 3 && selectedCard && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold font-[family-name:var(--font-display)] mb-4">
                Order Summary
              </h3>
              <div className="flex gap-6">
                <div className="w-24 shrink-0">
                  <div className="aspect-[2.5/3.5] relative bg-secondary/30 rounded-lg overflow-hidden">
                    {selectedCard.imageUrl ? (
                      <Image
                        src={selectedCard.imageUrl}
                        alt={selectedCard.name}
                        fill
                        className="object-contain"
                        unoptimized
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-base">{selectedCard.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {selectedCard.set.game.name} &middot; {selectedCard.set.name}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Cert #</p>
                      <p className="font-[family-name:var(--font-mono)]">{certNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Grade</p>
                      <p>PSA 10</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Order Type</p>
                      <p>{orderType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-[family-name:var(--font-mono)] font-semibold">
                        {orderType === "LIMIT"
                          ? `$${parseFloat(price).toFixed(2)}`
                          : "Market"}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Platform fee: $0 (beta)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What happens next */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold font-[family-name:var(--font-display)] mb-3">
                What happens next
              </h3>
              {isVaultedCard ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Your card is already verified and held in our warehouse.
                    {orderType === "MARKET" && orderBook && orderBook.bids.length > 0
                      ? " It will match the best available buyer immediately. "
                      : " When a buyer matches your price, "}
                    payment will be released to you — no shipping required.
                  </p>
                </div>
              ) : orderType === "MARKET" && orderBook && orderBook.bids.length > 0 ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Your card will match the best available buyer immediately.
                    Ship your card to our warehouse within <strong className="text-foreground">3 business days</strong>.
                    The buyer&apos;s payment is held in escrow until we verify your card.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Your sell order will be posted on the order book. When a buyer matches your price,
                    you&apos;ll be notified to ship your card to our warehouse within{" "}
                    <strong className="text-foreground">3 business days</strong>.
                  </p>
                </div>
              )}
              {!isVaultedCard && (
                <Link
                  href="/shipping-instructions"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
                >
                  View shipping instructions <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </CardContent>
          </Card>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5 rounded-xl">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Confirm Sell Order</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
