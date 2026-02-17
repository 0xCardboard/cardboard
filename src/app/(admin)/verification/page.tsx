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

interface VerificationItem {
  id: string;
  certNumber: string;
  grade: number;
  gradingCompany: string;
  card: {
    id: string;
    name: string;
    imageUrl: string | null;
    set: { name: string; game: { name: string } };
  };
  owner: { name: string | null; email: string };
}

export default function VerificationPage() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/verification", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleVerify(cardInstanceId: string, passed: boolean) {
    const token = getAccessToken();
    if (!token) return;
    setActionLoading(cardInstanceId);
    try {
      await fetch(`/api/admin/verification/${cardInstanceId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passed }),
      });
      await fetchQueue();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Card Verification Queue</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Card Verification Queue</h1>

      {items.length === 0 ? (
        <p className="text-muted-foreground">No cards pending verification.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead>Set</TableHead>
              <TableHead>Cert #</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Grading</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.card.name}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {item.card.set.game.name} &gt; {item.card.set.name}
                  </span>
                </TableCell>
                <TableCell className="font-mono">{item.certNumber}</TableCell>
                <TableCell>{item.grade}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.gradingCompany}</Badge>
                </TableCell>
                <TableCell>{item.owner.name ?? item.owner.email}</TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    onClick={() => handleVerify(item.id, true)}
                    disabled={actionLoading === item.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleVerify(item.id, false)}
                    disabled={actionLoading === item.id}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
