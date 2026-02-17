import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/40">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-xs font-[family-name:var(--font-display)]">C</span>
              </div>
              <span className="text-base font-bold tracking-tight font-[family-name:var(--font-display)]">
                Cardboard
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
              The peer-to-peer exchange for authenticated, graded trading cards.
              Trade with confidence at the lowest fees in the market.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold mb-3 font-[family-name:var(--font-display)]">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/cards" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Browse Cards
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold mb-3 font-[family-name:var(--font-display)]">Company</h4>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">
                  Terms of Service
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Support
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Cardboard. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Pokemon is a trademark of Nintendo/Game Freak</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
