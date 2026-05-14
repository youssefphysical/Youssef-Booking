/**
 * GOLDEN REFERENCE #5 — Admin new booking notification (operational).
 *
 * Hero discipline: NO hero (admin = operational, never marketing).
 * CTA discipline: ONE primary "Open in admin". No secondary action — admin
 *   emails are single-action by design (no reschedule/whatsapp from here).
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
  sessionType: string;          // e.g. "Package" / "Single" / "Trial" / "Duo"
  packageName: string | null;
  sessionFocus: string | null;
  notes: string | null;
  adminUrl: string;
  supportEmail: string;         // ops inbox
}

export function buildAdminNewBookingEmail(input: AdminNewBookingInput): ComposedEmail {
  const { lang, clientName, clientPhone, date, time12, sessionType, packageName, sessionFocus, notes, adminUrl, supportEmail } = input;

  const subject = `New booking — ${clientName} · ${date} ${time12}`;
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
          spacer("s5"),
          keyValueList({
            items: [
              { label: "Client", value: clientName },
              { label: "Phone", value: clientPhone },
              { label: "Date", value: date },
              { label: "Time", value: time12 },
              { label: "Type", value: sessionType },
              { label: "Package", value: packageName },
              { label: "Focus", value: sessionFocus },
              { label: "Client notes", value: notes },
            ],
          }),
          spacer("s6"),
          ctaButton({ href: adminUrl, label: "Open in admin", variant: "brand" }),
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
