"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type ListPaginationProps = {
  page: number;
  pageCount: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  className?: string;
  ariaLabel?: string;
};

export function ListPagination({
  page,
  pageCount,
  totalItems,
  itemLabel,
  onPageChange,
  className = "",
  ariaLabel = "Pagination",
}: ListPaginationProps) {
  if (pageCount <= 1) return null;

  const plural = totalItems > 1 ? "s" : "";

  return (
    <nav
      className={`flex items-center justify-center gap-3 ${className}`}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft disabled:opacity-30"
        aria-label="Page précédente"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs text-ink-soft">
        Page {page} sur {pageCount} · {totalItems} {itemLabel}
        {plural}
      </span>
      <button
        type="button"
        disabled={page === pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft disabled:opacity-30"
        aria-label="Page suivante"
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}
