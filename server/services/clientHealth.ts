import type { ClientHealth, ClientHealthStatus } from "@shared/schema";

export type HealthSignals = {
  daysSinceLastCompleted: number | null;
  daysSinceLastCheckin: number | null;
  daysSinceLastBodyMetric: number | null;
  noShows30d: number;
  completed30d: number;
  hasActivePackage: boolean;
  activePackageFrozen: boolean;
  daysSinceJoined: number;
  clientStatus: string | null;
};

const ENDED_STATUSES = new Set(["cancelled", "expired", "completed"]);

function pluralDays(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

export function computeClientHealth(s: HealthSignals): ClientHealth {
  if (s.clientStatus === "frozen" || s.activePackageFrozen) {
    return {
      status: "frozen",
      score: 0,
      signals: [s.clientStatus === "frozen" ? "Client frozen" : "Package frozen"],
    };
  }
  if (s.clientStatus && ENDED_STATUSES.has(s.clientStatus)) {
    return { status: "ended", score: 0, signals: [`Client ${s.clientStatus}`] };
  }

  const signals: string[] = [];
  let score = 100;

  const lastCompleted = s.daysSinceLastCompleted;
  if (lastCompleted === null) {
    signals.push("No completed sessions yet");
    if (s.daysSinceJoined > 30) score -= 25;
    else if (s.daysSinceJoined > 14) score -= 12;
    else score -= 4;
  } else if (lastCompleted > 7) {
    signals.push(`Last session ${pluralDays(lastCompleted)} ago`);
    const weeksOver = Math.floor((lastCompleted - 7) / 7);
    score -= Math.min(40, weeksOver * 8 + 3);
  }

  if (s.noShows30d >= 1) {
    signals.push(`${s.noShows30d} no-show${s.noShows30d === 1 ? "" : "s"} in 30d`);
    score -= Math.min(24, s.noShows30d * 8);
  }

  if (s.hasActivePackage) {
    if (s.daysSinceLastCheckin === null) {
      signals.push("No weekly check-in yet");
      if (s.daysSinceJoined > 14) score -= 10;
    } else if (s.daysSinceLastCheckin > 14) {
      signals.push(`No check-in in ${pluralDays(s.daysSinceLastCheckin)}`);
      score -= 10;
    }
  }

  if (s.daysSinceLastBodyMetric === null) {
    if (s.daysSinceJoined > 30) {
      signals.push("No body metric on file");
      score -= 8;
    }
  } else if (s.daysSinceLastBodyMetric > 60) {
    signals.push(`No body metric in ${pluralDays(s.daysSinceLastBodyMetric)}`);
    score -= 8;
  }

  if (score < 0) score = 0;

  let status: ClientHealthStatus;
  if (s.daysSinceJoined < 14 && s.completed30d === 0 && lastCompleted === null) {
    status = "new";
  } else if (lastCompleted === null && s.daysSinceJoined > 30) {
    status = "inactive";
  } else if (lastCompleted !== null && lastCompleted > 30) {
    status = "inactive";
  } else if (s.noShows30d >= 3 || (lastCompleted !== null && lastCompleted > 14)) {
    status = "at_risk";
  } else if (signals.length > 0) {
    status = "watch";
  } else {
    status = "healthy";
  }

  return { status, score, signals: signals.slice(0, 3) };
}
