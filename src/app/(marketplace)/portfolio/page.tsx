"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAccessToken, useAuth } from "@/components/providers/AuthProvider";
import { formatPrice, formatNumber } from "@/lib/format";
import {
  Wallet,
  Loader2,
  Package,
  ShieldCheck,
  Tag,
  Truck,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Eye,
} from "lucide-react";

interface PortfolioInstance {
  id: string;
  certNumber: string;
  grade: number;
  gradingCompany: string;
  status: string;
  imageUrls: string[];
  verifiedAt: string | null;
  createdAt: string;
  card: {
    id: string;
    name: string;
    imageUrl: string | null;
    marketPrice: number | null;
    set: {
      id: string;
      name: string;
      game: { id: string; name: string };
    };
  };
}

interface PortfolioSummary {
  totalCards: number;
  totalEstimatedValue: number;
  cardsByStatus: Record<string, number>;
  cardsByGame: { gameId: string; gameName: string; count: number }[];
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_TABS = [
  { label: "All", value: "", icon: Wallet },
  { label: "Verified", value: "VERIFIED", icon: ShieldCheck },
  { label: "Listed", value: "LISTED", icon: Tag },
  { label: "In Transit", value: "IN_TRANSIT", icon: Truck },
  { label: "Pending", value: "PENDING_VERIFICATION", icon: Clock },
  { label: "Redeemed", value: "REDEEMED", icon: Package },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case "VERIFIED":
      return "default" as const;
    case "LISTED":
      return "secondary" as const;
    case "IN_TRANSIT":
    case "PENDING_SHIPMENT":
    case "PENDING_VERIFICATION":
      return "outline" as const;
    case "REDEEMED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function PortfolioPage() {
  const { status: authStatus } = useAuth();
  const [instances, setInstances] = useState<PortfolioInstance[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchPortfolio = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/portfolio?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setInstances(json.data);
        setSummary(json.summary);
        setPagination(json.pagination);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchPortfolio();
    } else if (authStatus === "unauthenticated") {
      setLoading(false);
    }
  }, [fetchPortfolio, authStatus]);

  if (authStatus === "loading" || (loading && !summary)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">
          My Portfolio
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading portfolio...
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-2xl border border-border/50 bg-card/50 p-16 text-center">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Sign in to view your portfolio
          </h2>
          <p className="text-muted-foreground mt-2">
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>{" "}
            or{" "}
            <Link href="/register" className="text-primary hover:underline">
              create an account
            </Link>{" "}
            to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">
          My Portfolio
        </h1>
        <p className="text-muted-foreground mt-1">
          Your card holdings and their current status.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">Total Cards</div>
              <div className="text-2xl font-bold font-[family-name:var(--font-display)] mt-1">
                {formatNumber(summary.totalCards)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">
                Estimated Value
              </div>
              <div className="text-2xl font-bold font-[family-name:var(--font-mono)] mt-1">
                {formatPrice(summary.totalEstimatedValue)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">Verified</div>
              <div className="text-2xl font-bold font-[family-name:var(--font-display)] mt-1">
                {formatNumber(summary.cardsByStatus["VERIFIED"] ?? 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">Games</div>
              <div className="text-2xl font-bold font-[family-name:var(--font-display)] mt-1">
                {summary.cardsByGame.length}
              </div>
              {summary.cardsByGame.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {summary.cardsByGame.map((g) => g.gameName).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.value === ""
              ? summary?.totalCards ?? 0
              : summary?.cardsByStatus[tab.value] ?? 0;
          return (
            <Button
              key={tab.label}
              variant={statusFilter === tab.value ? "default" : "outline"}
              size="sm"
              className="rounded-lg gap-1.5"
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span className="ml-0.5 text-xs opacity-70">{count}</span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Card Grid */}
      {instances.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-16 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Wallet className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            {statusFilter ? "No cards with this status" : "No cards yet"}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            {statusFilter ? (
              "Try selecting a different status filter."
            ) : (
              "Browse the marketplace or deposit your first card into the vault."
            )}
          </p>
          {!statusFilter && (
            <div className="flex gap-3 justify-center mt-4">
              <Button variant="outline" asChild>
                <Link href="/cards">Browse Cards</Link>
              </Button>
              <Button asChild>
                <Link href="/sell">Sell a Card</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/vault">Vault a Card</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {instances.map((instance) => (
              <Card key={instance.id} className="overflow-hidden transition-colors hover:border-primary/40 group">
                {/* Card Image */}
                <Link href={`/cards/${instance.card.id}`}>
                  <div className="aspect-[3/4] relative bg-muted/30">
                    {instance.card.imageUrl ? (
                      <Image
                        src={instance.card.imageUrl}
                        alt={instance.card.name}
                        fill
                        className="object-contain p-2"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={statusBadgeVariant(instance.status)}
                        className="text-[10px] uppercase tracking-wider"
                      >
                        {statusLabel(instance.status)}
                      </Badge>
                    </div>
                  </div>
                </Link>

                <CardContent className="p-4">
                  <Link href={`/cards/${instance.card.id}`}>
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                      {instance.card.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {instance.card.set.name} &middot;{" "}
                    {instance.card.set.game.name}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {instance.gradingCompany} {instance.grade}
                      </Badge>
                    </div>
                    <span className="text-sm font-[family-name:var(--font-mono)]">
                      {formatPrice(instance.card.marketPrice)}
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-foreground mt-2 font-mono truncate">
                    Cert #{instance.certNumber}
                  </div>

                  {/* Status-specific actions */}
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/40">
                    {instance.status === "VERIFIED" && (
                      <Button variant="default" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                        <Link href={`/sell?cardId=${instance.card.id}&certNumber=${instance.certNumber}`}>
                          <DollarSign className="h-3 w-3" />
                          List for Sale
                        </Link>
                      </Button>
                    )}
                    {instance.status === "LISTED" && (
                      <Button variant="secondary" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                        <Link href={`/orders?cardId=${instance.card.id}&side=SELL`}>
                          <Eye className="h-3 w-3" />
                          View Order
                        </Link>
                      </Button>
                    )}
                    {instance.status === "PENDING_SHIPMENT" && (
                      <Button variant="secondary" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                        <Link href="/shipping-instructions">
                          <Truck className="h-3 w-3" />
                          Shipping Info
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" asChild>
                      <Link href={`/cards/${instance.card.id}`}>
                        <ExternalLink className="h-3 w-3" />
                        Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.total} cards)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
