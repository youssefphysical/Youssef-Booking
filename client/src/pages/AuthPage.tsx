import { useEffect, useMemo, useState } from "react";
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
// InBody scans, profile pictures, training level/goal and progress photos all
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
    primaryGoal: z.enum(["fat_loss", "muscle_gain", "recomposition"], {
      errorMap: () => ({ message: t("auth.errors.choosePrimaryGoal") }),
    }),
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

  useEffect(() => {
    if (user) {
      setLocation(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [user, setLocation]);

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-16 pt-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
      <div className="absolute top-0 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        <Link
          href="/"
          data-testid="link-back-home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft size={14} /> {t("auth.backToHome")}
        </Link>

        <div className="bg-card/80 border border-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-semibold">
              {t("nav.brand")}
            </p>
            <h1 className="text-2xl font-display font-bold text-gradient-blue mt-1">{t("hero.title")}</h1>
            <p className="text-[11px] text-muted-foreground tracking-wide mt-2 leading-relaxed">
              {t("hero.role")}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-3">
              {mode === "admin-login" ? t("auth.adminAccess") : t("auth.clientPortal")}
            </p>
          </div>

          {mode !== "admin-login" && !adminOnly && (
            <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setMode("client-login")}
                data-testid="tab-login"
                className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                  mode === "client-login"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("auth.tabLogin")}
              </button>
              <button
                onClick={() => setMode("client-register")}
                data-testid="tab-register"
                className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                  mode === "client-register"
                    ? "bg-primary text-primary-foreground"
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
                <RegisterForm onComplete={() => setLocation("/dashboard")} />
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
            className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
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
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
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
              <Button onClick={close} className="rounded-xl" data-testid="button-forgot-done">
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
          className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
          {t("auth.adminSignIn")}
        </Button>
      </form>
    </Form>
  );
}

type ConsentKey =
  | "info_accurate"
  | "cancellation_policy"
  | "terms_conditions"
  | "medical_fitness"
  | "data_storage";

function useConsentItems(): { key: ConsentKey; label: React.ReactNode }[] {
  const { t } = useTranslation();
  return [
    { key: "info_accurate", label: <>{t("auth.consentInfoAccurate")}</> },
    {
      key: "cancellation_policy",
      label: (
        <>
          {t("auth.consentCancellationBefore")}{" "}
          <Link href="/policy" className="text-primary underline hover:opacity-80">
            {t("auth.consentCancellationLink")}
          </Link>
          .
        </>
      ),
    },
    {
      key: "terms_conditions",
      label: (
        <>
          {t("auth.consentTermsBefore")}{" "}
          <Link href="/terms" className="text-primary underline hover:opacity-80">
            {t("auth.consentTermsLink")}
          </Link>
          .
        </>
      ),
    },
    {
      key: "medical_fitness",
      label: (
        <>
          {t("auth.consentMedicalBefore")}{" "}
          <Link href="/medical-disclaimer" className="text-primary underline hover:opacity-80">
            {t("auth.consentMedicalLink")}
          </Link>
          .
        </>
      ),
    },
    {
      key: "data_storage",
      label: (
        <>
          {t("auth.consentDataBefore")}{" "}
          <Link href="/privacy" className="text-primary underline hover:opacity-80">
            {t("auth.consentDataLink")}
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
    info_accurate: false,
    cancellation_policy: false,
    terms_conditions: false,
    medical_fitness: false,
    data_storage: false,
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
      await registerMutation.mutateAsync({ ...values, consents } as any);
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
          <div className="flex-1 h-px bg-white/10" />
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
              className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
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

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                <p className="text-xs uppercase tracking-widest text-primary/90 font-semibold">
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
                className="flex-1 h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
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
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          done
            ? "bg-primary text-primary-foreground"
            : active
            ? "bg-primary/20 text-primary border border-primary"
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
