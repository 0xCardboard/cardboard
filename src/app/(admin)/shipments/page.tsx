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
        <h1 className="text-3xl font-bold mb-6">Shipment Management</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Shipment Management</h1>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "INBOUND" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("INBOUND")}
          >
            Inbound
          </Button>
          <Button
            variant={filter === "OUTBOUND" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("OUTBOUND")}
          >
            Outbound
          </Button>
        </div>
      </div>

      {shipments.length === 0 ? (
        <p className="text-muted-foreground">No shipments found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={s.id}>
                <TableCell>
                  <Badge variant={s.direction === "INBOUND" ? "secondary" : "default"}>
                    {s.direction}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {s.cardInstance.card.name}
                </TableCell>
                <TableCell className="font-mono">{s.cardInstance.certNumber}</TableCell>
                <TableCell>
                  {s.trackingNumber ? (
                    <span className="font-mono text-sm">
                      {s.trackingNumber} ({s.carrier})
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[s.status] ?? "outline"}>
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell>{s.user.name ?? s.user.email}</TableCell>
                <TableCell>
                  <Select
                    value={s.status}
                    onValueChange={(val) => updateStatus(s.id, val)}
                  >
                    <SelectTrigger className="w-[150px]">
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
      )}
    </div>
  );
}
