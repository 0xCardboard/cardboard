import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="text-xl font-bold">Cardboard</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-6 text-sm font-medium">
          <Link href="/cards" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Browse
          </Link>
          <Link href="/orders" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Orders
          </Link>
          <Link href="/portfolio" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Portfolio
          </Link>
        </nav>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
