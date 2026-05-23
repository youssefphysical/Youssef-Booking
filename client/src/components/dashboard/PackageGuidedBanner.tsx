import { useMemo } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { formatDateDubai } from "@shared/dates";
import { usePackages } from "@/hooks/use-packages";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER, buildWhatsappMessage } from "@/lib/whatsapp";
import { GuidedStatusBanner } from "./GuidedStatusBanner";
import type { Package } from "@shared/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(d?: string | Date | null): number | null {
  if (!d) return null;
  const t = new Date(d as any).getTime();
  if (!isFinite(t)) return null;
  return Math.floor((t - Date.now()) / DAY_MS);
}

/**
 * Phase 1 UX coordination — renders a guided status banner when the
 * client's most-recent package is approaching its end (low sessions or
 * close to expiry) or has already ended. Stays silent in the healthy
 * "active with sessions left" state so the dashboard isn't noisy.
 *
 * Renders nothing while a package is still in pending verification —
 * the dedicated verification banner already covers that state.
 */
export function PackageGuidedBanner({ userId }: { userId: number }) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { data: packages = [] } = usePackages({ userId });

  const trainerWa = settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER;

  const state = useMemo(() => {
    const list = packages as Package[];
    const pending = list.find(
      (p: any) => p.status === "pending_verification" || p.status === "pending",
    );
    if (pending) return null;

    // Prefer the live active package; fall back to most recent so the
    // expired branch still fires after sessions run out.
    const active =
      list.find((p) => p.isActive && p.usedSessions < p.totalSessions) ||
      list.find((p) => p.isActive) ||
      null;
    const candidate = active ?? list[0] ?? null;
    if (!candidate) return null;

    const remaining = Math.max(
      candidate.totalSessions - candidate.usedSessions,
      0,
    );
    const dLeft = daysUntil(candidate.expiryDate as any);
    const status = (candidate as any).status as string | undefined;
    const isExpired =
      status === "expired" ||
      status === "completed" ||
      remaining <= 0 ||
      (dLeft !== null && dLeft < 0);
    const isExpiring =
      !isExpired &&
      ((remaining > 0 && remaining <= 3) ||
        (dLeft !== null && dLeft >= 0 && dLeft <= 7));

    if (!isExpired && !isExpiring) return null;

    return {
      pkg: candidate,
      remaining,
      daysLeft: dLeft,
      kind: isExpired ? ("expired" as const) : ("expiring" as const),
    };
  }, [packages]);

  if (!state) return null;

  const { pkg, remaining, daysLeft, kind } = state;
  const pkgLabel = (pkg as any).name || (pkg as any).type || "";

  const renewWa = whatsappUrl(
    trainerWa,
    buildWhatsappMessage("requestRenewal", {
      clientName: user?.fullName ?? null,
      packageLabel: pkgLabel ? ` (${pkgLabel})` : null,
      lang,
    }),
  );

  const validUntil =
    pkg.expiryDate && isFinite(new Date(pkg.expiryDate as any).getTime())
      ? formatDateDubai(pkg.expiryDate as any)
      : null;

  if (kind === "expiring") {
    const reasonBits: string[] = [];
    if (remaining > 0 && remaining <= 3) {
      reasonBits.push(
        t(
          "dashboard.packageBanner.expiring.sessionsLeft",
          "{n} sessions remaining",
        ).replace("{n}", String(remaining)),
      );
    }
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) {
      reasonBits.push(
        t(
          "dashboard.packageBanner.expiring.daysLeft",
          "{d} days until your package ends",
        ).replace("{d}", String(daysLeft)),
      );
    }
    const bodyBase = t(
      "dashboard.packageBanner.expiring.body",
      "Let's keep your momentum going. Request a renewal now and Coach Youssef will confirm the next package on WhatsApp.",
    );
    const reasonLine = reasonBits.length ? `${reasonBits.join(" · ")}. ` : "";

    return (
      <GuidedStatusBanner
        testId="banner-package-expiring"
        tone="amber"
        icon={<Sparkles size={18} aria-hidden="true" />}
        eyebrow={t("dashboard.packageBanner.expiring.eyebrow", "Renewal time")}
        title={t(
          "dashboard.packageBanner.expiring.title",
          "Your package is almost done",
        )}
        body={`${reasonLine}${bodyBase}`}
        etaText={
          validUntil
            ? t(
                "dashboard.packageBanner.expiring.eta",
                "Valid until {date}",
              ).replace("{date}", validUntil)
            : undefined
        }
        primaryAction={{
          kind: "link",
          href: renewWa,
          label: t(
            "dashboard.packageBanner.expiring.cta",
            "Request renewal via WhatsApp",
          ),
          testId: "link-package-banner-renew",
        }}
        helpHref={whatsappUrl(trainerWa)}
        helpLabel={t(
          "dashboard.packageBanner.help",
          "Questions? Message Coach",
        )}
        helpTestId="link-package-banner-help"
      />
    );
  }

  // expired
  return (
    <GuidedStatusBanner
      testId="banner-package-expired"
      tone="amber"
      icon={<RefreshCw size={18} aria-hidden="true" />}
      eyebrow={t("dashboard.packageBanner.expired.eyebrow", "Package complete")}
      title={t(
        "dashboard.packageBanner.expired.title",
        "Package complete — let's plan the next chapter",
      )}
      body={t(
        "dashboard.packageBanner.expired.body",
        "Your training package has ended. Tell Coach Youssef where you want to go next and he'll line up the right package on WhatsApp.",
      )}
      etaText={t(
        "dashboard.packageBanner.expired.eta",
        "Typical reply within a few hours.",
      )}
      primaryAction={{
        kind: "link",
        href: renewWa,
        label: t(
          "dashboard.packageBanner.expired.cta",
          "Plan the next package",
        ),
        testId: "link-package-banner-renew",
      }}
      helpHref={whatsappUrl(trainerWa)}
      helpLabel={t(
        "dashboard.packageBanner.help",
        "Questions? Message Coach",
      )}
      helpTestId="link-package-banner-help"
    />
  );
}

export default PackageGuidedBanner;
