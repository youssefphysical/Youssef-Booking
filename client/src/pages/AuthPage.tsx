import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { BRAND_ASSETS } from "@/config/brandAssets";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIMARY_GOAL_OPTIONS } from "@shared/schema";
import { AreaAutocomplete } from "@/components/AreaAutocomplete";
import { PhoneInput } from "@/components/PhoneInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  AlertCircle,
} from "lucide-react";

import { PRIMARY_CTA_CLASS } from "@/lib/ui-tokens";

type T = (key: string, fallback?: string) => string;

const makeClientLoginSchema = (t: T) =>
  z.object({
    email: z.string().email(t("auth.errors.emailInvalid")),
    password: z.string().min(1, t("auth.errors.passwordRequired")),
  });

const makeAdminLoginSchema = (t: T) =>
  z.object({
    username: z.string().min(1, t("auth.errors.usernameRequired")),
    password: z.string().min(1, t("auth.errors.passwordRequired")),
  });

// Simpler registration: account basics + a primary goal + the legal consents.
// Profile pictures, training level/goal and progress photos all
// live on the dashboard / profile page now — the user can fill them in at
// their own pace after creating an account.
const makeRegisterSchema = (t: T) =>
  z.object({
    fullName: z.string().min(2, t("auth.errors.fullNameRequired")),
    email: z.string().email(t("auth.errors.emailValid")),
    phone: z.string().min(7, t("auth.errors.phoneRequired")),
    password: z.string().min(6, t("auth.errors.passwordMin")),
    area: z.string().min(2, t("auth.errors.areaRequired")),
    weeklyFrequency: z.coerce
      .number({ invalid_type_error: t("auth.errors.chooseFrequency") })
      .int()
      .min(1, t("auth.errors.chooseFrequency"))
      .max(6),
    primaryGoal: z.enum(
      ["fat_loss", "muscle_gain", "recomposition", "general_fitness"],
      { errorMap: () => ({ message: t("auth.errors.choosePrimaryGoal") }) },
    ),
    notes: z.string().optional(),
  });

type ClientLoginValues = z.infer<ReturnType<typeof makeClientLoginSchema>>;
type AdminLoginValues = z.infer<ReturnType<typeof makeAdminLoginSchema>>;
type RegisterValues = z.infer<ReturnType<typeof makeRegisterSchema>>;

type Mode = "client-login" | "client-register" | "admin-login";

export default function AuthPage({
  initialMode = "client-login",
  adminOnly = false,
}: {
  initialMode?: Mode;
  adminOnly?: boolean;
} = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { data: authSettings, isLoading: settingsLoading } = useSettings();

  // ── Auth logo — zero-localStorage approach ───────────────────────────────
  // index.html boots a fetch("/api/settings") at HTML parse time.  The result
  // lands in window.__YE_INITIAL_SETTINGS__ and useSettings() exposes it via
  // initialData — so on fast networks authSettings is already non-null on the
  // very first React render and logoSrc is known before this component paints.
  //
  // Read the window global synchronously (useState initializer) as a fallback
  // for the rare case where the boot fetch resolves before React mounts but
  // after useSettings()'s initialData function ran.
  // Canonical auth logo — single source of truth (BRAND_ASSETS.logoAuth).
  const AUTH_CANONICAL_LOGO = BRAND_ASSETS.logoAuth;
  // Paths that resolve to the canonical file — dynamic timestamp would create a
  // different SW cache entry and could serve stale content from an old SW cache.
  const AUTH_CANONICAL_PATHS = [
    "/brand-logo.png", "/ye-logo.png",
    "/ye-logo-horizontal.png", "/ye-logo-primary.png",
  ];

  // Cache-bust helper — returns the fixed canonical URL for the canonical logo
  // files; appends ?v=<updatedAt ms> for custom /uploads/ paths so browsers
  // re-fetch after admin logo uploads.
  function authBustUrl(url: string | null, updatedAt: unknown): string | null {
    if (!url) return null;
    if (AUTH_CANONICAL_PATHS.includes(url)) return AUTH_CANONICAL_LOGO;
    const v = updatedAt ? new Date(updatedAt as string).getTime() : NaN;
    if (!v || isNaN(v)) return url;
    return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
  }

  const [bootLogoUrl] = useState<string | null>(() => {
    try {
      const s = (window as any).__YE_INITIAL_SETTINGS__;
      // No window global yet (cold load before boot fetch resolves) →
      // use the canonical logo so the auth card never shows a blank slot.
      if (!s) return AUTH_CANONICAL_LOGO;
      const raw = (s as any).logoLoginUrl || (s as any).logoAuthUrl || (s as any).logoIconUrl || null;
      return authBustUrl(raw, (s as any).updatedAt);
    } catch { return AUTH_CANONICAL_LOGO; }
  });

  // Priority: fresh settings (authoritative) → boot global (fast-network warm load) → null
  // Cache-bust appended so browsers re-fetch after admin logo uploads.
  const ua = (authSettings as any)?.updatedAt;
  const logoSrc: string | null = authSettings
    ? authBustUrl((authSettings as any).logoLoginUrl || (authSettings as any).logoAuthUrl || (authSettings as any).logoIconUrl || null, ua)
    : bootLogoUrl;

  // Gate: card entrance is held until we know the logo state.
  //   • fast network → authSettings already set (initialData) → isCardReady=true immediately
  //   • slow network → wait until settingsLoading=false (logo appears once settings arrive)
  // This prevents the card from ever appearing with an empty logo slot.
  const isCardReady = !!logoSrc || !settingsLoading;

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      setLocation("/admin");
    } else {
      setLocation(user.isVerified ? "/dashboard" : "/wizard");
    }
  }, [user, setLocation]);

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-16 pt-24 relative overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
      {/* Ambient cyan orbs */}
      <div className="absolute top-0 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      {/* Subtle Tron circuit grid — 5 % opacity, luxury not gaming */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full"
        style={{ opacity: 0.05 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="auth-circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            {/* Grid lines */}
            <path d="M80 0 L0 0 0 80" fill="none" stroke="hsl(183 100% 74%)" strokeWidth="0.5" />
            {/* HUD corner accent */}
            <path d="M0 0 L12 0 M0 0 L0 12" fill="none" stroke="hsl(183 100% 74%)" strokeWidth="1.2" />
            <path d="M80 80 L68 80 M80 80 L80 68" fill="none" stroke="hsl(183 100% 74%)" strokeWidth="1.2" />
            {/* Circuit dot nodes */}
            <circle cx="40" cy="40" r="1.2" fill="hsl(183 100% 74%)" />
            <circle cx="0"  cy="40" r="0.8" fill="hsl(183 100% 74%)" />
            <circle cx="40" cy="0"  r="0.8" fill="hsl(183 100% 74%)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-circuit)" />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isCardReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-lg"
      >
        <Link
          href="/"
          data-testid="link-back-home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft size={14} /> {t("auth.backToHome")}
        </Link>

        {/* Card with neon cyber-corner accents */}
        <div className="relative overflow-hidden bg-card/80 border border-primary/15 backdrop-blur-md rounded-3xl px-6 pb-6 pt-3 sm:px-8 sm:pb-7 sm:pt-4 shadow-2xl"
          style={{ boxShadow: "0 0 40px rgba(0,212,255,0.08), 0 25px 60px rgba(0,0,0,0.5)" }}
        >
          {/* Cyan hairline top accent — Tron HUD signature */}
          <CyanHairline intensity="hero" inset="inset-x-8" />
          {/* Soft cyan corner halo */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-50"
            style={{
              background:
                "radial-gradient(circle, hsl(183 100% 60% / 0.15), transparent 70%)",
            }}
          />
          {/* Neon cyber corner — top-left */}
          <span aria-hidden className="pointer-events-none absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary/40 rounded-tl-3xl" />
          {/* Neon cyber corner — top-right */}
          <span aria-hidden className="pointer-events-none absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary/40 rounded-tr-3xl" />
          {/* Neon cyber corner — bottom-left */}
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary/40 rounded-bl-3xl" />
          {/* Neon cyber corner — bottom-right */}
          <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary/40 rounded-br-3xl" />

          {/* ── HERO LOGO AREA ─────────────────────────────────────────── */}
          {/* Three states:
              1. cold load only (no cache + still fetching) → transparent spacer (card hidden by isCardReady)
              2. logoSrc known (cache hit OR fresh settings) → logo with contain sizing, auto height
              3. loaded, no custom logo → premium "YE" text mark
              py-10/py-14 gives 40–56px padding so the logo breathes.
              minHeight comes from --brand-login-min-hero-h (default 280px) set by Media Manager.
              maxHeight is intentionally absent from <img> — the container min-height creates space,
              the logo auto-sizes based on its aspect ratio within its maxWidth constraint. */}
          <div
            data-testid="container-auth-logo"
            className="relative flex flex-col items-center justify-center py-10 sm:py-14"
            style={{ minHeight: "max(var(--brand-login-min-hero-h, 280px), 220px)" }}
          >
            {/* Ambient glow — always present */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(0,212,255,0.10) 0%, transparent 70%)",
                filter: "blur(28px)",
              }}
            />

            {/* STATE 1: cold load only — transparent spacer so card has some height before logo loads.
                The card entrance is held at opacity:0 by isCardReady so the user never sees this. */}
            {settingsLoading && !logoSrc && (
              <div
                aria-hidden
                data-testid="skeleton-auth-logo"
                style={{ width: "60%", maxWidth: "240px", height: "80px" }}
              />
            )}

            {/* STATE 2: logo known — first paint on warm loads (localStorage cache),
                API response on cold loads. key= triggers clean remount when URL changes. */}
            {logoSrc && (
              <>
                {/* Mobile — max 75% card width, max 160px tall */}
                <div
                  className="relative sm:hidden"
                  style={{
                    width: "75%",
                    maxWidth: "var(--brand-login-w-mobile, 260px)",
                    transform: "scale(var(--brand-login-zoom, 1.0)) translateY(var(--brand-login-vpos, 0px))",
                    transformOrigin: "center center",
                  }}
                >
                  <motion.img
                    key={logoSrc}
                    src={logoSrc}
                    alt="Youssef Elite"
                    data-testid="img-auth-logo"
                    loading="eager"
                    decoding="sync"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                    animate={{
                      y: [0, -4, 0],
                      filter: [
                        "drop-shadow(0 0 18px rgba(0,212,255,0.50))",
                        "drop-shadow(0 0 26px rgba(0,212,255,0.68))",
                        "drop-shadow(0 0 18px rgba(0,212,255,0.50))",
                      ],
                    }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ objectFit: "contain", width: "100%", height: "auto", display: "block" }}
                  />
                </div>
                {/* Desktop — max 60% card width, height auto (container min-height creates space) */}
                <div
                  className="relative hidden sm:block"
                  style={{
                    width: "60%",
                    maxWidth: "var(--brand-login-w-desktop, 320px)",
                    transform: "scale(var(--brand-login-zoom, 1.0)) translateY(var(--brand-login-vpos, 0px))",
                    transformOrigin: "center center",
                  }}
                >
                  <motion.img
                    key={`${logoSrc}-desktop`}
                    src={logoSrc}
                    alt="Youssef Elite"
                    aria-hidden="true"
                    loading="eager"
                    decoding="sync"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                    animate={{
                      y: [0, -4, 0],
                      filter: [
                        "drop-shadow(0 0 18px rgba(0,212,255,0.50))",
                        "drop-shadow(0 0 26px rgba(0,212,255,0.68))",
                        "drop-shadow(0 0 18px rgba(0,212,255,0.50))",
                      ],
                    }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ objectFit: "contain", width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              </>
            )}

            {/* STATE 3: loaded, no custom logo — premium text mark */}
            {!settingsLoading && !logoSrc && (
              <p
                data-testid="text-auth-logo-fallback"
                className="font-display font-black tracking-[0.12em] text-primary"
                style={{ fontSize: "clamp(32px, 10vw, 52px)", lineHeight: 1 }}
              >
                YE
              </p>
            )}
          </div>

          {mode !== "admin-login" && !adminOnly && (
            <div className="relative grid grid-cols-2 gap-2 mb-6 p-1 bg-background/60 border border-primary/15 rounded-xl backdrop-blur-sm">
              <button
                onClick={() => setMode("client-login")}
                data-testid="tab-login"
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  mode === "client-login"
                    ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(183_100%_55%_/_0.55)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("auth.tabLogin")}
              </button>
              <button
                onClick={() => setMode("client-register")}
                data-testid="tab-register"
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  mode === "client-register"
                    ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(183_100%_55%_/_0.55)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("auth.tabRegister")}
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {mode === "client-login" && <ClientLoginForm />}
              {mode === "client-register" && (
                <RegisterForm onComplete={() => setLocation("/")} />
              )}
              {mode === "admin-login" && <AdminLoginForm />}
            </motion.div>
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}

function ClientLoginForm() {
  const { loginMutation } = useAuth();
  const { t } = useTranslation();
  const [forgotOpen, setForgotOpen] = useState(false);
  const schema = useMemo(() => makeClientLoginSchema(t), [t]);
  const form = useForm<ClientLoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            loginMutation.mutate({ username: d.email, password: d.password }),
          )}
          className="space-y-4"
          autoComplete="on"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    {...field}
                    name="email"
                    id="login-email"
                    data-testid="input-email"
                    className="bg-white/5 border-white/10 h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs text-primary hover:opacity-80"
                    data-testid="button-forgot-password"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                    name="password"
                    id="login-password"
                    data-testid="input-password"
                    className="bg-white/5 border-white/10 h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            data-testid="button-submit-login"
            className={`w-full h-12 rounded-xl font-bold ${PRIMARY_CTA_CLASS}`}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
            {t("auth.signIn")}
          </Button>
        </form>
      </Form>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

function ForgotPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setPending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
    } catch {
      // Even on network error, show the same friendly state.
    }
    setPending(false);
    setSubmitted(true);
    toast({ title: t("auth.checkYourEmail") });
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setEmail("");
      setError(null);
    }, 200);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center mb-2">
            <KeyRound size={18} />
          </div>
          <DialogTitle>{t("auth.resetTitle")}</DialogTitle>
          <DialogDescription>
            {t("auth.resetBody")}
          </DialogDescription>
        </DialogHeader>

        {!submitted ? (
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-forgot-email"
              className="bg-white/5 border-white/10 h-11"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={close} className="rounded-xl">
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={pending}
                data-testid="button-submit-forgot"
                className={`rounded-xl ${PRIMARY_CTA_CLASS}`}
              >
                {pending && <Loader2 className="animate-spin mr-2" size={14} />}
                {t("auth.sendInstructions")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div
              className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground/85 leading-relaxed"
              data-testid="text-forgot-confirmation"
            >
              {t("auth.resetSent")}
            </div>
            <DialogFooter>
              <Button
                onClick={close}
                className={`rounded-xl ${PRIMARY_CTA_CLASS}`}
                data-testid="button-forgot-done"
              >
                {t("auth.done")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminLoginForm() {
  const { loginMutation } = useAuth();
  const { t } = useTranslation();
  const schema = useMemo(() => makeAdminLoginSchema(t), [t]);
  const form = useForm<AdminLoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "admin", password: "" },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((d) => loginMutation.mutate(d))}
        className="space-y-4"
      >
        <div className="text-xs px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary/90 mb-1">
          {t("auth.adminOnlyHint")} <span className="font-mono">admin</span>
        </div>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.username")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="admin"
                  autoComplete="username"
                  {...field}
                  name="username"
                  id="admin-username"
                  data-testid="input-admin-username"
                  className="bg-white/5 border-white/10 h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.password")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...field}
                  name="password"
                  id="admin-password"
                  data-testid="input-admin-password"
                  className="bg-white/5 border-white/10 h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          data-testid="button-submit-admin-login"
          className={`w-full h-12 rounded-xl font-bold ${PRIMARY_CTA_CLASS}`}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
          {t("auth.adminSignIn")}
        </Button>
        {loginMutation.isError && (
          <p
            role="alert"
            className="text-xs text-destructive text-center"
            data-testid="error-admin-login"
          >
            {(loginMutation.error as Error)?.message || "Invalid credentials. Please try again."}
          </p>
        )}
      </form>
    </Form>
  );
}

// Collapsed to a single consent that covers Terms, Cancellation Policy,
// Privacy Policy, and Medical Disclaimer. The server still records every
// underlying consent item below for audit purposes.
type ConsentKey = "agree_all";

const ALL_CONSENT_ITEMS: ConsentKey[] = ["agree_all"];
const RECORDED_CONSENT_ITEMS = [
  "info_accurate",
  "cancellation_policy",
  "terms_conditions",
  "medical_fitness",
  "data_storage",
] as const;

function useConsentItems(): { key: ConsentKey; label: React.ReactNode }[] {
  const { t } = useTranslation();
  return [
    {
      key: "agree_all",
      label: (
        <>
          {t("auth.consentAgreeBefore")}{" "}
          <Link href="/terms" className="text-primary hover:opacity-80">
            {t("auth.consentTermsLink")}
          </Link>
          {", "}
          <Link href="/policy" className="text-primary hover:opacity-80">
            {t("auth.consentCancellationLink")}
          </Link>
          {", "}
          <Link href="/privacy" className="text-primary hover:opacity-80">
            {t("auth.consentDataLink")}
          </Link>
          {" "}
          {t("auth.consentAgreeAnd")}{" "}
          <Link href="/medical-disclaimer" className="text-primary hover:opacity-80">
            {t("auth.consentMedicalLink")}
          </Link>
          .
        </>
      ),
    },
  ];
}

function RegisterForm({ onComplete }: { onComplete: () => void }) {
  const { registerMutation } = useAuth();
  const { t } = useTranslation();
  const CONSENT_ITEMS = useConsentItems();
  const [step, setStep] = useState<1 | 2>(1);
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    agree_all: false,
  });
  const [inlineError, setInlineError] = useState<string | null>(null);

  const registerSchema = useMemo(() => makeRegisterSchema(t), [t]);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "+971",
      password: "",
      area: "",
      weeklyFrequency: undefined as any,
      primaryGoal: undefined as any,
      notes: "",
    },
    mode: "onTouched",
  });

  const allConsentsAccepted = CONSENT_ITEMS.every((c) => consents[c.key]);

  async function onSubmit(values: RegisterValues) {
    setInlineError(null);
    if (!allConsentsAccepted) {
      setInlineError(t("auth.errAcceptAll"));
      return;
    }

    try {
      // Map the single agree-all checkbox onto every underlying consent item
      // so the existing audit trail stays intact.
      const expandedConsents = RECORDED_CONSENT_ITEMS.reduce(
        (acc, k) => ({ ...acc, [k]: consents.agree_all }),
        {} as Record<string, boolean>,
      );
      await registerMutation.mutateAsync({ ...values, consents: expandedConsents } as any);
    } catch (err: any) {
      setInlineError(
        err?.message?.includes("already")
          ? t("auth.errEmailExists")
          : t("auth.errGeneric"),
      );
      return;
    }
    onComplete();
  }

  const isPending = registerMutation.isPending;

  async function handleNext() {
    const valid = await form.trigger([
      "fullName",
      "email",
      "phone",
      "password",
      "area",
      "weeklyFrequency",
    ]);
    if (valid) setStep(2);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <StepDot active={step === 1} done={step > 1} label={t("auth.stepAccount")} />
          {/* Connector fills with cyan once step 1 is complete — gives a
              subliminal "you're moving forward" cue without animation. */}
          <div
            className="flex-1 h-px"
            style={{
              background:
                step > 1
                  ? "linear-gradient(90deg, hsl(183 100% 70% / 0.6), hsl(183 100% 70% / 0.25))"
                  : "rgba(255,255,255,0.1)",
            }}
            aria-hidden="true"
          />
          <StepDot active={step === 2} done={false} label={t("auth.stepGoals")} />
        </div>

        {step === 1 && (
          <>
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.fullName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("auth.fullNamePlaceholder")}
                      {...field}
                      data-testid="input-fullname"
                      className="bg-white/5 border-white/10 h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                        {...field}
                        name="email"
                        id="register-email"
                        data-testid="input-register-email"
                        className="bg-white/5 border-white/10 h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.phone")}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        testId="input-register-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                      name="password"
                      id="register-password"
                      data-testid="input-register-password"
                      className="bg-white/5 border-white/10 h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.area")}</FormLabel>
                  <FormControl>
                    <AreaAutocomplete
                      value={field.value || ""}
                      onChange={field.onChange}
                      testId="input-area"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="weeklyFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.weeklyFrequency")}</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger
                        data-testid="select-weekly-frequency"
                        className="bg-white/5 border-white/10 h-11"
                      >
                        <SelectValue placeholder={t("auth.weeklyFrequencyPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">{t("auth.freq1")}</SelectItem>
                      <SelectItem value="2">{t("auth.freq2")}</SelectItem>
                      <SelectItem value="3">{t("auth.freq3")}</SelectItem>
                      <SelectItem value="4">{t("auth.freq4")}</SelectItem>
                      <SelectItem value="5">{t("auth.freq5")}</SelectItem>
                      <SelectItem value="6">{t("auth.freq6")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-white/50 mt-1">{t("auth.weeklyFrequencyHelp")}</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              onClick={handleNext}
              data-testid="button-next-step"
              className={`w-full h-12 rounded-xl font-bold ${PRIMARY_CTA_CLASS}`}
            >
              {t("auth.continue")} <ArrowRight size={16} className="ml-2" />
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <FormField
              control={form.control}
              name="primaryGoal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.primaryGoal")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger
                        data-testid="select-primary-goal"
                        className="bg-white/5 border-white/10 h-11"
                      >
                        <SelectValue placeholder={t("auth.primaryGoalPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIMARY_GOAL_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          data-testid={`option-goal-${opt.value}`}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("auth.notesPlaceholder")}
                      {...field}
                      rows={2}
                      data-testid="input-notes"
                      className="bg-white/5 border-white/10"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-xs leading-relaxed text-muted-foreground"
              data-testid="hint-after-register"
            >
              <p className="text-foreground/85 font-medium mb-1">{t("auth.afterSignupTitle")}</p>
              {t("auth.afterSignUpBody")}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {/* Cinematic cyan top hairline — same HUD signature as the
                  rest of the client journey. Decorative only. */}
              <CyanHairline />
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                <p className="tron-eyebrow text-[10px] font-semibold">
                  {t("auth.requiredConsents")}
                </p>
              </div>
              {CONSENT_ITEMS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-start gap-3 cursor-pointer"
                  data-testid={`label-consent-${c.key}`}
                >
                  <Checkbox
                    checked={consents[c.key]}
                    onCheckedChange={(v) =>
                      setConsents((s) => ({ ...s, [c.key]: v === true }))
                    }
                    data-testid={`checkbox-consent-${c.key}`}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">{c.label}</span>
                </label>
              ))}
            </div>

            {inlineError && (
              <div
                role="alert"
                data-testid="text-register-error"
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">{inlineError}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                data-testid="button-back-step"
                className="flex-1 h-12 rounded-xl"
                disabled={isPending}
              >
                {t("common.back")}
              </Button>
              <Button
                type="submit"
                data-testid="button-submit-register"
                className={`flex-1 h-12 rounded-xl font-bold ${PRIMARY_CTA_CLASS}`}
                disabled={isPending || !allConsentsAccepted}
              >
                {isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                {t("auth.createAccount")}
              </Button>
            </div>
          </>
        )}
      </form>
    </Form>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  // Premium HUD step indicator. Cyan glow only on the live or completed
  // step so the eye is drawn to forward motion — never to inactive chrome.
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          done
            ? "bg-primary text-primary-foreground shadow-[0_0_14px_-3px_hsl(183_100%_60%/0.55)]"
            : active
            ? "bg-primary/15 text-primary border border-primary/70 shadow-[0_0_14px_-4px_hsl(183_100%_60%/0.5)]"
            : "bg-white/5 text-muted-foreground border border-white/10"
        }`}
      >
        {done ? <CheckCircle2 size={14} /> : label[0]}
      </div>
      <span
        className={`text-xs font-medium ${
          active || done ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
