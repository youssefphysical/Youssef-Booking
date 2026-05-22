import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
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
  const [pathname] = useLocation();

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
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
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
