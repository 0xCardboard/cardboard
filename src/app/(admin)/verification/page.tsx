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
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

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
        <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">Card Verification Queue</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">Card Verification Queue</h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">No cards pending verification.</p>
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
                <TableHead>Grading</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-border/30 hover:bg-accent/30">
                  <TableCell className="font-medium">{item.card.name}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {item.card.set.game.name} &gt; {item.card.set.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-[family-name:var(--font-mono)] text-sm">
                    {item.certNumber}
                  </TableCell>
                  <TableCell className="font-semibold">{item.grade}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{item.gradingCompany}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{item.owner.name ?? item.owner.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs rounded-lg gap-1"
                        onClick={() => handleVerify(item.id, true)}
                        disabled={actionLoading === item.id}
                      >
                        {actionLoading === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs rounded-lg gap-1"
                        onClick={() => handleVerify(item.id, false)}
                        disabled={actionLoading === item.id}
                      >
                        <XCircle className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
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
