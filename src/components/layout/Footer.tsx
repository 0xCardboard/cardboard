import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 py-10 px-4 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center text-sm leading-loose md:text-left">
            <span className="font-semibold">Cardboard</span> — P2P TCG Card Marketplace
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <Link href="/cards" className="hover:underline">Browse</Link>
          <Link href="/login" className="hover:underline">Sign In</Link>
        </div>
      </div>
    </footer>
  );
}
