import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";

const HIDDEN_PREFIXES = [
  "/book",
  "/admin",
  "/admin-access",
  "/auth",
  "/reset-password",
  "/print",
];

export function HelpFab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pathname] = useLocation();

  // Task #76 — one-tap support is a client-area feature. Don't show
  // to public visitors or admins (admin contact paths differ).
  if (user?.role !== "client") return null;

  const hidden = HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (hidden) return null;

  const isRtl =
    typeof document !== "undefined" && document.documentElement.dir === "rtl";

  const href = whatsappUrl(DEFAULT_WHATSAPP_NUMBER, t("fab.help.message"));
  const label = t("fab.help.aria");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-testid="fab-help-coach"
      className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/40 bg-black/70 text-cyan-200 shadow-[0_0_24px_rgba(94,231,255,0.45)] backdrop-blur-md transition-all hover:scale-105 hover:border-cyan-300/80 hover:text-cyan-100 hover:shadow-[0_0_32px_rgba(94,231,255,0.7)] active:scale-95"
      style={{
        /* On mobile the bottom nav bar is ~56–64 px tall.
           90 px clearance spec = ~90 px above the nav = bottom ~5.5rem on mobile,
           1rem on md+ where the nav is hidden. */
        bottom: "var(--fab-bottom, calc(env(safe-area-inset-bottom, 0px) + 1rem))",
        ...(isRtl
          ? { left: "calc(env(safe-area-inset-left, 0px) + 1rem)" }
          : { right: "calc(env(safe-area-inset-right, 0px) + 1rem)" }),
      }}
    >
      <MessageCircle size={22} aria-hidden />
    </a>
  );
}

export default HelpFab;
