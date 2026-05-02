import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/i18n";

const STORAGE_KEY = "yf_cookie_consent_v1";

type Prefs = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
};

export function CookieBanner() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  function persist(prefs: Omit<Prefs, "ts">) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, ts: Date.now() }));
    } catch {}
    setOpen(false);
    setShowPrefs(false);
  }

  function acceptAll() {
    persist({ essential: true, analytics: true, marketing: true });
  }

  function rejectAll() {
    persist({ essential: true, analytics: false, marketing: false });
  }

  function savePrefs() {
    persist({ essential: true, analytics, marketing });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
      data-testid="cookie-banner"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-card/95 backdrop-blur-md shadow-2xl">
        {!showPrefs ? (
          <div className="p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center shrink-0">
                <Cookie size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm sm:text-base">{t("cookie.title")}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t("cookie.body")}{" "}
                  <Link
                    href="/cookies"
                    className="text-primary underline hover:opacity-80"
                    data-testid="link-cookie-policy"
                  >
                    {t("cookie.policyLink")}
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch sm:w-44">
              <button
                onClick={acceptAll}
                data-testid="button-cookie-accept"
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 whitespace-nowrap"
              >
                {t("cookie.acceptAll")}
              </button>
              <button
                onClick={() => setShowPrefs(true)}
                data-testid="button-cookie-manage"
                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold hover:bg-white/10 whitespace-nowrap"
              >
                {t("cookie.manage")}
              </button>
              <button
                onClick={rejectAll}
                data-testid="button-cookie-reject"
                className="h-10 px-4 rounded-xl border border-white/10 text-muted-foreground text-sm font-semibold hover:text-foreground hover:bg-white/5 whitespace-nowrap"
              >
                {t("cookie.essentialOnly")}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-display font-bold text-base">{t("cookie.prefsTitle")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("cookie.prefsBody")}</p>
              </div>
              <button
                onClick={() => setShowPrefs(false)}
                aria-label={t("cookie.closeAria")}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-cookie-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <PrefRow
                title={t("cookie.prefEssential")}
                desc={t("cookie.prefEssentialDesc")}
                checked
                disabled
                onChange={() => {}}
              />
              <PrefRow
                title={t("cookie.prefAnalytics")}
                desc={t("cookie.prefAnalyticsDesc")}
                checked={analytics}
                onChange={setAnalytics}
                testId="checkbox-cookie-analytics"
              />
              <PrefRow
                title={t("cookie.prefMarketing")}
                desc={t("cookie.prefMarketingDesc")}
                checked={marketing}
                onChange={setMarketing}
                testId="checkbox-cookie-marketing"
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                onClick={rejectAll}
                className="h-10 px-4 rounded-xl border border-white/10 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 whitespace-nowrap"
                data-testid="button-cookie-reject-prefs"
              >
                {t("cookie.rejectAll")}
              </button>
              <button
                onClick={savePrefs}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 whitespace-nowrap"
                data-testid="button-cookie-save"
              >
                {t("cookie.savePrefs")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrefRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
  testId,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 ${
        disabled ? "opacity-60" : "cursor-pointer hover:bg-white/[0.07]"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
        data-testid={testId}
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </label>
  );
}
