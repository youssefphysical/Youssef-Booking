import { cn } from "@/lib/utils";

/**
 * Cyan top/bottom hairline — the cinematic Tron HUD signature used to
 * anchor cards, panels, and hero surfaces across the client journey.
 *
 * Single source of truth replaces 12+ duplicated inline-styled divs so
 * every surface speaks the same chrome language. Decorative-only:
 * `aria-hidden` + `pointer-events-none` are baked in.
 *
 * Intensity tiers map 1:1 to the alpha levels that already exist in the
 * codebase — no visual change, just unified.
 *   subtle  (0.35) — inner / repeated tiles (e.g. InbodyTrends rows)
 *   default (0.4)  — most cards (ActivityFeed, consents, etc.)
 *   strong  (0.45) — emphasised tiles (TodayHero, supplement summary)
 *   hero    (0.5)  — top-level shells (AuthPage card)
 *
 * Usage:
 *   <CyanHairline />                               // top, default
 *   <CyanHairline intensity="hero" inset="inset-x-8" />
 *   <CyanHairline position="bottom" intensity="subtle" />
 */
const HAIRLINE_ALPHA = {
  subtle: 0.35,
  default: 0.4,
  strong: 0.45,
  hero: 0.5,
} as const;

export type CyanHairlineIntensity = keyof typeof HAIRLINE_ALPHA;

export function CyanHairline({
  position = "top",
  intensity = "default",
  inset = "inset-x-0",
  className,
}: {
  position?: "top" | "bottom";
  intensity?: CyanHairlineIntensity;
  /** Tailwind inset-x utility (e.g. `inset-x-0`, `inset-x-8`). */
  inset?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute h-px",
        inset,
        position === "top" ? "top-0" : "bottom-0",
        className,
      )}
      style={{
        background: `linear-gradient(90deg, transparent, hsl(183 100% 70% / ${HAIRLINE_ALPHA[intensity]}), transparent)`,
      }}
    />
  );
}
