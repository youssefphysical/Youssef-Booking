import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Sticky banner shown whenever the browser reports the network is down.
 * Pairs with `useDraft` so users can keep typing — the next save will
 * flush to the server once `online` fires.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="banner-offline"
      className="sticky top-0 z-[60] w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
      style={{
        background: "#1a1304",
        color: "#facc15",
        borderBottom: "1px solid rgba(250, 204, 21, 0.3)",
      }}
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      You're offline — anything you type is saved locally and will sync when you're back.
    </div>
  );
}
