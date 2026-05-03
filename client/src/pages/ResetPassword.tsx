import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Read the token once on mount, then immediately scrub it from the URL so
  // it doesn't leak via copy/paste, browser history, or analytics referrers.
  const [token, setToken] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (t) {
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setError(t("auth.resetInvalidToken", "This reset link is invalid or has expired."));
  }, [token, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t("auth.passwordTooShort", "Password must be at least 6 characters."));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordsDoNotMatch", "Passwords do not match."));
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || t("auth.resetInvalidToken", "This reset link is invalid or has expired."));
        return;
      }
      setDone(true);
      toast({ title: t("auth.resetSuccessTitle", "Password updated") });
    } catch {
      setError(t("auth.networkError", "Network error. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card/60 backdrop-blur p-6 shadow-lg">
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center mb-3">
          {done ? <CheckCircle2 size={20} /> : <KeyRound size={18} />}
        </div>
        <h1 className="text-xl font-semibold mb-1" data-testid="text-reset-title">
          {done
            ? t("auth.resetSuccessTitle", "Password updated")
            : t("auth.resetNewTitle", "Choose a new password")}
        </h1>
        <p className="text-sm text-foreground/70 mb-5">
          {done
            ? t("auth.resetSuccessBody", "Your password has been changed. You can now sign in.")
            : t("auth.resetNewBody", "Pick a strong password you don't use elsewhere.")}
        </p>

        {!done ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pw">{t("auth.newPassword", "New password")}</Label>
              <Input
                id="reset-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!token || pending}
                data-testid="input-reset-password"
                className="bg-white/5 border-white/10 h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-pw2">{t("auth.confirmPassword", "Confirm password")}</Label>
              <Input
                id="reset-pw2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!token || pending}
                data-testid="input-reset-password-confirm"
                className="bg-white/5 border-white/10 h-11"
              />
            </div>
            {error && (
              <p className="text-xs text-destructive" data-testid="text-reset-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={!token || pending}
              data-testid="button-reset-submit"
              className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 h-11"
            >
              {pending && <Loader2 className="animate-spin mr-2" size={14} />}
              {t("auth.resetSubmit", "Update password")}
            </Button>
          </form>
        ) : (
          <Button
            onClick={() => navigate("/auth")}
            className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 h-11"
            data-testid="button-reset-go-signin"
          >
            {t("auth.goToSignIn", "Go to sign in")}
          </Button>
        )}
      </div>
    </div>
  );
}
