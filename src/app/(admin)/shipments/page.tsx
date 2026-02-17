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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ShipmentItem {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  trackingNumber: string | null;
  carrier: string | null;
  status: string;
  createdAt: string;
  cardInstance: {
    certNumber: string;
    grade: number;
    gradingCompany: string;
    card: { name: string };
  };
  user: { name: string | null; email: string };
  trade: { id: string; buyerId: string; sellerId: string } | null;
}

const STATUS_OPTIONS = [
  "LABEL_CREATED",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "EXCEPTION",
];

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LABEL_CREATED: "outline",
  SHIPPED: "secondary",
  IN_TRANSIT: "secondary",
  DELIVERED: "default",
  RETURNED: "destructive",
  EXCEPTION: "destructive",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchShipments = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("direction", filter);
      const res = await fetch(`/api/admin/shipments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setShipments(json.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  async function updateStatus(shipmentId: string, status: string) {
    const token = getAccessToken();
    if (!token) return;
    try {
      await fetch(`/api/admin/shipments/${shipmentId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      await fetchShipments();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">Shipment Management</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">Shipment Management</h1>
        <div className="flex gap-2">
          {["all", "INBOUND", "OUTBOUND"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="rounded-lg"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {shipments.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">No shipments found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Direction</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Cert #</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Update Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id} className="border-border/30 hover:bg-accent/30">
                  <TableCell>
                    <Badge variant={s.direction === "INBOUND" ? "secondary" : "default"} className="text-xs">
                      {s.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{s.cardInstance.card.name}</TableCell>
                  <TableCell className="font-[family-name:var(--font-mono)] text-sm">
                    {s.cardInstance.certNumber}
                  </TableCell>
                  <TableCell>
                    {s.trackingNumber ? (
                      <span className="font-[family-name:var(--font-mono)] text-sm">
                        {s.trackingNumber} ({s.carrier})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[s.status] ?? "outline"} className="text-xs">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.user.name ?? s.user.email}</TableCell>
                  <TableCell>
                    <Select value={s.status} onValueChange={(val) => updateStatus(s.id, val)}>
                      <SelectTrigger className="w-[150px] h-8 rounded-lg bg-secondary/50 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
