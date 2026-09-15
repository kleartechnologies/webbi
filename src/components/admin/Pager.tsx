"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** A stack of cursors: page 1 has none. Changing `resetKey` (a filter or search) starts again at page 1. */
export function useCursorPager(resetKey: string) {
  const [state, setState] = useState<{ key: string; stack: string[] }>({ key: resetKey, stack: [] });
  const stack = state.key === resetKey ? state.stack : [];
  return {
    cursor: stack.length ? stack[stack.length - 1] : null,
    page: stack.length + 1,
    next: (cursor: string) => setState({ key: resetKey, stack: [...stack, cursor] }),
    prev: () => setState({ key: resetKey, stack: stack.slice(0, -1) }),
  };
}

export function Pager({
  page,
  nextCursor,
  onPrev,
  onNext,
  loading = false,
}: {
  page: number;
  nextCursor: string | null | undefined;
  onPrev: () => void;
  onNext: (cursor: string) => void;
  loading?: boolean;
}) {
  if (page === 1 && !nextCursor) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      <Button variant="secondary" size="sm" disabled={page === 1 || loading} onClick={onPrev}>
        Previous
      </Button>
      <span className="text-[13px] text-muted">Page {page}</span>
      <Button variant="secondary" size="sm" disabled={!nextCursor || loading} onClick={() => nextCursor && onNext(nextCursor)}>
        Next
      </Button>
    </nav>
  );
}
