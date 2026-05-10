import { useEffect, useState } from "react";
import { Download, X, Zap } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa";

/**
 * InstallPrompt — premium AMOLED in-app install card.
 *
 * Anchored bottom-center on mobile (above the cookie banner if visible
 * by stacking order — banner is dismissed once and rarely co-exists),
 * bottom-right on tablet+. Animates in 0.6s after capture so it never
 * fights with the LCP paint of the homepage hero.
 *
 * Shows ONLY when:
 *   - browser has a deferred install prompt (Chromium/Edge/Samsung)
 *   - app is not already installed (display-mode: standalone)
 *   - user hasn't dismissed within the 14-day TTL
 *
 * iOS Safari does NOT fire beforeinstallprompt, so this card never
 * shows on iPhone — that's intentional. iOS users get the system
 * Share → Add to Home Screen flow, which is the platform-native path.
 */
export function InstallPrompt() {
  const { canPrompt, promptInstall, dismiss } = useInstallPrompt();
  const [visible, setVisible] = useState(false);

  // Soft delay so the card never lands during the LCP frame and never
  // races a route transition. Reset if canPrompt flips back to false.
  useEffect(() => {
    if (!canPrompt) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(t);
  }, [canPrompt]);

  if (!canPrompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Youssef App"
      aria-live="polite"
      className={[
        "fixed z-[120] left-1/2 -translate-x-1/2",
        // Sit above the mobile bottom nav / safe-area on phones,
        // bottom-right on tablet+.
        "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
        "sm:left-auto sm:right-5 sm:translate-x-0 sm:bottom-5",
        "w-[min(92vw,380px)]",
        "transition-all duration-300 ease-out",
        visible
          ? "opacity-100 translate-y-0 sm:translate-x-0"
          : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
      data-testid="pwa-install-prompt"
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050505]/95 backdrop-blur-xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(94,231,255,0.15)] p-4"
      >
        {/* Subtle cyan glow header strip — Tron seam */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute top-2 end-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          data-testid="button-install-dismiss"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pe-6">
          <div className="shrink-0 size-10 rounded-xl bg-primary/10 border border-primary/30 grid place-items-center text-primary">
            <Download size={18} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] leading-tight text-foreground">
              Install Youssef App
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              Faster booking. Full-screen experience. Instant access.
            </p>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="h-9 rounded-xl border border-white/10 text-[13px] font-medium text-foreground hover:bg-white/5 hover:border-white/20 transition-colors"
            data-testid="button-install-later"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => { void promptInstall(); }}
            className="h-9 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-primary/90 shadow-[0_0_0_1px_hsl(195_100%_60%/0.45),0_8px_24px_-8px_hsl(195_100%_60%/0.6)] transition-shadow"
            data-testid="button-install-confirm"
          >
            <Zap size={13} className="shrink-0" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
