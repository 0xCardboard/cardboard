"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await register(email, password, name || undefined);
      router.push("/cards");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-8 glass-border">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-lg font-[family-name:var(--font-display)]">C</span>
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Create an account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start trading graded TCG cards today</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
            className="h-11 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="h-11 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={8}
            className="h-11 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50"
          />
          <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
        </div>
        <Button className="w-full h-11 rounded-xl font-semibold" type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
