"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CardPaginationProps {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function CardPagination({ pagination }: CardPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`/cards?${params.toString()}`);
    },
    [router, searchParams]
  );

  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-8">
      <p className="text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg gap-1"
          disabled={pagination.page <= 1}
          onClick={() => navigateToPage(pagination.page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg gap-1"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => navigateToPage(pagination.page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
