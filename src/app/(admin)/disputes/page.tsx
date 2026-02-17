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

  async function handleResolve(
    disputeId: string,
    resolution: string,
  ) {
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
        <h1 className="text-3xl font-bold mb-6">Dispute Resolution</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dispute Resolution</h1>

      {disputes.length === 0 ? (
        <p className="text-muted-foreground">No disputes found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={d.id}>
                <TableCell>
                  <Badge variant={STATUS_COLORS[d.status] ?? "outline"}>
                    {d.status}
                  </Badge>
                </TableCell>
                <TableCell>{d.reason}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {d.description}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  ${(d.trade.price / 100).toFixed(2)} x{d.trade.quantity}
                </TableCell>
                <TableCell>{d.user.name ?? d.user.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(d.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {(d.status === "OPEN" || d.status === "UNDER_REVIEW") && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleResolve(d.id, "RESOLVED_REFUND")}
                        disabled={resolving === d.id}
                      >
                        Refund
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
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
      )}
    </div>
  );
}
