import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

/**
 * Non-blocking page loader.
 *
 * Renders nothing for the first 700 ms — fast auth checks and cached chunk
 * loads complete within this window and the user never sees any loader at all.
 * Only on genuinely slow responses (cold-start serverless, slow 3G) does the
 * brand logo + spinner appear.
 *
 * Respects:
 *  - settings.logoSplashUrl      — dedicated splash slot (Media Manager → Splash Screen Logo)
 *  - settings.logoIconUrl        — fallback when no splash logo uploaded
 *  - settings.brandSettings.logoShowLoading — visibility toggle from Logo Manager
 *
 * Uses the shared useSettings() cache so logo changes after an admin upload
 * propagate immediately (no independent staleTime).
 */
export function PremiumPageLoader() {
  const [visible, setVisible] = useState(false);
  const { data: settings } = useSettings();

  const bs          = (settings?.brandSettings ?? {}) as Record<string, number>;
  const logoSrc     = settings?.logoSplashUrl || settings?.logoIconUrl || "/ye-logo.png";
  const showLoading = (bs.logoShowLoading ?? 1) !== 0;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="flex flex-col items-center justify-center w-full py-24 gap-5"
      data-testid="page-loader"
      role="status"
      aria-label="Loading"
    >
      {showLoading && (
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 220, height: 220,
              background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
          />
          <motion.img
            src={logoSrc}
            alt="Youssef Elite"
            aria-hidden="true"
            animate={{
              y: [0, -3, 0],
              filter: [
                "drop-shadow(0 0 14px rgba(0,212,255,0.40))",
                "drop-shadow(0 0 20px rgba(0,212,255,0.58))",
                "drop-shadow(0 0 14px rgba(0,212,255,0.40))",
              ],
            }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative object-contain"
            style={{ width: "var(--brand-splash-w-desktop, clamp(90px, 22vw, 120px))" }}
          />
        </div>
      )}
      <Loader2 size={16} className="animate-spin text-primary/50" />
    </div>
  );
}
