import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import { Loader2, User as UserIcon } from "lucide-react";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useMutation } from "@tanstack/react-query";

const schema = z.object({
  fullName: z.string().min(2, "Required"),
  phone: z.string().min(7, "Required"),
  email: z.string().email("Valid email required"),
  fitnessGoal: z.string().optional(),
  notes: z.string().optional(),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 6, { message: "Password must be at least 6 characters" }),
});

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      fitnessGoal: user?.fitnessGoal ?? "",
      notes: user?.notes ?? "",
      password: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      if (!user) throw new Error("Not signed in");
      const url = buildUrl(api.users.update.path, { id: user.id });
      const payload: Record<string, unknown> = {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        fitnessGoal: data.fitnessGoal || null,
        notes: data.notes || null,
      };
      if (data.password) payload.password = data.password;
      const res = await apiRequest("PATCH", url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Profile updated" });
      form.setValue("password", "");
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-24 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <UserIcon size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold" data-testid="text-profile-name">
            {user.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-card/60 p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))}
            className="space-y-4"
          >
            <Field form={form} name="fullName" label="Full Name" testId="input-profile-fullname" />
            <Field form={form} name="email" label="Email" testId="input-profile-email" type="email" />
            <Field form={form} name="phone" label="Phone" testId="input-profile-phone" />
            <Field form={form} name="fitnessGoal" label="Fitness Goal" testId="input-profile-goal" />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Injuries</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      data-testid="input-profile-notes"
                      className="bg-white/5 border-white/10"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Field
              form={form}
              name="password"
              label="New Password (leave empty to keep)"
              testId="input-profile-password"
              type="password"
              placeholder="••••••••"
            />

            <Button
              type="submit"
              className="w-full h-12 rounded-xl"
              disabled={updateMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
              Save Changes
            </Button>
          </form>
        </Form>
      </div>

      <div className="mt-8 rounded-2xl border border-white/5 bg-card/60 p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-bold">Need to talk to Youssef?</p>
          <p className="text-sm text-muted-foreground">Reach out directly on WhatsApp</p>
        </div>
        <WhatsAppButton message={`Hi Youssef, this is ${user.fullName}.`} testId="button-profile-whatsapp" />
      </div>
    </div>
  );
}

function Field({
  form,
  name,
  label,
  type = "text",
  placeholder,
  testId,
}: {
  form: any;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              data-testid={testId}
              className="bg-white/5 border-white/10 h-11"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
