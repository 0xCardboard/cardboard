"use client";

import { useState } from "react";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const { user, status } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  // Only show for authenticated, unverified users
  if (status !== "authenticated" || !user || user.emailVerified !== false) {
    return null;
  }

  async function handleResend() {
    setSending(true);
    setMessage("");

    try {
      const token = getAccessToken();
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send verification email");
      }

      setMessage("Verification email sent! Check your inbox.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Verify your email to start trading.</strong>
            {message && (
              <span className="ml-2 text-amber-300">{message}</span>
            )}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResend}
          disabled={sending}
          className="shrink-0 border-amber-500/30 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Resend email
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
