// =============================================================================
// Task #29 — Package Rules Engine (pure functions)
// =============================================================================
// Lifecycle + activation guards for packages. Pure — no DB calls. Route
// handlers consume these and translate to HTTP / audit-log writes.
// =============================================================================

import type { Package } from "@shared/schema";
import type { RuleResult } from "./booking";

const OK = { ok: true as const };

// Anything where a partner is required.
const DUO_TYPES = new Set(["duo", "duo30"]);

export function isDuoPackage(pkg: Pick<Package, "type">): boolean {
  return DUO_TYPES.has(pkg.type);
}

// -----------------------------------------------------------------------------
// canActivatePackage — enforce duo partner + non-zero totals at activation.
// -----------------------------------------------------------------------------
export function canActivatePackage(
  pkg: Pick<Package, "type" | "partnerUserId" | "totalSessions"> & {
    partnerFullName?: string | null;
  },
): RuleResult {
  if (isDuoPackage(pkg)) {
    const hasAccountPartner = typeof pkg.partnerUserId === "number" && pkg.partnerUserId > 0;
    const hasSnapshotPartner =
      typeof pkg.partnerFullName === "string" && pkg.partnerFullName.trim().length >= 2;
    if (!hasAccountPartner && !hasSnapshotPartner) {
      return {
        ok: false,
        code: "duo_partner_required",
        message: "Duo packages require a partner client or partner name snapshot.",
      };
    }
  }
  const total = pkg.totalSessions ?? 0;
  if (total <= 0) {
    return {
      ok: false,
      code: "invalid_total_sessions",
      message: "Total sessions must be at least 1.",
    };
  }
  return OK;
}

// -----------------------------------------------------------------------------
// canBookFromPackage — checked inside the booking transaction, AFTER
// SELECT … FOR UPDATE locks the row.
// -----------------------------------------------------------------------------
export function canBookFromPackage(
  pkg: Pick<Package, "isActive" | "frozen" | "status" | "totalSessions" | "usedSessions" | "expiryDate">,
): RuleResult {
  if (pkg.isActive === false) {
    return { ok: false, code: "package_inactive", message: "Your package is inactive. Please request a renewal." };
  }
  if ((pkg as any).status === "pending_verification") {
    return { ok: false, code: "pending_verification", message: "Your package is awaiting verification." };
  }
  if ((pkg as any).status === "archived") {
    return { ok: false, code: "package_archived", message: "This package has been archived." };
  }
  if (pkg.frozen) {
    return { ok: false, code: "package_frozen", message: "Your active package is currently frozen. Contact support through the platform to unfreeze it." };
  }
  const total = pkg.totalSessions ?? 0;
  const used = pkg.usedSessions ?? 0;
  if (used >= total) {
    return { ok: false, code: "package_completed", message: "Your package is fully used. Please request a renewal to continue booking." };
  }
  if (pkg.expiryDate) {
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(pkg.expiryDate as any);
    if (isFinite(exp.getTime()) && exp.getTime() < today.getTime()) {
      return { ok: false, code: "package_expired", message: "Your package has expired. Please request a renewal or an extension." };
    }
  }
  return OK;
}

// -----------------------------------------------------------------------------
// canFreezePackage — already-frozen / archived rows reject re-freeze.
// -----------------------------------------------------------------------------
export function canFreezePackage(pkg: Pick<Package, "frozen" | "status">): RuleResult {
  if ((pkg as any).status === "archived") {
    return { ok: false, code: "package_archived", message: "This package has been archived." };
  }
  if (pkg.frozen) {
    return { ok: false, code: "already_frozen", message: "Package is already frozen." };
  }
  return OK;
}

export function canUnfreezePackage(pkg: Pick<Package, "frozen" | "status">): RuleResult {
  if ((pkg as any).status === "archived") {
    return { ok: false, code: "package_archived", message: "This package has been archived." };
  }
  if (!pkg.frozen) {
    return { ok: false, code: "not_frozen", message: "Package is not currently frozen." };
  }
  return OK;
}

export function canArchivePackage(pkg: Pick<Package, "status">): RuleResult {
  if ((pkg as any).status === "archived") {
    return { ok: false, code: "package_archived", message: "This package is already archived." };
  }
  return OK;
}

// -----------------------------------------------------------------------------
// Centralised list of rule codes mapped to i18n keys. Client imports this
// from `@shared/schema` re-export for type safety.
// -----------------------------------------------------------------------------
export const RULE_CODE_I18N_KEYS = {
  // booking
  invalid_slot: "rules.invalidSlot",
  slot_out_of_hours: "rules.slotOutOfHours",
  slot_in_past: "rules.slotInPast",
  lead_time_too_short: "rules.leadTimeTooShort",
  slot_taken: "rules.slotTaken",
  under_6h_lockout: "rules.under6hLockout",
  duo_partner_required: "rules.duoPartnerRequired",
  forbidden: "rules.forbidden",
  booking_locked: "rules.bookingLocked",
  // package
  no_active_package: "rules.noActivePackage",
  package_frozen: "rules.packageFrozen",
  package_expired: "rules.packageExpired",
  package_completed: "rules.packageCompleted",
  package_inactive: "rules.packageInactive",
  package_archived: "rules.packageArchived",
  pending_verification: "rules.pendingVerification",
  already_frozen: "rules.alreadyFrozen",
  not_frozen: "rules.notFrozen",
  invalid_total_sessions: "rules.invalidTotalSessions",
  // client
  client_frozen: "rules.clientFrozen",
  client_cancelled: "rules.clientCancelled",
  client_completed: "rules.clientCompleted",
  client_expired: "rules.clientExpired",
  profile_incomplete: "rules.profileIncomplete",
} as const;

export type RuleCode = keyof typeof RULE_CODE_I18N_KEYS;
