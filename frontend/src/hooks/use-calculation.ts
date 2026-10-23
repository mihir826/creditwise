"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";

interface Settled<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/** Debounced, cancellable request keyed by a serialisable input.
 * Keeps the last good result on screen while a newer one is in flight;
 * `loading` is true until a response for the *current* key has settled. */
export function useDebouncedRequest<I, T>(
  input: I | null,
  fetcher: (input: I, signal: AbortSignal) => Promise<T>,
  delay = 180,
) {
  const key = input === null ? null : JSON.stringify(input);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  // The first request fires immediately; later ones are debounced while typing/dragging.
  const hasFetched = useRef(false);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const wait = hasFetched.current ? delay : 0;
    hasFetched.current = true;
    const timer = setTimeout(async () => {
      try {
        const data = await fetcher(JSON.parse(key) as I, controller.signal);
        setSettled({ key, data, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        setSettled((prev) => ({ key, data: prev?.data ?? null, error: errorMessage(err) }));
      }
    }, wait);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // fetcher is expected to be a stable module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);

  return {
    data: key !== null ? (settled?.data ?? null) : null,
    error: key !== null && settled?.key === key ? settled.error : null,
    loading: key !== null && settled?.key !== key,
  };
}
