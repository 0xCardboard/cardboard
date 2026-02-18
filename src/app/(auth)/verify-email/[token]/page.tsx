"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Verification failed");
        }

        setStatus("success");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Verification failed");
        setStatus("error");
      }
    }

    verify();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/80 p-8 glass-border">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Verifying email...</h1>
          <p className="text-sm text-muted-foreground mt-1">Please wait while we verify your email address.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/80 p-8 glass-border">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Verification failed</h1>
          <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
          <p className="text-sm text-muted-foreground mt-1">
            The link may have expired. Try requesting a new verification email from your account.
          </p>
          <Link
            href="/cards"
            className="inline-flex items-center gap-2 mt-6 text-sm text-primary hover:underline font-medium"
          >
            Go to Cardboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-8 glass-border">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Email verified!</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your email has been verified. You can now place orders and start trading.
        </p>
        <Link
          href="/cards"
          className="inline-flex items-center gap-2 mt-6 text-sm text-primary hover:underline font-medium"
        >
          Start trading
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
