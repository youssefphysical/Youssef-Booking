/**
 * Lightweight pub-sub store that lets any page communicate the height of its
 * sticky bottom CTA to the global HelpFab, so the bubble can animate upward
 * when a CTA slides in and return when it slides out.
 *
 * Usage (in a page component):
 *   import { setPageCtaHeight } from "@/lib/fab-offset";
 *   useEffect(() => {
 *     setPageCtaHeight(ctaVisible ? 96 : 0);
 *     return () => setPageCtaHeight(0);
 *   }, [ctaVisible]);
 */

import { useState, useEffect } from "react";

let _h = 0;
const _subs = new Set<() => void>();

export function setPageCtaHeight(h: number) {
  if (_h === h) return;
  _h = h;
  _subs.forEach((fn) => fn());
}

export function usePageCtaHeight(): number {
  const [h, setH] = useState(_h);
  useEffect(() => {
    const update = () => setH(_h);
    _subs.add(update);
    return () => {
      _subs.delete(update);
    };
  }, []);
  return h;
}
