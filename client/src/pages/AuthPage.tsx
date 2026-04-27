import { useRef, useState } from "react";
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
import { useLocation, Link } from "wouter";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  User as UserIcon,
  Upload,
  CheckCircle2,
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
  area: z.string().min(2, "Area is required"),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(7, "Emergency contact phone is required"),
  fitnessGoal: z.string().optional(),
  notes: z.string().optional(),
});

type Mode = "client-login" | "client-register" | "admin-login";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("client-login");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation(user.role === "admin" ? "/admin" : "/dashboard");
    return null;
  }

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
              Youssef Fitness
            </p>
            <h1 className="text-2xl font-display font-bold text-gradient-blue mt-1">Youssef Ahmed</h1>
            <p className="text-[11px] text-muted-foreground tracking-wide mt-2 leading-relaxed">
              Certified Personal Trainer · Physical Education Teacher · Movement & Kinesiology Specialist
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
                Sign In
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
                Register
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
              {mode === "client-register" && <RegisterForm />}
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
  const form = useForm<z.infer<typeof clientLoginSchema>>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
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

function RegisterForm() {
  const { registerMutation } = useAuth();
  const uploadInbody = useUploadInbody();
  const uploadPhoto = useUploadProgressPhoto();

  const [step, setStep] = useState<1 | 2>(1);
  const [inbodyFile, setInbodyFile] = useState<File | null>(null);
  const [progressFile, setProgressFile] = useState<File | null>(null);
  const inbodyRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      area: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      fitnessGoal: "",
      notes: "",
    },
    mode: "onTouched",
  });

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    if (!inbodyFile) {
      form.setError("root" as any, { message: "Please upload your InBody scan to continue." });
      return;
    }

    const newUser = await registerMutation.mutateAsync(values).catch(() => null);
    if (!newUser) return;

    try {
      await uploadInbody.mutateAsync({ file: inbodyFile });
    } catch {
      // toast already shown
    }
    if (progressFile) {
      try {
        await uploadPhoto.mutateAsync({ file: progressFile, type: "before" });
      } catch {}
    }
  }

  const isPending = registerMutation.isPending || uploadInbody.isPending || uploadPhoto.isPending;

  async function handleNext() {
    const valid = await form.trigger([
      "fullName",
      "email",
      "phone",
      "password",
      "area",
      "emergencyContactName",
      "emergencyContactPhone",
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
                      <Input
                        type="tel"
                        placeholder="+971 50 ..."
                        {...field}
                        data-testid="input-register-phone"
                        className="bg-white/5 border-white/10 h-11"
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
                  <FormLabel>Area / Neighbourhood (Dubai)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. JBR, Downtown, Marina..."
                      {...field}
                      data-testid="input-area"
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
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Full name"
                        {...field}
                        data-testid="input-emergency-name"
                        className="bg-white/5 border-white/10 h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+971 ..."
                        {...field}
                        data-testid="input-emergency-phone"
                        className="bg-white/5 border-white/10 h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              name="fitnessGoal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fitness Goal</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Lose 5kg, build muscle..."
                      {...field}
                      data-testid="input-fitness-goal"
                      className="bg-white/5 border-white/10 h-11"
                    />
                  </FormControl>
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
            <FileField
              label="Starting Progress Photo (optional)"
              description="Helps Youssef track your transformation."
              file={progressFile}
              onChange={setProgressFile}
              inputRef={progressRef}
              accept="image/*"
              testId="input-progress-file"
            />

            {(form.formState.errors as any).root && (
              <p className="text-xs text-destructive">
                {(form.formState.errors as any).root.message}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                data-testid="button-back-step"
                className="flex-1 h-12 rounded-xl"
              >
                Back
              </Button>
              <Button
                type="submit"
                data-testid="button-submit-register"
                className="flex-1 h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isPending}
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
