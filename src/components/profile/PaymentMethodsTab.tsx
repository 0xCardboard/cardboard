"use client";

import { useEffect, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getAccessToken } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, Star, Loader2, AlertCircle } from "lucide-react";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface PaymentMethod {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Not authenticated");

      // Create SetupIntent
      const setupRes = await fetch("/api/payments/setup-intent", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!setupRes.ok) throw new Error("Failed to create setup intent");
      const { data: setupData } = await setupRes.json();

      // Confirm the SetupIntent with card details
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        setupData.clientSecret,
        {
          payment_method: { card: cardElement },
        },
      );

      if (stripeError) {
        throw new Error(stripeError.message || "Card setup failed");
      }

      if (!setupIntent?.payment_method) {
        throw new Error("No payment method returned");
      }

      // Save to our backend
      const saveRes = await fetch("/api/payments/methods", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stripePaymentMethodId:
            typeof setupIntent.payment_method === "string"
              ? setupIntent.payment_method
              : setupIntent.payment_method.id,
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save payment method");

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border/50 bg-card/50 p-6">
      <h3 className="text-base font-semibold font-[family-name:var(--font-display)] mb-4">
        Add Payment Method
      </h3>

      <div className="rounded-lg border border-border bg-background p-4 mb-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#e2e8f0",
                "::placeholder": { color: "#64748b" },
              },
              invalid: { color: "#ef4444" },
            },
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !stripe}>
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              Adding...
            </>
          ) : (
            "Add Card"
          )}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const brandNames: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function PaymentMethodsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/payments/methods", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const { data } = await res.json();
        setMethods(data);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  async function handleRemove(id: string) {
    const token = getAccessToken();
    if (!token) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/payments/methods/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchMethods();
      }
    } catch {
      // Silently handle errors
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSetDefault(id: string) {
    const token = getAccessToken();
    if (!token) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/payments/methods/${id}/default`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchMethods();
      }
    } catch {
      // Silently handle errors
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment methods...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Payment Methods
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your cards for buying on the marketplace.
          </p>
        </div>
        {!showAddForm && (
          <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add Card
          </Button>
        )}
      </div>

      {showAddForm && (
        stripePromise ? (
          <Elements stripe={stripePromise}>
            <AddCardForm
              onSuccess={() => {
                setShowAddForm(false);
                fetchMethods();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </Elements>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6">
            <div className="flex items-center gap-2 text-sm text-yellow-400 mb-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Stripe is not configured
            </div>
            <p className="text-sm text-muted-foreground">
              Payment methods require the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> environment variable to be set.
            </p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAddForm(false)}>
              Close
            </Button>
          </div>
        )
      )}

      {methods.length === 0 && !showAddForm ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold font-[family-name:var(--font-display)]">
            No payment methods
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Add a card to start placing buy orders on the marketplace.
          </p>
          <Button size="sm" className="mt-4 gap-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Your First Card
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/50 p-5"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {brandNames[method.brand] || method.brand} ending in {method.last4}
                    </p>
                    {method.isDefault && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Star className="h-3 w-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!method.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(method.id)}
                    disabled={actionLoading === method.id}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {actionLoading === method.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Set Default"
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(method.id)}
                  disabled={actionLoading === method.id}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  {actionLoading === method.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
