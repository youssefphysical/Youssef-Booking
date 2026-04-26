import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2, Plus, Image as ImageIcon, MessageSquare } from "lucide-react";
import {
  useSettings,
  useUpdateSettings,
} from "@/hooks/use-settings";
import {
  useBlockedSlots,
  useCreateBlockedSlot,
  useDeleteBlockedSlot,
} from "@/hooks/use-blocked-slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ALL_TIME_SLOTS } from "@/lib/booking-utils";

const generalSchema = z.object({
  cancellationCutoffHours: z.coerce.number().int().min(0).max(168),
  whatsappNumber: z.string().min(7, "Phone number required"),
  profilePhotoUrl: z.string().optional(),
  profileBio: z.string().optional(),
});

const blockSchema = z.object({
  date: z.string().min(1, "Date required"),
  scope: z.enum(["whole-day", "specific-hour"]),
  timeSlot: z.string().optional(),
  reason: z.string().optional(),
});

export default function AdminSettings() {
  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen max-w-4xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Settings</p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-settings-title">
          Settings & Availability
        </h1>
        <p className="text-muted-foreground text-sm">Profile, cancellation policy, and time slot blocking</p>
      </div>

      <div className="space-y-6">
        <GeneralSettingsSection />
        <ProfileContentSection />
        <BlockedSlotsSection />
      </div>
    </div>
  );
}

function GeneralSettingsSection() {
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<z.infer<typeof generalSchema>>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      cancellationCutoffHours: 6,
      whatsappNumber: "",
      profilePhotoUrl: "",
      profileBio: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        cancellationCutoffHours: settings.cancellationCutoffHours ?? 6,
        whatsappNumber: settings.whatsappNumber ?? "",
        profilePhotoUrl: settings.profilePhotoUrl ?? "",
        profileBio: settings.profileBio ?? "",
      });
    }
  }, [settings]);

  return (
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
      <h2 className="font-display font-bold text-lg mb-1">Booking Rules</h2>
      <p className="text-sm text-muted-foreground mb-5">Cancellation cutoff and contact number</p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            updateMutation.mutate({
              cancellationCutoffHours: d.cancellationCutoffHours,
              whatsappNumber: d.whatsappNumber,
            }),
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="cancellationCutoffHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cancellation Cutoff (hours)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    {...field}
                    className="bg-white/5 border-white/10 max-w-xs"
                    data-testid="input-cutoff-hours"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Default 6h. Clients cannot cancel within this window.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="whatsappNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp Number (digits only, with country code)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="971505394754"
                    className="bg-white/5 border-white/10 max-w-md font-mono"
                    data-testid="input-whatsapp"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-general"
            className="rounded-xl"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
            Save Rules
          </Button>
        </form>
      </Form>
    </section>
  );
}

function ProfileContentSection() {
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<{ profilePhotoUrl: string; profileBio: string }>({
    defaultValues: { profilePhotoUrl: "", profileBio: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        profilePhotoUrl: settings.profilePhotoUrl ?? "",
        profileBio: settings.profileBio ?? "",
      });
    }
  }, [settings]);

  return (
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
      <h2 className="font-display font-bold text-lg mb-1">Homepage Content</h2>
      <p className="text-sm text-muted-foreground mb-5">Profile photo URL and bio shown on the homepage</p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            updateMutation.mutate({
              profilePhotoUrl: d.profilePhotoUrl || null,
              profileBio: d.profileBio || null,
            }),
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="profilePhotoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <ImageIcon size={14} /> Profile Photo URL
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="https://..."
                    className="bg-white/5 border-white/10"
                    data-testid="input-photo-url"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Paste a public image URL. (Upload functionality can be added later.)
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="profileBio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MessageSquare size={14} /> Profile Bio
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={5}
                    className="bg-white/5 border-white/10"
                    data-testid="input-bio"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-xl"
            data-testid="button-save-profile-content"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
            Save Profile Content
          </Button>
        </form>
      </Form>
    </section>
  );
}

function BlockedSlotsSection() {
  const { data: blocks = [] } = useBlockedSlots();
  const createMutation = useCreateBlockedSlot();
  const deleteMutation = useDeleteBlockedSlot();

  const form = useForm<z.infer<typeof blockSchema>>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      scope: "whole-day",
      timeSlot: "",
      reason: "",
    },
  });
  const scope = form.watch("scope");

  return (
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
      <h2 className="font-display font-bold text-lg mb-1">Blocked Time Slots</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Block entire days or specific hours so clients can't book them
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) => {
            createMutation.mutate(
              {
                date: d.date,
                timeSlot: d.scope === "whole-day" ? null : d.timeSlot || null,
                reason: d.reason || null,
              } as any,
              { onSuccess: () => form.reset({ ...form.getValues(), reason: "" }) },
            );
          })}
          className="grid sm:grid-cols-4 gap-3 items-end mb-6"
        >
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white/5 border-white/10 h-10" data-testid="input-block-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Scope</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-10" data-testid="select-block-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole-day">Whole day</SelectItem>
                      <SelectItem value="specific-hour">Specific hour</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {scope === "specific-hour" && (
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Time</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-10" data-testid="select-block-time">
                        <SelectValue placeholder="Pick" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_SLOTS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Reason (optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. travel" className="bg-white/5 border-white/10 h-10" data-testid="input-block-reason" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="rounded-xl h-10 sm:col-start-4" disabled={createMutation.isPending} data-testid="button-add-block">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} className="mr-1" /> Block</>}
          </Button>
        </form>
      </Form>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-white/10 rounded-xl">
          No blocked slots.
        </p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]"
              data-testid={`block-row-${b.id}`}
            >
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold">{format(new Date(b.date), "EEE, MMM d")}</span>
                <span className="text-muted-foreground">{b.timeSlot ?? "Whole day"}</span>
                {b.reason && <span className="text-xs text-muted-foreground italic">"{b.reason}"</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(b.id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                data-testid={`button-unblock-${b.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
