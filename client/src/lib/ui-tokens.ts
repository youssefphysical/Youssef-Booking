/**
 * Shared design tokens for the premium TRON-Legacy operating-system feel.
 *
 * One signature, every surface — primary CTAs across auth, reset password,
 * onboarding, profile, public marketing pages, etc. all compose this same
 * chrome so the app reads as a single cohesive system rather than a stack
 * of isolated screens.
 *
 * Usage: pair with sizing/shape utilities at the call site so each CTA
 * keeps its own footprint.
 *   <Button className={`w-full h-12 rounded-xl font-bold ${PRIMARY_CTA_CLASS}`}/>
 *
 * Glow rules (per product direction):
 * - Cyan glow guides attention — only primary actions, active states, and
 *   key system signals get it. Never decorative chrome.
 * - Tight spread (-6px / -4px) keeps it cinematic, never bloomy.
 * - `disabled:shadow-none` so disabled CTAs don't mislead the user.
 */
export const PRIMARY_CTA_CLASS =
  "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_24px_-6px_hsl(183_100%_55%/0.55)] hover:shadow-[0_0_28px_-4px_hsl(183_100%_60%/0.65)] transition-shadow disabled:shadow-none";
