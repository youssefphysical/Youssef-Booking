/**
 * GOLDEN REFERENCE #5 — Admin new booking notification (operational).
 *
 * Hero discipline: NO hero (admin = operational, never marketing).
 * CTA discipline: ONE primary "Open in admin". No secondary action — admin
 *   emails are single-action by design.
 * Severity: info — operational notice, scannable.
 * Tone: high-signal, low-noise. No greeting fluff.
 * Footer: NO unsubscribe (admin emails are internal-mandatory).
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  footer,
  keyValueList,
  section,
  severityBanner,
  spacer,
} from "../components";
import type { Lang } from "../tokens";

export interface AdminNewBookingInput {
  lang: Lang;
  clientName: string;
  clientPhone: string | null;
  date: string;
  time12: string;
  sessionType: string;
  packageName: string | null;
  sessionFocus: string | null;
  notes: string | null;
  adminUrl: string;
  supportEmail: string;
  // Optional, additive — surfaced when present, auto-skipped otherwise.
  clientEmail?: string | null;
  trainingGoal?: string | null;
  paymentStatus?: string | null;
  bookingSource?: string | null;
  actionTimestamp?: string | null;
  partnerName?: string | null;
  remainingSessions?: number | null;
  totalSessions?: number | null;
}

export function buildAdminNewBookingEmail(input: AdminNewBookingInput): ComposedEmail {
  const {
    lang, clientName, clientPhone, date, time12, sessionType, packageName,
    sessionFocus, notes, adminUrl, supportEmail,
    clientEmail, trainingGoal, paymentStatus, bookingSource, actionTimestamp,
    partnerName, remainingSessions, totalSessions,
  } = input;

  const subject = `New booking — ${clientName} | ${date} at ${time12}`;
  const preheader = `${sessionType}${packageName ? ` · ${packageName}` : ""}. Open the admin to confirm or adjust.`;

  const body = [
    brandHeader(),
    section(
      card({
        children: [
          severityBanner({
            severity: "info",
            title: `New booking — ${clientName}`,
            body: `${date} at ${time12} · ${sessionType}`,
          }),
          spacer("s6"),
          keyValueList({
            items: [
              { label: "Client", value: clientName },
              { label: "Email", value: clientEmail ?? null },
              { label: "Phone", value: clientPhone },
              { label: "Date", value: date },
              { label: "Time · Dubai · GST", value: time12 },
              { label: "Type", value: sessionType },
              { label: "Partner", value: partnerName ?? null },
              { label: "Package", value: packageName },
              {
                label: "Sessions remaining",
                value:
                  remainingSessions != null && totalSessions != null
                    ? `${remainingSessions} of ${totalSessions}`
                    : remainingSessions != null
                      ? String(remainingSessions)
                      : null,
              },
              { label: "Focus", value: sessionFocus },
              { label: "Goal", value: trainingGoal ?? null },
              { label: "Payment", value: paymentStatus ?? null },
              { label: "Source", value: bookingSource ?? null },
              { label: "Logged", value: actionTimestamp ?? null },
              { label: "Client notes", value: notes },
            ],
          }),
          spacer("s7"),
          ctaButton({ href: adminUrl, label: "Open in admin", variant: "brand" }),
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
