import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useUploadInbody } from "@/hooks/use-inbody";
import { useUploadProgressPhoto } from "@/hooks/use-progress";
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
import { ConsentNote } from "@/components/ConsentNote";
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
  User as UserIcon,
  Upload,
  CheckCircle2,
  KeyRound,
  AlertCircle,
} from "lucide-react";

const clientLoginSchema = z.object({
  username: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const adminLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  area: z.string().min(2, "Area / Neighbourhood is required"),
  primaryGoal: z.enum(["fat_loss", "muscle_gain", "recomposition"], {
    errorMap: () => ({ message: "Please choose your primary goal" }),
  }),
  notes: z.string().optional(),
});

type Mode = "client-login" | "client-register" | "admin-login";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("client-login");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  // Suppress the auto-redirect while a multi-step registration flow is running
  // (account creation, InBody upload, optional progress photo). Without this,
  // the form unmounts mid-upload the moment the auth user is set.
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !submitting) {
      setLocation(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [user, submitting, setLocation]);

  // Keep the form mounted while the registration flow is finishing.
  if (user && !submitting) return null;

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
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="bg-card/80 border border-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-semibold">
              Personal Training Service
            </p>
            <h1 className="text-2xl font-display font-bold text-gradient-blue mt-1">Youssef Ahmed</h1>
            <p className="text-[11px] text-muted-foreground tracking-wide mt-2 leading-relaxed">
              Certified Personal Trainer | Physical Education Teacher | Movement & Kinesiology Specialist
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-3">
              {mode === "admin-login" ? "Admin Access" : "Client Portal"}
            </p>
          </div>

          {mode !== "admin-login" && (
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
                Client Login
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
                Create Account
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
                <RegisterForm
                  onSubmittingChange={setSubmitting}
                  onComplete={() => {
                    setSubmitting(false);
                    setLocation("/dashboard");
                  }}
                />
              )}
              {mode === "admin-login" && <AdminLoginForm />}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            {mode === "admin-login" ? (
              <button
                onClick={() => setMode("client-login")}
                data-testid="button-switch-client"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
              >
                <UserIcon size={12} /> Client login
              </button>
            ) : (
              <button
                onClick={() => setMode("admin-login")}
                data-testid="button-switch-admin"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
              >
                <ShieldCheck size={12} /> Admin login
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ClientLoginForm() {
  const { loginMutation } = useAuth();
  const [forgotOpen, setForgotOpen] = useState(false);
  const form = useForm<z.infer<typeof clientLoginSchema>>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            loginMutation.mutate({ username: d.username, password: d.password }),
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
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
                  <FormLabel>Password</FormLabel>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs text-primary hover:opacity-80"
                    data-testid="button-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
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
            Sign In
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
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
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
    toast({ title: "Check your email" });
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
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            Enter the email associated with your account. We'll send you reset instructions.
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                data-testid="button-submit-forgot"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {pending && <Loader2 className="animate-spin mr-2" size={14} />}
                Send instructions
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div
              className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground/85 leading-relaxed"
              data-testid="text-forgot-confirmation"
            >
              If an account exists with this email, password reset instructions will be sent.
            </div>
            <DialogFooter>
              <Button onClick={close} className="rounded-xl" data-testid="button-forgot-done">
                Done
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
  const form = useForm<z.infer<typeof adminLoginSchema>>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { username: "admin", password: "" },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((d) => loginMutation.mutate(d))}
        className="space-y-4"
      >
        <div className="text-xs px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary/90 mb-1">
          Admin access only. Default username: <span className="font-mono">admin</span>
        </div>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  placeholder="admin"
                  {...field}
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...field}
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
          Admin Sign In
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

const CONSENT_ITEMS: { key: ConsentKey; label: React.ReactNode }[] = [
  {
    key: "info_accurate",
    label: <>I confirm that all the information I've entered is true and accurate.</>,
  },
  {
    key: "cancellation_policy",
    label: (
      <>
        I have read and accept the{" "}
        <Link href="/policy" className="text-primary underline hover:opacity-80">
          Cancellation Policy
        </Link>
        .
      </>
    ),
  },
  {
    key: "terms_conditions",
    label: (
      <>
        I have read and accept the{" "}
        <Link href="/terms" className="text-primary underline hover:opacity-80">
          Terms & Conditions
        </Link>
        .
      </>
    ),
  },
  {
    key: "medical_fitness",
    label: (
      <>
        I confirm I'm medically fit to train and have read the{" "}
        <Link href="/medical-disclaimer" className="text-primary underline hover:opacity-80">
          Medical Disclaimer
        </Link>
        .
      </>
    ),
  },
  {
    key: "data_storage",
    label: (
      <>
        I consent to Youssef Ahmed Personal Training Service storing my personal, contact, and
        body composition data as described in the{" "}
        <Link href="/privacy" className="text-primary underline hover:opacity-80">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
];

type RegistrationStep = "idle" | "creating" | "uploading-inbody" | "uploading-photo" | "finalizing";

const STEP_MESSAGES: Record<Exclude<RegistrationStep, "idle">, string> = {
  creating: "Creating your account…",
  "uploading-inbody": "Uploading your InBody scan…",
  "uploading-photo": "Saving your starting photo…",
  finalizing: "Finalizing your profile…",
};

function RegisterForm({
  onSubmittingChange,
  onComplete,
}: {
  onSubmittingChange: (v: boolean) => void;
  onComplete: () => void;
}) {
  const { registerMutation } = useAuth();
  const uploadInbody = useUploadInbody();
  const uploadPhoto = useUploadProgressPhoto();

  const [step, setStep] = useState<1 | 2>(1);
  const [inbodyFile, setInbodyFile] = useState<File | null>(null);
  const [progressFile, setProgressFile] = useState<File | null>(null);
  const [inbodyConsent, setInbodyConsent] = useState(false);
  const [progressConsent, setProgressConsent] = useState(false);
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    info_accurate: false,
    cancellation_policy: false,
    terms_conditions: false,
    medical_fitness: false,
    data_storage: false,
  });
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>("idle");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inbodyRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "+971",
      password: "",
      area: "",
      primaryGoal: undefined as any,
      notes: "",
    },
    mode: "onTouched",
  });

  const allConsentsAccepted = CONSENT_ITEMS.every((c) => consents[c.key]);

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    setInlineError(null);
    if (!inbodyFile) {
      setInlineError("Please upload your InBody scan to continue.");
      return;
    }
    if (!inbodyConsent) {
      setInlineError("Please confirm consent to upload your InBody scan.");
      return;
    }
    if (progressFile && !progressConsent) {
      setInlineError(
        "Please confirm consent to upload your progress photo (or remove it).",
      );
      return;
    }
    if (!allConsentsAccepted) {
      setInlineError("Please review and accept all required consents to continue.");
      return;
    }

    // Tell the parent to suppress the auto-redirect until we're done.
    onSubmittingChange(true);
    setRegistrationStep("creating");

    let newUser: unknown = null;
    try {
      newUser = await registerMutation.mutateAsync({ ...values, consents } as any);
    } catch (err: any) {
      // Account creation failed — surface a friendly message and abort.
      setInlineError(
        err?.message?.includes("already")
          ? "This email is already registered. Try signing in instead."
          : "We couldn't create your account. Please review your details and try again.",
      );
      setRegistrationStep("idle");
      onSubmittingChange(false);
      return;
    }
    if (!newUser) {
      setRegistrationStep("idle");
      onSubmittingChange(false);
      return;
    }

    // Account exists. From here on, image uploads are best-effort —
    // the user is signed in and registration is considered successful.
    setRegistrationStep("uploading-inbody");
    try {
      await uploadInbody.mutateAsync({ file: inbodyFile });
    } catch {
      // The upload hook already surfaces a toast; we keep going so the
      // user reaches the dashboard and can re-upload from there.
    }

    if (progressFile) {
      setRegistrationStep("uploading-photo");
      try {
        await uploadPhoto.mutateAsync({ file: progressFile, type: "before" });
      } catch {
        /* best-effort */
      }
    }

    setRegistrationStep("finalizing");
    // Small delay so the user can see the final status before navigation.
    await new Promise((r) => setTimeout(r, 350));
    onComplete();
  }

  const isPending =
    registrationStep !== "idle" ||
    registerMutation.isPending ||
    uploadInbody.isPending ||
    uploadPhoto.isPending;

  async function handleNext() {
    const valid = await form.trigger([
      "fullName",
      "email",
      "phone",
      "password",
      "area",
    ]);
    if (valid) setStep(2);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <StepDot active={step === 1} done={step > 1} label="Account" />
          <div className="flex-1 h-px bg-white/10" />
          <StepDot active={step === 2} done={false} label="Health Info" />
        </div>

        {step === 1 && (
          <>
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
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
                    <FormLabel>Phone</FormLabel>
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
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
                  <FormLabel>Area / Neighbourhood</FormLabel>
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

            <Button
              type="button"
              onClick={handleNext}
              data-testid="button-next-step"
              className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Continue <ArrowRight size={16} className="ml-2" />
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
                  <FormLabel>Primary Goal *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger
                        data-testid="select-primary-goal"
                        className="bg-white/5 border-white/10 h-11"
                      >
                        <SelectValue placeholder="Choose your primary goal" />
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
                  <FormLabel>Notes / Injuries (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anything Youssef should know..."
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

            <FileField
              required
              label="InBody Scan (required)"
              description="JPG, PNG or PDF accepted. We'll auto-read your numbers when possible."
              file={inbodyFile}
              onChange={setInbodyFile}
              inputRef={inbodyRef}
              accept="image/*,application/pdf"
              testId="input-inbody-file"
            />
            {inbodyFile && (
              <ConsentNote
                checked={inbodyConsent}
                onChange={setInbodyConsent}
                testId="checkbox-inbody-consent"
                text="I consent to uploading this InBody scan for coaching, progress tracking, and body composition review by Youssef Fitness."
              />
            )}
            <FileField
              label="Starting Progress Photo (optional)"
              description="Helps Youssef track your transformation."
              file={progressFile}
              onChange={setProgressFile}
              inputRef={progressRef}
              accept="image/*"
              testId="input-progress-file"
            />
            {progressFile && (
              <ConsentNote
                checked={progressConsent}
                onChange={setProgressConsent}
                testId="checkbox-progress-consent"
                text="I consent to uploading this progress photo for coaching and transformation tracking. It will only be visible to me and Youssef."
              />
            )}

            {/* Required consents */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                <p className="text-xs uppercase tracking-widest text-primary/90 font-semibold">
                  Required Consents
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

            {registrationStep !== "idle" && (
              <div
                data-testid="status-registering"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary"
              >
                <Loader2 size={14} className="animate-spin shrink-0" />
                <p className="text-xs leading-relaxed">{STEP_MESSAGES[registrationStep]}</p>
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
                Back
              </Button>
              <Button
                type="submit"
                data-testid="button-submit-register"
                className="flex-1 h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isPending || !allConsentsAccepted || !inbodyFile || !inbodyConsent}
              >
                {isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                Create Account
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

function FileField({
  label,
  description,
  file,
  onChange,
  inputRef,
  accept,
  testId,
  required,
}: {
  label: string;
  description?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  accept?: string;
  testId?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        data-testid={testId}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
          file
            ? "border-primary/40 bg-primary/5"
            : "border-dashed border-white/15 bg-white/[0.02] hover:bg-white/5"
        }`}
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            file ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
          }`}
        >
          {file ? <CheckCircle2 size={18} /> : <Upload size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {file ? file.name : "Click to upload"}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </div>
  );
}
