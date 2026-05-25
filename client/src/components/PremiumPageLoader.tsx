import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Non-blocking page loader.
 *
 * Renders nothing for the first 700 ms — fast auth checks and cached chunk
 * loads complete within this window and the user never sees any loader at
 * all. Only on genuinely slow responses (cold-start serverless, slow 3G)
 * does a small centred spinner appear. No full-screen black overlay,
 * no marketing copy.
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
      className="flex items-center justify-center w-full py-24"
      data-testid="page-loader"
      role="status"
      aria-label="Loading"
    >
      <Loader2
        className="h-7 w-7 animate-spin text-primary"
        style={{ filter: "drop-shadow(0 0 8px hsl(183 100% 60% / 0.4))" }}
        aria-hidden="true"
      />
    </div>
  );
}

export default PremiumPageLoader;
