"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { getAccessToken } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Grab,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  Package,
  Zap,
} from "lucide-react";
import type { CertLookupResult } from "@/services/verification.service";

// ─── Types ──────────────────────────────────────────────

interface VerificationItem {
  id: string;
  certNumber: string;
  grade: number;
  gradingCompany: string;
  psaScanUrl: string | null;
  certLookupData: CertLookupResult | null;
  verificationNotes: string | null;
  updatedAt: string;
  card: {
    id: string;
    name: string;
    number: string | null;
    imageUrl: string | null;
    imageUrlHiRes: string | null;
    set: { name: string; game: { name: string } };
  };
  owner: { id: string; name: string | null; email: string };
  claimedBy: { id: string; name: string | null } | null;
  orders: Array<{
    sellTrades: Array<{
      id: string;
      buyerId: string;
      price: number;
      escrowStatus: string;
    }>;
  }>;
}

type FilterTab = "unclaimed" | "my_claims" | "all";

const REJECT_REASONS = [
  "Cert mismatch",
  "Suspected counterfeit",
  "Damaged encasement",
  "Grade discrepancy",
  "Other",
] as const;

// ─── Main Page ──────────────────────────────────────────

export default function VerificationPage() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("unclaimed");
  const [certSearch, setCertSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<VerificationItem | null>(null);

  const fetchQueue = useCallback(
    async (tab?: FilterTab, search?: string) => {
      const token = getAccessToken();
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("filter", tab ?? activeTab);
        if (search ?? certSearch) params.set("certNumber", search ?? certSearch);
        const res = await fetch(`/api/admin/verification?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setItems(json.data ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [activeTab, certSearch],
  );

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    fetchQueue(tab, certSearch);
  }

  function handleSearch(value: string) {
    setCertSearch(value);
    fetchQueue(activeTab, value);
  }

  if (selectedItem) {
    return (
      <VerificationPanel
        item={selectedItem}
        onBack={() => {
          setSelectedItem(null);
          fetchQueue();
        }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 font-[family-name:var(--font-display)]">
        Card Verification Queue
      </h1>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-1 rounded-lg border border-border/50 bg-card/50 p-1">
          {(["unclaimed", "my_claims", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "unclaimed" ? "Unclaimed" : tab === "my_claims" ? "My Claims" : "All Pending"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by cert number..."
            value={certSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-card/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Queue Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading queue...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">
            {activeTab === "my_claims"
              ? "You have no claimed cards."
              : "No cards pending verification."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Card</TableHead>
                <TableHead>Set</TableHead>
                <TableHead>Cert #</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onClaim={async () => {
                    const token = getAccessToken();
                    if (!token) return;
                    await fetch(`/api/admin/verification/${item.id}/claim`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    fetchQueue();
                  }}
                  onOpenPanel={() => setSelectedItem(item)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Queue Row ──────────────────────────────────────────

function QueueRow({
  item,
  onClaim,
  onOpenPanel,
}: {
  item: VerificationItem;
  onClaim: () => void;
  onOpenPanel: () => void;
}) {
  const [claiming, setClaiming] = useState(false);
  const hasTrade = item.orders.some((o) => o.sellTrades.length > 0);

  return (
    <TableRow className="border-border/30 hover:bg-accent/30">
      <TableCell className="font-medium">{item.card.name}</TableCell>
      <TableCell>
        <span className="text-muted-foreground text-sm">
          {item.card.set.game.name} &middot; {item.card.set.name}
        </span>
      </TableCell>
      <TableCell className="font-[family-name:var(--font-mono)] text-sm">{item.certNumber}</TableCell>
      <TableCell className="font-semibold">{item.grade}</TableCell>
      <TableCell className="text-sm">{item.owner.name ?? item.owner.email}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {item.claimedBy ? (
            <Badge variant="secondary" className="text-xs">
              Claimed by {item.claimedBy.name ?? "Admin"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Unclaimed</Badge>
          )}
          {hasTrade && (
            <Badge className="text-xs bg-amber-500/15 text-amber-500 border-amber-500/30">
              Trade pending
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {item.claimedBy ? (
          <Button
            size="sm"
            className="h-7 text-xs rounded-lg gap-1"
            onClick={onOpenPanel}
          >
            Open
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg gap-1"
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              await onClaim();
              setClaiming(false);
            }}
          >
            {claiming ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Grab className="h-3 w-3" />
                Claim
              </>
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Verification Panel ─────────────────────────────────

function VerificationPanel({
  item,
  onBack,
}: {
  item: VerificationItem;
  onBack: () => void;
}) {
  const [certResult, setCertResult] = useState<CertLookupResult | null>(
    item.certLookupData,
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const [notes, setNotes] = useState(item.verificationNotes ?? "");
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const hasPendingTrade = item.orders.some((o) =>
    o.sellTrades.some((t) => t.escrowStatus === "CAPTURED"),
  );
  const tradePrice = item.orders
    .flatMap((o) => o.sellTrades)
    .find((t) => t.escrowStatus === "CAPTURED")?.price;

  const psaScanUrl = item.psaScanUrl ?? `https://www.psacard.com/cert/${item.certNumber}/psa`;
  const cardImageUrl = item.card.imageUrlHiRes ?? item.card.imageUrl;

  // Auto-highlight mismatches between submitted data and cert lookup
  const mismatches: string[] = [];
  if (certResult?.valid) {
    if (certResult.grade !== undefined && certResult.grade !== item.grade) {
      mismatches.push(`Grade: submitted ${item.grade}, PSA says ${certResult.grade}`);
    }
    if (
      certResult.cardName &&
      !certResult.cardName.toLowerCase().includes(item.card.name.toLowerCase()) &&
      !item.card.name.toLowerCase().includes(certResult.cardName.toLowerCase())
    ) {
      mismatches.push(`Name: submitted "${item.card.name}", PSA says "${certResult.cardName}"`);
    }
  }

  async function runCertLookup() {
    const token = getAccessToken();
    if (!token) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/admin/verification/${item.id}/cert-lookup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certNumber: item.certNumber,
          gradingCompany: item.gradingCompany,
        }),
      });
      const json = await res.json();
      setCertResult(json.certResult ?? null);
    } catch {
      // ignore
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleDecision(approved: boolean) {
    const token = getAccessToken();
    if (!token) return;
    setActionLoading(true);
    try {
      // Claim first if not already claimed
      if (!item.claimedBy) {
        await fetch(`/api/admin/verification/${item.id}/claim`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const finalRejectReason =
        rejectReason === "Other" ? customReason : rejectReason;

      await fetch(`/api/admin/verification/${item.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved,
          notes: notes || undefined,
          rejectReason: approved ? undefined : finalRejectReason,
        }),
      });
      onBack();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnclaim() {
    const token = getAccessToken();
    if (!token) return;
    await fetch(`/api/admin/verification/${item.id}/claim`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onBack();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to queue
        </button>
      </div>

      {/* Context Banner */}
      {hasPendingTrade ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6">
          <Zap className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Trade pending — buyer&apos;s funds in escrow</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Approving will release{" "}
              {tradePrice ? `$${(tradePrice / 100).toFixed(2)}` : "funds"} to the
              seller.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 mb-6">
          <Package className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Pre-trade vault deposit</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Approving will add this card to {item.owner.name ?? item.owner.email}&apos;s
              portfolio.
            </p>
          </div>
        </div>
      )}

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Card Catalog Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Card Info
          </h2>
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            {cardImageUrl && (
              <div className="relative aspect-[2.5/3.5] w-full bg-secondary/30">
                <Image
                  src={cardImageUrl}
                  alt={item.card.name}
                  fill
                  className="object-contain"
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 300px"
                />
              </div>
            )}
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                {item.card.set.game.name} &middot; {item.card.set.name}
              </p>
              <p className="font-semibold">{item.card.name}</p>
              {item.card.number && (
                <p className="text-sm text-muted-foreground font-[family-name:var(--font-mono)]">
                  #{item.card.number}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Badge variant="outline" className="text-xs">
                  {item.gradingCompany}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Grade {item.grade}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Cert: <span className="font-[family-name:var(--font-mono)]">{item.certNumber}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Owner: {item.owner.name ?? item.owner.email}
              </p>
            </div>
          </div>
        </div>

        {/* Center: PSA Scan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              PSA Scan
            </h2>
            <a
              href={psaScanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open on PSA
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            <iframe
              src={psaScanUrl}
              title="PSA Cert Scan"
              className="w-full h-[600px] border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>

        {/* Right: Verification Controls */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Verification
          </h2>

          {/* Cert Lookup */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Cert Lookup</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg gap-1"
                disabled={lookupLoading}
                onClick={runCertLookup}
              >
                {lookupLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Search className="h-3 w-3" />
                    Run Lookup
                  </>
                )}
              </Button>
            </div>

            {certResult && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {certResult.valid ? (
                    <Badge className="text-xs bg-green-500/15 text-green-500 border-green-500/30">
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      Invalid
                    </Badge>
                  )}
                </div>
                {certResult.cardName && (
                  <p className="text-muted-foreground">
                    Name: <span className="text-foreground">{certResult.cardName}</span>
                  </p>
                )}
                {certResult.grade !== undefined && (
                  <p className="text-muted-foreground">
                    Grade: <span className="text-foreground">{certResult.grade}</span>
                  </p>
                )}
                {certResult.year && (
                  <p className="text-muted-foreground">
                    Year: <span className="text-foreground">{certResult.year}</span>
                  </p>
                )}
                {certResult.details && (
                  <p className="text-xs text-muted-foreground">{certResult.details}</p>
                )}
              </div>
            )}

            {/* Mismatch Warnings */}
            {mismatches.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Mismatches Detected
                </div>
                {mismatches.map((m, i) => (
                  <p key={i} className="text-xs text-red-400">
                    {m}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything notable about this card..."
              rows={3}
              className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Reject Form (shown on click) */}
          {showRejectForm && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <p className="text-sm font-medium text-red-400">Rejection Reason</p>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {rejectReason === "Other" && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Specify reason..."
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs rounded-lg gap-1 flex-1"
                  disabled={actionLoading || (rejectReason === "Other" && !customReason)}
                  onClick={() => handleDecision(false)}
                >
                  {actionLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Confirm Reject
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs rounded-lg"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              className="w-full h-10 rounded-lg gap-2 bg-green-600 hover:bg-green-700 text-white"
              disabled={actionLoading}
              onClick={() => handleDecision(true)}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {hasPendingTrade ? "Verify & Release Escrow" : "Verify & Vault"}
                </>
              )}
            </Button>
            {!showRejectForm && (
              <Button
                variant="destructive"
                className="w-full h-10 rounded-lg gap-2"
                disabled={actionLoading}
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            )}
            <button
              onClick={handleUnclaim}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Unclaim — release back to queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
