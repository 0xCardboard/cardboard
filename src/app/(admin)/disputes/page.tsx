"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Loader2 } from "lucide-react";

interface DisputeItem {
  id: string;
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  trade: { id: string; price: number; quantity: number };
  user: { id: string; name: string | null; email: string };
  resolvedBy: { name: string } | null;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "destructive",
  UNDER_REVIEW: "secondary",
  RESOLVED_REFUND: "default",
  RESOLVED_REPLACEMENT: "default",
  RESOLVED_REJECTED: "outline",
  CLOSED: "outline",
};

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/disputes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setDisputes(json.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  async function handleResolve(disputeId: string, resolution: string) {
    const token = getAccessToken();
    if (!token) return;
    setResolving(disputeId);
    try {
      await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resolution,
          adminNotes: `Resolved as ${resolution} by admin`,
        }),
      });
      await fetchDisputes();
    } catch {
      // ignore
    } finally {
      setResolving(null);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">Dispute Resolution</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">Dispute Resolution</h1>

      {disputes.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">No disputes found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Filed By</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((d) => (
                <TableRow key={d.id} className="border-border/30 hover:bg-accent/30">
                  <TableCell>
                    <Badge variant={STATUS_COLORS[d.status] ?? "outline"} className="text-xs">
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.reason}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {d.description}
                  </TableCell>
                  <TableCell className="font-[family-name:var(--font-mono)] text-sm">
                    ${(d.trade.price / 100).toFixed(2)} x{d.trade.quantity}
                  </TableCell>
                  <TableCell className="text-sm">{d.user.name ?? d.user.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {(d.status === "OPEN" || d.status === "UNDER_REVIEW") && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 text-xs rounded-lg"
                          onClick={() => handleResolve(d.id, "RESOLVED_REFUND")}
                          disabled={resolving === d.id}
                        >
                          {resolving === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refund"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs rounded-lg"
                          onClick={() => handleResolve(d.id, "RESOLVED_REJECTED")}
                          disabled={resolving === d.id}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
