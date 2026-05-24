// =====================================================================
// Smart "What's Next" recommendation rules (Task #32, brief §33).
// Pure, dependency-free, framework-agnostic functions so they're trivial
// to unit-test and reuse outside the dashboard tile.
// =====================================================================

export type RecommendationKind =
  | "verification_pending"
  | "renewal_low_sessions"
  | "renewal_expired"
  | "book_next"
  | "inactive_book_next"
  | "consistency_milestone"
  | "complete_profile"
  | "book_first";

export interface Recommendation {
  kind: RecommendationKind;
  /** Priority — higher wins when multiple rules trigger. */
  priority: number;
  /** i18n key for the headline. */
  titleKey: string;
  /** i18n key for the supporting copy. */
  bodyKey: string;
  /** Where the CTA should send the user. */
  href: string;
  /** i18n key for the CTA label. */
  ctaKey: string;
  /** Optional values for templated i18n strings. */
  values?: Record<string, string | number>;
}

export interface RecommendationInput {
  /** Current/active package summary, if any. */
  activePackage?: {
    isActive: boolean;
    status?: string | null;
    usedSessions: number;
    totalSessions: number;
    expiresAt?: string | Date | null;
  } | null;
  /** Pending package verification request, if any. */
  hasPendingVerification?: boolean;
  /** Client's goal: "fat_loss", "muscle_gain", "performance", etc. */
  goal?: string | null;
  /** Last completed booking (ISO date or Date), if any. */
  lastSessionAt?: string | Date | null;
  /** Total completed sessions in the current consistency window. */
  consistencyStreak?: number;
  /** True when client has any booking ever. */
  hasAnyBooking?: boolean;
  /** True when the client has a saved training location. */
  hasTrainingLocation?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(v: string | Date | null | undefined): number | null {
  const d = toDate(v);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

function daysUntil(v: string | Date | null | undefined): number | null {
  const d = toDate(v);
  if (!d) return null;
  return Math.floor((d.getTime() - Date.now()) / DAY_MS);
}

/**
 * Returns the highest-priority recommendation for the given client state,
 * or null when nothing actionable applies.
 */
export function pickRecommendation(input: RecommendationInput): Recommendation | null {
  const recs = collectRecommendations(input);
  if (recs.length === 0) return null;
  recs.sort((a, b) => b.priority - a.priority);
  return recs[0];
}

export function collectRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];

  // 100 — Verification still pending. Blocks booking, so this wins.
  if (input.hasPendingVerification) {
    out.push({
      kind: "verification_pending",
      priority: 100,
      titleKey: "whatsnext.verification.title",
      bodyKey: "whatsnext.verification.body",
      href: "/dashboard",
      ctaKey: "whatsnext.verification.cta",
    });
  }

  const pkg = input.activePackage ?? null;
  const remaining = pkg ? Math.max(pkg.totalSessions - pkg.usedSessions, 0) : 0;
  const pkgDaysLeft = pkg ? daysUntil(pkg.expiresAt) : null;
  const pkgExpired =
    pkg && (pkg.status === "expired" || pkg.status === "completed" || (pkgDaysLeft !== null && pkgDaysLeft < 0));

  // 90 — Package fully consumed or expired. Needs renewal to keep going.
  if (pkg && (pkgExpired || remaining <= 0)) {
    out.push({
      kind: "renewal_expired",
      priority: 90,
      titleKey: "whatsnext.renewalExpired.title",
      bodyKey: "whatsnext.renewalExpired.body",
      href: "/dashboard#packages",
      ctaKey: "whatsnext.renewalExpired.cta",
    });
  } else if (pkg && pkg.isActive && remaining > 0 && remaining <= 3) {
    // 80 — Only a few sessions left. Renewal recommended.
    out.push({
      kind: "renewal_low_sessions",
      priority: 80,
      titleKey: "whatsnext.renewalLow.title",
      bodyKey: "whatsnext.renewalLow.body",
      href: "/dashboard#packages",
      ctaKey: "whatsnext.renewalLow.cta",
      values: { remaining },
    });
  }

  // 70 — Active client, no booking on the books → "book your next session".
  // Active = had a recent session, package still alive.
  if (pkg && pkg.isActive && remaining > 3) {
    const sinceLast = daysSince(input.lastSessionAt);
    if (sinceLast !== null && sinceLast >= 14) {
      out.push({
        kind: "inactive_book_next",
        priority: 75,
        titleKey: "whatsnext.inactive.title",
        bodyKey: "whatsnext.inactive.body",
        href: "/book",
        ctaKey: "whatsnext.inactive.cta",
        values: { days: sinceLast },
      });
    } else if (sinceLast === null && input.hasAnyBooking === false) {
      out.push({
        kind: "book_first",
        priority: 72,
        titleKey: "whatsnext.bookFirst.title",
        bodyKey: "whatsnext.bookFirst.body",
        href: "/book",
        ctaKey: "whatsnext.bookFirst.cta",
      });
    } else {
      out.push({
        kind: "book_next",
        priority: 50,
        titleKey: "whatsnext.bookNext.title",
        bodyKey: "whatsnext.bookNext.body",
        href: "/book",
        ctaKey: "whatsnext.bookNext.cta",
      });
    }
  }


  // 40 — High consistency → positive milestone callout. Pure encouragement.
  if ((input.consistencyStreak ?? 0) >= 8) {
    out.push({
      kind: "consistency_milestone",
      priority: 40,
      titleKey: "whatsnext.milestone.title",
      bodyKey: "whatsnext.milestone.body",
      href: "/dashboard#progress",
      ctaKey: "whatsnext.milestone.cta",
      values: { streak: input.consistencyStreak ?? 0 },
    });
  }

  // 20 — New user without a saved training location → finish profile.
  if (input.hasTrainingLocation === false && !pkg) {
    out.push({
      kind: "complete_profile",
      priority: 20,
      titleKey: "whatsnext.completeProfile.title",
      bodyKey: "whatsnext.completeProfile.body",
      href: "/wizard",
      ctaKey: "whatsnext.completeProfile.cta",
    });
  }

  return out;
}
