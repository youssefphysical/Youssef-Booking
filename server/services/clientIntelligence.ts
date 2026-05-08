import type {
  AttentionItem,
  ClientIntelligence,
  ClientMomentum,
  ClientSnapshot,
  RecentChange,
} from "@shared/schema";

export type IntelligenceInput = {
  now: Date;
  clientStatus: string | null;
  primaryGoal: string | null;
  joinedAt: string | Date | null;
  activePackage: {
    totalSessions: number | null;
    usedSessions: number | null;
    expiryDate: string | null;
    frozen: boolean;
    paymentStatus: string | null;
  } | null;
  bookings: Array<{
    id: number;
    date: string;
    timeSlot: string | null;
    status: string;
    coachNotesUpdatedAt: string | Date | null;
  }>;
  checkins: Array<{ id: number; weekStart: string }>;
  bodyMetrics: Array<{
    id: number;
    recordedOn: string;
    weight: number | null;
    bodyFat: number | null;
  }>;
  pendingRenewalCount: number;
  pendingExtensionCount: number;
};

const DAY_MS = 86_400_000;
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}
function toDate(v: string | Date | null): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? null : d;
}
function pluralDays(n: number) {
  return n === 1 ? "1 day" : `${n} days`;
}

function buildSnapshot(i: IntelligenceInput): ClientSnapshot {
  const { now, activePackage, bookings, checkins, bodyMetrics } = i;
  const sessionsLeft =
    activePackage && activePackage.totalSessions != null
      ? Math.max(0, (activePackage.totalSessions ?? 0) - (activePackage.usedSessions ?? 0))
      : null;
  const sessionsTotal = activePackage?.totalSessions ?? null;
  const packageDaysLeft = (() => {
    const d = toDate(activePackage?.expiryDate ?? null);
    return d ? daysBetween(now, d) : null;
  })();

  const thirtyAgo = new Date(now.getTime() - 30 * DAY_MS);
  const last30 = bookings.filter((b) => {
    const d = toDate(b.date);
    return d && d >= thirtyAgo && d <= now;
  });
  const completed30 = last30.filter((b) => b.status === "completed").length;
  const noShow30 = last30.filter((b) => b.status === "no_show").length;
  const attendanceDenom = completed30 + noShow30;
  const attendanceRate30d =
    attendanceDenom > 0 ? Math.round((completed30 / attendanceDenom) * 100) : null;

  const fourWeeksAgo = new Date(now.getTime() - 28 * DAY_MS);
  const recentCheckins = checkins.filter((c) => {
    const d = toDate(c.weekStart);
    return d && d >= fourWeeksAgo;
  });
  const checkinAdherence4w = Math.min(100, Math.round((recentCheckins.length / 4) * 100));

  const completedSorted = bookings
    .filter((b) => b.status === "completed")
    .map((b) => toDate(b.date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastCompletedDate = completedSorted[0] ? completedSorted[0].toISOString().slice(0, 10) : null;

  const futureBookings = bookings
    .filter((b) => ["upcoming", "confirmed"].includes(b.status))
    .map((b) => ({ d: toDate(b.date), b }))
    .filter((x): x is { d: Date; b: (typeof bookings)[number] } => x.d !== null && x.d >= new Date(now.getTime() - DAY_MS))
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  const next = futureBookings[0];

  const metricsSorted = [...bodyMetrics].sort(
    (a, b) => (toDate(b.recordedOn)?.getTime() ?? 0) - (toDate(a.recordedOn)?.getTime() ?? 0),
  );
  const latest = metricsSorted[0];
  const olderInWindow = metricsSorted.find((m) => {
    const d = toDate(m.recordedOn);
    return d && now.getTime() - d.getTime() >= 21 * DAY_MS;
  });
  const weightDelta30d =
    latest?.weight != null && olderInWindow?.weight != null
      ? +(latest.weight - olderInWindow.weight).toFixed(1)
      : null;

  return {
    sessionsLeft,
    sessionsTotal,
    packageDaysLeft,
    attendanceRate30d,
    checkinAdherence4w,
    lastCompletedDate,
    nextBookingDate: next ? next.d.toISOString().slice(0, 10) : null,
    nextBookingTimeSlot: next ? next.b.timeSlot : null,
    weightLatest: latest?.weight ?? null,
    weightDelta30d,
    bodyFatLatest: latest?.bodyFat ?? null,
  };
}

function buildMomentum(i: IntelligenceInput, snap: ClientSnapshot): ClientMomentum {
  const { now, bookings } = i;
  if (i.clientStatus === "frozen" || i.activePackage?.frozen) {
    return { state: "stable", reason: "Frozen — no activity expected" };
  }
  const last = snap.lastCompletedDate ? toDate(snap.lastCompletedDate) : null;
  if (!last || daysBetween(last, now) > 14) {
    return {
      state: "inactive",
      reason: last
        ? `No session in ${pluralDays(daysBetween(last, now))}`
        : "No completed sessions yet",
    };
  }
  const thirtyAgo = new Date(now.getTime() - 30 * DAY_MS);
  const sixtyAgo = new Date(now.getTime() - 60 * DAY_MS);
  const completed30 = bookings.filter((b) => {
    const d = toDate(b.date);
    return b.status === "completed" && d && d >= thirtyAgo && d <= now;
  }).length;
  const completedPrev30 = bookings.filter((b) => {
    const d = toDate(b.date);
    return b.status === "completed" && d && d >= sixtyAgo && d < thirtyAgo;
  }).length;
  const noShow30 = bookings.filter((b) => {
    const d = toDate(b.date);
    return b.status === "no_show" && d && d >= thirtyAgo && d <= now;
  }).length;

  if (noShow30 >= 2) {
    return { state: "inconsistent", reason: `${noShow30} no-shows in last 30 days` };
  }
  if (completedPrev30 >= 3 && completed30 < completedPrev30 * 0.6) {
    return {
      state: "slowing",
      reason: `${completed30} sessions vs ${completedPrev30} prior 30d`,
    };
  }
  if (completed30 >= 4 && completed30 > completedPrev30 * 1.2) {
    return {
      state: "improving",
      reason: `${completed30} sessions in last 30 days`,
    };
  }
  if (i.primaryGoal === "fat_loss" && snap.weightDelta30d != null && snap.weightDelta30d <= -0.5) {
    return { state: "improving", reason: `Weight ${snap.weightDelta30d}kg over ~30 days` };
  }
  if (i.primaryGoal === "muscle_gain" && snap.weightDelta30d != null && snap.weightDelta30d >= 0.5) {
    return { state: "improving", reason: `Weight +${snap.weightDelta30d}kg over ~30 days` };
  }
  if (snap.attendanceRate30d != null && snap.attendanceRate30d >= 90 && completed30 >= 4) {
    return { state: "improving", reason: `${snap.attendanceRate30d}% attendance` };
  }
  return { state: "stable", reason: `${completed30} sessions in last 30 days` };
}

function buildAttention(i: IntelligenceInput, snap: ClientSnapshot): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { now } = i;
  const ended = ["cancelled", "expired", "completed"].includes(i.clientStatus ?? "");
  const frozen = i.clientStatus === "frozen" || i.activePackage?.frozen;
  if (ended || frozen) return items;

  if (!i.activePackage) {
    items.push({
      id: "no_package",
      severity: "critical",
      title: "No active package",
      body: "Assign a package to resume tracking.",
      tab: "packages",
    });
  } else {
    if (snap.packageDaysLeft != null && snap.packageDaysLeft < 0) {
      items.push({
        id: "pkg_expired",
        severity: "critical",
        title: "Package expired",
        body: `Expired ${pluralDays(-snap.packageDaysLeft)} ago`,
        tab: "packages",
      });
    } else if (snap.packageDaysLeft != null && snap.packageDaysLeft <= 7) {
      items.push({
        id: "pkg_expiring",
        severity: "warning",
        title: "Package ending soon",
        body: `${pluralDays(snap.packageDaysLeft)} until expiry`,
        tab: "packages",
      });
    }
    if (snap.sessionsLeft != null && snap.sessionsLeft <= 2) {
      items.push({
        id: "sessions_low",
        severity: snap.sessionsLeft === 0 ? "critical" : "warning",
        title: snap.sessionsLeft === 0 ? "No sessions left" : "Sessions running low",
        body: `${snap.sessionsLeft} of ${snap.sessionsTotal ?? "?"} remaining`,
        tab: "packages",
      });
    }
    const ps = i.activePackage.paymentStatus;
    if (ps === "unpaid" || ps === "pending" || ps === "direct_payment_requested") {
      items.push({
        id: `pay_${ps}`,
        severity: "warning",
        title: "Payment pending",
        body: ps === "unpaid" ? "Awaiting confirmation" : "Payment in progress",
        tab: "packages",
      });
    }
  }

  if (i.pendingRenewalCount > 0) {
    items.push({
      id: "renewal_pending",
      severity: "warning",
      title: "Renewal requested",
      body: `${i.pendingRenewalCount} pending request${i.pendingRenewalCount === 1 ? "" : "s"}`,
      tab: "packages",
    });
  }
  if (i.pendingExtensionCount > 0) {
    items.push({
      id: "extension_pending",
      severity: "warning",
      title: "Extension requested",
      body: `${i.pendingExtensionCount} pending request${i.pendingExtensionCount === 1 ? "" : "s"}`,
      tab: "packages",
    });
  }

  const lastDate = snap.lastCompletedDate ? toDate(snap.lastCompletedDate) : null;
  const daysSinceLast = lastDate ? daysBetween(lastDate, now) : null;
  if (i.activePackage && daysSinceLast !== null && daysSinceLast > 14) {
    items.push({
      id: "inactive_long",
      severity: daysSinceLast > 21 ? "critical" : "warning",
      title: "No recent sessions",
      body: `Last session ${pluralDays(daysSinceLast)} ago`,
      tab: "bookings",
    });
  }

  const noShow14 = i.bookings.filter((b) => {
    const d = toDate(b.date);
    return b.status === "no_show" && d && now.getTime() - d.getTime() <= 14 * DAY_MS;
  }).length;
  if (noShow14 >= 1) {
    items.push({
      id: "noshow_recent",
      severity: noShow14 >= 2 ? "warning" : "watch",
      title: noShow14 === 1 ? "1 missed session recently" : `${noShow14} missed sessions recently`,
      body: "Last 14 days",
      tab: "bookings",
    });
  }

  if (i.activePackage) {
    const lastCk = i.checkins
      .map((c) => toDate(c.weekStart))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const daysSinceCk = lastCk ? daysBetween(lastCk, now) : null;
    if (daysSinceCk === null) {
      const joined = toDate(i.joinedAt);
      if (joined && daysBetween(joined, now) > 14) {
        items.push({
          id: "no_checkin",
          severity: "info",
          title: "No weekly check-in",
          body: "Encourage first check-in",
          tab: "checkins",
        });
      }
    } else if (daysSinceCk > 14) {
      items.push({
        id: "stale_checkin",
        severity: "watch",
        title: "Check-ins paused",
        body: `Last check-in ${pluralDays(daysSinceCk)} ago`,
        tab: "checkins",
      });
    }
  }

  const lastBm = i.bodyMetrics
    .map((m) => toDate(m.recordedOn))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lastBm) {
    const days = daysBetween(lastBm, now);
    if (days > 60) {
      items.push({
        id: "stale_body",
        severity: "info",
        title: "Body metrics outdated",
        body: `Last update ${pluralDays(days)} ago`,
        tab: "body",
      });
    }
  } else {
    const joined = toDate(i.joinedAt);
    if (joined && daysBetween(joined, now) > 30) {
      items.push({
        id: "no_body",
        severity: "info",
        title: "No body metrics on file",
        body: "Log weight to enable trends",
        tab: "body",
      });
    }
  }

  if (i.primaryGoal === "fat_loss" && snap.weightDelta30d != null && snap.weightDelta30d > 0.5) {
    items.push({
      id: "weight_off_track",
      severity: "watch",
      title: "Weight trending up",
      body: `+${snap.weightDelta30d}kg over ~30 days (goal: fat loss)`,
      tab: "body",
    });
  }
  if (i.primaryGoal === "muscle_gain" && snap.weightDelta30d != null && snap.weightDelta30d < -0.5) {
    items.push({
      id: "weight_off_track",
      severity: "watch",
      title: "Weight trending down",
      body: `${snap.weightDelta30d}kg over ~30 days (goal: muscle gain)`,
      tab: "body",
    });
  }

  const order: Record<AttentionItem["severity"], number> = {
    critical: 0,
    warning: 1,
    watch: 2,
    info: 3,
  };
  items.sort((a, b) => order[a.severity] - order[b.severity]);
  return items.slice(0, 6);
}

function buildRecentChanges(i: IntelligenceInput): RecentChange[] {
  const since = new Date(i.now.getTime() - 14 * DAY_MS);
  const events: RecentChange[] = [];

  for (const b of i.bookings) {
    const d = toDate(b.date);
    if (!d || d < since || d > i.now) continue;
    if (b.status === "completed") {
      events.push({
        id: `booking-c-${b.id}`,
        kind: "session_completed",
        label: "Session completed",
        sublabel: b.timeSlot || undefined,
        when: d.toISOString(),
      });
    } else if (b.status === "no_show") {
      events.push({
        id: `booking-n-${b.id}`,
        kind: "session_missed",
        label: "Session missed",
        sublabel: b.timeSlot || undefined,
        when: d.toISOString(),
      });
    }
    const cn = toDate(b.coachNotesUpdatedAt as any);
    if (cn && cn >= since) {
      events.push({
        id: `cn-${b.id}`,
        kind: "coach_note",
        label: "Coach note added",
        when: cn.toISOString(),
      });
    }
  }
  for (const c of i.checkins) {
    const d = toDate(c.weekStart);
    if (!d || d < since) continue;
    events.push({
      id: `ck-${c.id}`,
      kind: "checkin",
      label: "Weekly check-in",
      when: d.toISOString(),
    });
  }
  for (const m of i.bodyMetrics) {
    const d = toDate(m.recordedOn);
    if (!d || d < since) continue;
    const parts: string[] = [];
    if (m.weight != null) parts.push(`${m.weight}kg`);
    if (m.bodyFat != null) parts.push(`${m.bodyFat}% bf`);
    events.push({
      id: `bm-${m.id}`,
      kind: "body_metric",
      label: "Body metric logged",
      sublabel: parts.join(" · ") || undefined,
      when: d.toISOString(),
    });
  }

  events.sort((a, b) => b.when.localeCompare(a.when));
  return events.slice(0, 8);
}

export function computeClientIntelligence(i: IntelligenceInput): ClientIntelligence {
  const snapshot = buildSnapshot(i);
  const momentum = buildMomentum(i, snapshot);
  const attentionItems = buildAttention(i, snapshot);
  const recentChanges = buildRecentChanges(i);
  return { snapshot, momentum, attentionItems, recentChanges };
}
