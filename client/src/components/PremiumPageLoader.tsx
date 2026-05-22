import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

const COPY_KEYS = ["loading.experience", "loading.transformation"] as const;
const FALLBACKS: Record<typeof COPY_KEYS[number], string> = {
  "loading.experience": "Loading your fitness experience…",
  "loading.transformation": "Preparing your transformation…",
};

/**
 * Premium page-level loader (Task #71).
 * Standardises chunk-load / auth-bootstrapping screens with Loader2 + rotating
 * premium copy so cold starts feel intentional rather than blank. The copy
 * line is picked once per mount (deterministic during the same loading flash,
 * but alternates across navigations).
 */
export function PremiumPageLoader() {
  const { t } = useTranslation();
  const key = useMemo(
    () => COPY_KEYS[Math.floor(Math.random() * COPY_KEYS.length)],
    [],
  );
  const copy = t(key, FALLBACKS[key]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-4 px-6"
      data-testid="page-loader"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-9 w-9 animate-spin text-primary"
        style={{ filter: "drop-shadow(0 0 10px hsl(183 100% 60% / 0.45))" }}
        aria-hidden="true"
      />
      <p
        className="text-sm text-white/70 text-center max-w-xs leading-relaxed"
        data-testid="text-page-loader-copy"
      >
        {copy}
      </p>
    </div>
  );
}

export default PremiumPageLoader;
