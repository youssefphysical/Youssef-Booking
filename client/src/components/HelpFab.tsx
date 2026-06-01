import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

const SCROLL_IDLE_MS = 600;

export function HelpFab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pathname] = useLocation();
  const [isScrolling, setIsScrolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsScrolling(false), SCROLL_IDLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (user?.role !== "client") return null;

  const hidden = HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const isRtl =
    typeof document !== "undefined" && document.documentElement.dir === "rtl";

  const href = whatsappUrl(DEFAULT_WHATSAPP_NUMBER, t("fab.help.message"));
  const label = t("fab.help.aria");

  const scrollEdgeShift = isRtl ? -6 : 6;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.a
          key="help-fab"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          data-testid="fab-help-coach"
          className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/40 bg-black/70 text-cyan-200 shadow-[0_0_24px_rgba(94,231,255,0.45)] backdrop-blur-md hover:border-cyan-300/80 hover:text-cyan-100 hover:shadow-[0_0_32px_rgba(94,231,255,0.7)] active:scale-95"
          style={{
            bottom: "var(--fab-bottom, calc(env(safe-area-inset-bottom, 0px) + 90px))",
            ...(isRtl
              ? { left: "calc(env(safe-area-inset-left, 0px) + 1rem)" }
              : { right: "calc(env(safe-area-inset-right, 0px) + 1rem)" }),
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: isScrolling ? 0.45 : 1,
            x: isScrolling ? scrollEdgeShift : 0,
          }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{
            scale: { type: "spring", stiffness: 380, damping: 28 },
            opacity: { type: "spring", stiffness: 260, damping: 32 },
            x: { type: "spring", stiffness: 260, damping: 32 },
          }}
        >
          <MessageCircle size={22} aria-hidden />
        </motion.a>
      )}
    </AnimatePresence>
  );
}

export default HelpFab;
