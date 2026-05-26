import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

/**
 * Non-blocking page loader.
 *
 * Renders nothing for the first 700 ms — fast auth checks and cached chunk
 * loads complete within this window and the user never sees any loader at
 * all. Only on genuinely slow responses (cold-start serverless, slow 3G)
 * does the brand logo + spinner appear. No full-screen black overlay,
 * no marketing copy — just the premium identity at rest.
 */
export function PremiumPageLoader() {
  const [visible, setVisible] = useState(false);

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
      {/* Primary brand logo — float + glow-pulse, mirrors auth page treatment */}
      <div className="relative flex items-center justify-center">
        {/* Ambient glow behind the logo */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 220,
            height: 220,
            background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />
        <motion.img
          src="/ye-logo.png"
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
          style={{ width: "clamp(90px, 22vw, 120px)" }}
        />
      </div>

      {/* Secondary: small Tron-cyan spinner */}
      <Loader2
        className="h-5 w-5 animate-spin text-primary"
        style={{ filter: "drop-shadow(0 0 6px hsl(183 100% 60% / 0.4))" }}
        aria-hidden="true"
      />
    </div>
  );
}

export default PremiumPageLoader;
