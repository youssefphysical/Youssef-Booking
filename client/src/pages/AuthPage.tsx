import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { Loader2, ArrowLeft, ShieldCheck, User as UserIcon } from "lucide-react";

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
        className="relative w-full max-w-md"
      >
        <Link href="/" data-testid="link-back-home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="bg-card/80 border border-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-bold text-gradient-gold">Youssef Tarek</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
              {mode === "admin-login" ? "Admin Access" : "Client Portal"}
            </p>
          </div>

          {/* Tabs (only for client area) */}
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
        onSubmit={form.handleSubmit((d) => loginMutation.mutate({ username: d.username, password: d.password }))}
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
      <form onSubmit={form.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
        <div className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/80 mb-1">
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
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", fitnessGoal: "", notes: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} data-testid="input-fullname" className="bg-white/5 border-white/10 h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} data-testid="input-register-email" className="bg-white/5 border-white/10 h-11" />
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
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+971 50 ..." {...field} data-testid="input-register-phone" className="bg-white/5 border-white/10 h-11" />
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
                <Input type="password" placeholder="••••••••" {...field} data-testid="input-register-password" className="bg-white/5 border-white/10 h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fitnessGoal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fitness Goal</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Lose 5kg, build muscle..." {...field} data-testid="input-fitness-goal" className="bg-white/5 border-white/10 h-11" />
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
        <Button
          type="submit"
          data-testid="button-submit-register"
          className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
          Create Account
        </Button>
      </form>
    </Form>
  );
}
