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
  Vault,
  Copy,
  CheckCircle2,
} from "lucide-react";

interface CatalogCard {
  id: string;
  name: string;
  imageUrl: string | null;
  number: string | null;
  rarity: string | null;
  marketPrice: number | null;
  set: { id: string; name: string; game: { id: string; name: string } };
}

const STEPS = ["Find Your Card", "Card Details", "Confirm & Ship"];

const WAREHOUSE_ADDRESS = {
  line1: "Cardboard Warehouse",
  line2: "Attn: Card Verification",
  line3: "123 Trading Card Lane, Suite 100",
  line4: "Austin, TX 78701",
};

export default function VaultPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      }
    >
      <VaultPageContent />
    </Suspense>
  );
}

function VaultPageContent() {
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

  // Step 3: Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pre-populate from query params (e.g., from portfolio)
  useEffect(() => {
    const cardId = searchParams.get("cardId");
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

  async function handleSubmit() {
    const token = getAccessToken();
    if (!token || !selectedCard) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/card-instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cardId: selectedCard.id,
          certNumber: certNumber.trim(),
          gradingCompany: "PSA",
          grade: 10,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to register card");

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to register card");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyAddress() {
    const address = `${WAREHOUSE_ADDRESS.line1}\n${WAREHOUSE_ADDRESS.line2}\n${WAREHOUSE_ADDRESS.line3}\n${WAREHOUSE_ADDRESS.line4}`;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
          Sign in to vault a card
        </h1>
        <p className="text-muted-foreground mt-2 mb-6">
          You need an account to deposit cards into the vault.
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
          Card Registered!
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Your <strong>{selectedCard?.name}</strong> (Cert #{certNumber}) has been registered.
          Ship it to our warehouse and we&apos;ll verify it.
        </p>

        <div className="mt-6 rounded-xl bg-secondary/50 border border-border/50 p-4 text-left text-sm space-y-1">
          <p className="font-medium">Ship to:</p>
          <p className="text-muted-foreground">{WAREHOUSE_ADDRESS.line1}</p>
          <p className="text-muted-foreground">{WAREHOUSE_ADDRESS.line2}</p>
          <p className="text-muted-foreground">{WAREHOUSE_ADDRESS.line3}</p>
          <p className="text-muted-foreground">{WAREHOUSE_ADDRESS.line4}</p>
          <button
            onClick={handleCopyAddress}
            className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
          >
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy address"}
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-secondary/50 border border-border/50 p-4 text-left text-sm space-y-2">
          <p className="font-medium">What happens next:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>1. Ship your graded card to the address above</li>
            <li>2. Our team receives and verifies it against PSA records</li>
            <li>3. Once verified, it appears in your portfolio as a VERIFIED card</li>
            <li>4. You can then list it for sale, hold it, or redeem it anytime</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/portfolio">My Portfolio</Link>
          </Button>
          <Button
            onClick={() => {
              setSubmitSuccess(false);
              setSelectedCard(null);
              setCertNumber("");
              setStep(0);
              setSearchQuery("");
              setSearchResults([]);
            }}
          >
            Vault Another Card
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
          href="/portfolio"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to portfolio
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Vault className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">
              Vault My Card
            </h1>
            <p className="text-muted-foreground mt-0.5">
              Deposit a PSA-graded card into the Cardboard vault.
            </p>
          </div>
        </div>
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
                Search for the card you want to vault
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
                    <Badge variant="secondary" className="text-xs">
                      {selectedCard.rarity}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      setStep(0);
                      setSelectedCard(null);
                    }}
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
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Grading Company
                  </label>
                  <div className="flex h-10 w-full items-center rounded-xl border border-border/60 bg-secondary/50 px-3 text-sm font-medium">
                    PSA
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Grade
                  </label>
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
                    <p className="text-xs font-medium text-muted-foreground">
                      PSA Scan Preview
                    </p>
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
            <Button
              variant="outline"
              onClick={() => setStep(0)}
              className="gap-1.5 rounded-xl"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button onClick={handleStep2Next} className="gap-1.5 rounded-xl">
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Ship */}
      {step === 2 && selectedCard && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold font-[family-name:var(--font-display)] mb-4">
                Summary
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
                  </div>

                  {/* PSA scan link */}
                  <a
                    href={`https://www.psacard.com/cert/${certNumber.trim()}/psa`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View PSA scan <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What happens */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold font-[family-name:var(--font-display)] mb-3">
                What happens next
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Ship your card to our warehouse. Once we verify it against PSA records,
                  it&apos;ll appear in your portfolio as a <strong className="text-foreground">verified card</strong>.
                  You can then sell it, hold it, or redeem it anytime.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Warehouse address */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold font-[family-name:var(--font-display)]">
                  Ship to
                </h3>
                <button
                  onClick={handleCopyAddress}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied!" : "Copy address"}
                </button>
              </div>
              <div className="rounded-lg bg-secondary/50 border border-border/40 p-3 text-sm text-muted-foreground space-y-0.5">
                <p>{WAREHOUSE_ADDRESS.line1}</p>
                <p>{WAREHOUSE_ADDRESS.line2}</p>
                <p>{WAREHOUSE_ADDRESS.line3}</p>
                <p>{WAREHOUSE_ADDRESS.line4}</p>
              </div>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>Include your username and cert number in the package.</p>
                <Link
                  href="/shipping-instructions"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View full packing guidelines <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-1.5 rounded-xl"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 rounded-xl"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Confirm &amp; Get Shipping Instructions</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
