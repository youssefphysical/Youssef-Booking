import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Target,
  Notebook,
  HeartPulse,
  Calendar,
  Activity,
  Image as ImageIcon,
  Package as PackageIcon,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useBookings } from "@/hooks/use-bookings";
import {
  usePackages,
  useCreatePackage,
  useDeletePackage,
} from "@/hooks/use-packages";
import {
  useInbodyRecords,
  useUploadInbody,
  useUpdateInbody,
  useDeleteInbody,
} from "@/hooks/use-inbody";
import {
  useProgressPhotos,
  useUploadProgressPhoto,
  useDeleteProgressPhoto,
} from "@/hooks/use-progress";
import { useClients } from "@/hooks/use-clients";
import { useSettings } from "@/hooks/use-settings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { whatsappUrl } from "@/lib/whatsapp";
import { SiWhatsapp } from "react-icons/si";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { formatStatus, statusColor, ALL_TIME_SLOTS } from "@/lib/booking-utils";
import { Switch } from "@/components/ui/switch";
import {
  PACKAGE_DEFINITIONS,
  PRIMARY_GOAL_OPTIONS,
  PAYMENT_STATUS_LABELS,
  WORKOUT_CATEGORY_LABELS,
  WORKOUT_CATEGORIES,
  SESSION_TYPE_LABELS,
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  WEEKLY_FREQUENCY_OPTIONS,
  VIP_TIER_LABELS,
  normaliseTier,
  protectedCancellationQuota,
  sameDayAdjustQuota,
  type UserResponse,
  type Package,
  type InbodyRecord,
  type ProgressPhoto,
} from "@shared/schema";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw, AlertTriangle } from "lucide-react";

export default function AdminClientDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: clients = [] } = useClients();
  const client = clients.find((c) => c.id === id);

  const { data: settings } = useSettings();

  if (!client) {
    return (
      <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen">
        <Link href="/admin/clients" className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mb-4">
          <ArrowLeft size={14} /> Back to clients
        </Link>
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
          Loading client...
        </div>
      </div>
    );
  }

  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen max-w-5xl">
      <Link
        href="/admin/clients"
        data-testid="link-back-clients"
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft size={14} /> All clients
      </Link>

      <div className="rounded-3xl border border-white/5 bg-card/60 p-6 mb-6 flex flex-wrap gap-5 items-start justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <UserAvatar
            src={client.profilePictureUrl}
            name={client.fullName}
            size={64}
            testId="img-client-detail-avatar"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold leading-tight" data-testid="text-client-name">
                {client.fullName}
              </h1>
              {client.isVerified && <VerifiedBadge size="md" testId="badge-client-detail-verified" />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              {client.email && <span className="inline-flex items-center gap-1.5"><Mail size={11} /> {client.email}</span>}
              {client.phone && <span className="inline-flex items-center gap-1.5"><Phone size={11} /> {client.phone}</span>}
              {client.area && <span className="inline-flex items-center gap-1.5"><MapPin size={11} /> {client.area}</span>}
            </div>
          </div>
        </div>
        {client.phone && (
          <a
            href={whatsappUrl(settings?.whatsappNumber || client.phone)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="button-whatsapp"
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 text-sm font-semibold whitespace-nowrap"
          >
            <SiWhatsapp size={14} /> WhatsApp
          </a>
        )}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-white/5 mb-6 h-11 flex flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-detail-bookings">
            <Calendar size={13} className="mr-1.5" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-detail-packages">
            <PackageIcon size={13} className="mr-1.5" /> Packages
          </TabsTrigger>
          <TabsTrigger value="inbody" data-testid="tab-detail-inbody">
            <Activity size={13} className="mr-1.5" /> InBody
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-detail-progress">
            <ImageIcon size={13} className="mr-1.5" /> Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab client={client} /></TabsContent>
        <TabsContent value="bookings"><BookingsTab client={client} /></TabsContent>
        <TabsContent value="packages"><PackagesPanel client={client} /></TabsContent>
        <TabsContent value="inbody"><InbodyPanel userId={client.id} /></TabsContent>
        <TabsContent value="progress"><ProgressPanel userId={client.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ client }: { client: UserResponse }) {
  const goalLabel =
    PRIMARY_GOAL_OPTIONS.find((g) => g.value === client.primaryGoal)?.label ||
    client.fitnessGoal ||
    "—";
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <InfoCard icon={<Target size={13} />} label="Primary Goal" value={goalLabel} />
        <InfoCard icon={<MapPin size={13} />} label="Area" value={client.area || "—"} />
        <InfoCard
          icon={<Calendar size={13} />}
          label="Member Since"
          value={client.createdAt ? format(new Date(client.createdAt), "PPP") : "—"}
        />
        <InfoCard icon={<Notebook size={13} />} label="Notes" value={client.notes || "—"} className="sm:col-span-2" />
      </div>
      <ClientPrivilegesCard client={client} />
      <ConsentsCard userId={client.id} />
    </div>
  );
}

function ClientPrivilegesCard({ client }: { client: UserResponse }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const monthKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const usedThisMonth = client.emergencyCancelLastMonth === monthKey;

  // Monthly usage numbers
  const tier = normaliseTier(client.vipTier);
  const protQuota = protectedCancellationQuota(tier);
  const protUsed =
    client.protectedCancelMonth === monthKey ? client.protectedCancelCount ?? 0 : 0;
  const adjQuota = sameDayAdjustQuota(tier);
  const adjUsed =
    client.sameDayAdjustMonth === monthKey ? client.sameDayAdjustCount ?? 0 : 0;

  const resetEmergency = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${client.id}/reset-emergency-cancel`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Protected Cancel reset", description: "Client can now use it again this month." });
    },
    onError: (e: Error) => toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  const resetSameDay = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${client.id}/reset-same-day-adjust`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Same-Day Adjustment reset",
        description: "Client can use Same-Day Adjustments again this month.",
      });
    },
    onError: (e: Error) => toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  const updateMembership = useMutation({
    mutationFn: async (body: Partial<UserResponse>) => {
      const res = await apiRequest("PATCH", `/api/users/${client.id}`, body);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Membership updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const resetTrial = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${client.id}/reset-free-trial`);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Free trial reset", description: "Client can book the free trial session again." });
    },
    onError: (e: Error) => toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <AlertTriangle size={13} /> Client Privileges
      </p>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
        <p className="text-xs font-semibold">Membership Level</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">
              Weekly Frequency
            </label>
            <Select
              value={String(client.weeklyFrequency ?? "")}
              onValueChange={(v) =>
                updateMembership.mutate({ weeklyFrequency: Number(v) } as any)
              }
            >
              <SelectTrigger
                className="h-9 text-xs"
                data-testid="select-weekly-frequency"
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {WEEKLY_FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">
              Tier Override
              {client.vipTierManualOverride ? (
                <span className="ml-1 text-primary">(manual)</span>
              ) : (
                <span className="ml-1">(auto from frequency)</span>
              )}
            </label>
            <Select
              value={tier}
              onValueChange={(v) => updateMembership.mutate({ vipTier: v } as any)}
            >
              <SelectTrigger className="h-9 text-xs" data-testid="select-tier-override">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="foundation">{VIP_TIER_LABELS.foundation}</SelectItem>
                <SelectItem value="starter">{VIP_TIER_LABELS.starter}</SelectItem>
                <SelectItem value="momentum">{VIP_TIER_LABELS.momentum}</SelectItem>
                <SelectItem value="elite">{VIP_TIER_LABELS.elite}</SelectItem>
                <SelectItem value="pro_elite">{VIP_TIER_LABELS.pro_elite}</SelectItem>
                <SelectItem value="diamond_elite">{VIP_TIER_LABELS.diamond_elite}</SelectItem>
              </SelectContent>
            </Select>
            {client.vipTierManualOverride && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground underline mt-1"
                onClick={() =>
                  updateMembership.mutate({
                    weeklyFrequency: client.weeklyFrequency ?? 1,
                  } as any)
                }
                data-testid="button-clear-tier-override"
              >
                Clear override (recompute from frequency)
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
          <p data-testid="text-protected-usage">
            Protected Cancellations used this month:{" "}
            <span className="text-foreground font-semibold">
              {protUsed}/{protQuota}
            </span>
          </p>
          <p data-testid="text-same-day-usage">
            Same-Day Adjustments used this month:{" "}
            <span className="text-foreground font-semibold">
              {adjUsed}/{adjQuota}
            </span>
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold mb-1">Protected Cancel (legacy reset)</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {usedThisMonth
              ? `Used this month (${client.emergencyCancelLastMonth}). Reset to allow another use this month.`
              : "Available this month. Resets the legacy emergency cancel counter."}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!usedThisMonth || resetEmergency.isPending}
                data-testid="button-reset-emergency-cancel"
              >
                <RotateCcw size={12} className="mr-1.5" /> Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Emergency Cancel?</AlertDialogTitle>
                <AlertDialogDescription>
                  This client will be able to use Emergency Cancel again this month. Use sparingly.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetEmergency.mutate()}
                  data-testid="button-confirm-reset-emergency"
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold mb-1">Same-Day Adjustment</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {adjUsed > 0
              ? `Used ${adjUsed}/${adjQuota} this month. Reset to refill the counter.`
              : `Available (${adjQuota}/month for this tier).`}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={adjUsed === 0 || resetSameDay.isPending}
                data-testid="button-reset-same-day-adjust"
              >
                <RotateCcw size={12} className="mr-1.5" /> Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Same-Day Adjustment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This client will be able to use Same-Day Adjustments again this month.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetSameDay.mutate()}
                  data-testid="button-confirm-reset-same-day"
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:col-span-2">
          <p className="text-xs font-semibold mb-1">Free Trial Session</p>
          <p className="text-[11px] text-muted-foreground mb-2">
            {client.hasUsedFreeTrial
              ? "Already used. Reset only if appropriate (e.g., trial didn't happen)."
              : "Not used yet — client can book one free trial."}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!client.hasUsedFreeTrial || resetTrial.isPending}
                data-testid="button-reset-free-trial"
              >
                <RotateCcw size={12} className="mr-1.5" /> Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Free Trial?</AlertDialogTitle>
                <AlertDialogDescription>
                  This client will be able to book another free trial session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetTrial.mutate()}
                  data-testid="button-confirm-reset-trial"
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function ConsentsCard({ userId }: { userId: number }) {
  const { data: consents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/consent", { userId }],
    queryFn: async () => {
      const res = await fetch(`/api/consent?userId=${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load consents");
      return res.json();
    },
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <HeartPulse size={13} /> Consent Records
        </p>
        <span className="text-[10px] text-muted-foreground">
          {consents.length} {consents.length === 1 ? "record" : "records"}
        </span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : consents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No consent records on file.</p>
      ) : (
        <div className="space-y-2" data-testid="list-consents">
          {consents
            .slice()
            .sort((a: any, b: any) =>
              String(b.createdAt).localeCompare(String(a.createdAt)),
            )
            .map((c: any) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                data-testid={`consent-row-${c.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary">
                    {String(c.consentType).replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.createdAt ? format(new Date(c.createdAt), "PPp") : ""}
                    {c.policyVersion ? ` · ${c.policyVersion}` : ""}
                  </span>
                </div>
                {Array.isArray(c.acceptedItems) && c.acceptedItems.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {c.acceptedItems.map((item: string) => (
                      <li
                        key={item}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary/90"
                      >
                        {item.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                )}
                {(c.ipAddress || c.userAgent) && (
                  <p className="mt-2 text-[10px] text-muted-foreground/80 truncate">
                    {c.ipAddress ? `IP ${c.ipAddress}` : ""}
                    {c.ipAddress && c.userAgent ? " · " : ""}
                    {c.userAgent ? c.userAgent.slice(0, 80) : ""}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.02] p-4 ${className ?? ""}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="mt-1.5 text-sm break-words whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// =============== BOOKINGS TAB (header + manual session dialogs + list) ===============

const manualSingleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  timeSlot: z.string().min(1, "Time is required"),
  status: z.enum(BOOKING_STATUSES),
  workoutCategory: z.string().optional(),
  packageId: z.string().optional(),
  adminNotes: z.string().optional(),
  clientNotes: z.string().optional(),
  showNoteToClient: z.boolean(),
});
type ManualSingleValues = z.infer<typeof manualSingleSchema>;

const manualBulkSchema = z.object({
  count: z.coerce.number().int().min(1).max(50),
  startDate: z.string().min(1, "Start date is required"),
  spacingDays: z.coerce.number().int().min(1).max(30),
  timeSlot: z.string().min(1, "Time is required"),
  workoutCategory: z.string().optional(),
  packageId: z.string().optional(),
  status: z.enum(BOOKING_STATUSES),
  adminNotes: z.string().optional(),
});
type ManualBulkValues = z.infer<typeof manualBulkSchema>;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BookingsTab({ client }: { client: UserResponse }) {
  const { data: packages = [] } = usePackages({ userId: client.id });
  const activePackages = (packages as Package[]).filter((p) => p.isActive);
  const [singleOpen, setSingleOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const qc = useQueryClient();
  const { toast } = useToast();

  const singleForm = useForm<ManualSingleValues>({
    resolver: zodResolver(manualSingleSchema),
    defaultValues: {
      date: todayIso(),
      timeSlot: "12:00",
      status: "completed",
      workoutCategory: "none",
      packageId: "none",
      adminNotes: "",
      clientNotes: "",
      showNoteToClient: false,
    },
  });

  const bulkForm = useForm<ManualBulkValues>({
    resolver: zodResolver(manualBulkSchema),
    defaultValues: {
      count: 5,
      startDate: todayIso(),
      spacingDays: 1,
      timeSlot: "12:00",
      workoutCategory: "none",
      packageId: "none",
      status: "completed",
      adminNotes: "",
    },
  });

  const createSingle = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/clients/${client.id}/manual-bookings`,
        body,
      );
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      qc.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Manual session added" });
      setSingleOpen(false);
      singleForm.reset({
        date: todayIso(),
        timeSlot: "12:00",
        status: "completed",
        workoutCategory: "none",
        packageId: "none",
        adminNotes: "",
        clientNotes: "",
        showNoteToClient: false,
      });
    },
    onError: (e: Error) =>
      toast({
        title: "Could not add session",
        description: e.message,
        variant: "destructive",
      }),
  });

  const createBulk = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/clients/${client.id}/manual-bookings/bulk`,
        body,
      );
      return await res.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      qc.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: `Added ${data.count} historical sessions` });
      setBulkOpen(false);
    },
    onError: (e: Error) =>
      toast({
        title: "Bulk add failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  function onSubmitSingle(values: ManualSingleValues) {
    createSingle.mutate({
      date: values.date,
      timeSlot: values.timeSlot,
      status: values.status,
      sessionType: "manual_historical",
      workoutCategory:
        values.workoutCategory && values.workoutCategory !== "none"
          ? values.workoutCategory
          : null,
      packageId:
        values.packageId && values.packageId !== "none" ? Number(values.packageId) : null,
      adminNotes: values.adminNotes || null,
      clientNotes: values.clientNotes || null,
      showNoteToClient: values.showNoteToClient,
      isManualHistorical: true,
    });
  }

  function onSubmitBulk(values: ManualBulkValues) {
    createBulk.mutate({
      count: values.count,
      startDate: values.startDate,
      spacingDays: values.spacingDays,
      timeSlot: values.timeSlot,
      workoutCategory:
        values.workoutCategory && values.workoutCategory !== "none"
          ? values.workoutCategory
          : null,
      packageId:
        values.packageId && values.packageId !== "none" ? Number(values.packageId) : null,
      status: values.status,
      adminNotes: values.adminNotes || null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Session History</h3>
          <p className="text-xs text-muted-foreground">
            Includes manual historical sessions added by admin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => setBulkOpen(true)}
            data-testid="button-bulk-manual-session"
          >
            <Plus size={14} className="mr-1.5" /> Bulk add
          </Button>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => setSingleOpen(true)}
            data-testid="button-add-manual-session"
          >
            <Plus size={14} className="mr-1.5" /> Add manual session
          </Button>
        </div>
      </div>

      <BookingsList userId={client.id} />

      {/* SINGLE MANUAL SESSION DIALOG */}
      <Dialog open={singleOpen} onOpenChange={setSingleOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add manual session</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Backfill a historical 1-hour session. Marking it Completed deducts a session
              from the linked package.
            </p>
          </DialogHeader>
          <Form {...singleForm}>
            <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={singleForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="bg-white/5 border-white/10"
                          data-testid="input-manual-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={singleForm.control}
                  name="timeSlot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-manual-time"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_TIME_SLOTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={singleForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-manual-status"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOKING_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {BOOKING_STATUS_LABELS[s] || s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={singleForm.control}
                  name="workoutCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workout</FormLabel>
                      <Select value={field.value || "none"} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-manual-workout"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {WORKOUT_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {WORKOUT_CATEGORY_LABELS[c as keyof typeof WORKOUT_CATEGORY_LABELS] || c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={singleForm.control}
                name="packageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deduct from package</FormLabel>
                    <Select value={field.value || "none"} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="bg-white/5 border-white/10"
                        data-testid="select-manual-package"
                      >
                        <SelectValue placeholder="No package (no balance change)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No package (no balance change)</SelectItem>
                        {activePackages.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.type} — {p.totalSessions - p.usedSessions}/{p.totalSessions} left
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={singleForm.control}
                name="adminNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin note</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        {...field}
                        className="bg-white/5 border-white/10"
                        data-testid="input-manual-admin-notes"
                        placeholder="Internal note (not shared by default)"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={singleForm.control}
                name="showNoteToClient"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                    <div className="text-xs">
                      <FormLabel className="text-xs">Share note with client</FormLabel>
                      <p className="text-[11px] text-muted-foreground">
                        If on, the admin note also appears in the client's session history.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-manual-share-note"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSingleOpen(false)}
                  data-testid="button-cancel-manual-single"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createSingle.isPending}
                  data-testid="button-submit-manual-single"
                >
                  {createSingle.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Add session
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* BULK MANUAL SESSIONS DIALOG */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk add historical sessions</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Generates N consecutive 1-hour sessions starting from the chosen date. Useful
              when a client used several sessions before joining the app.
            </p>
          </DialogHeader>
          <Form {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(onSubmitBulk)} className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <FormField
                  control={bulkForm.control}
                  name="count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How many?</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          {...field}
                          className="bg-white/5 border-white/10"
                          data-testid="input-bulk-count"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bulkForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="bg-white/5 border-white/10"
                          data-testid="input-bulk-start"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bulkForm.control}
                  name="spacingDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days apart</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          {...field}
                          className="bg-white/5 border-white/10"
                          data-testid="input-bulk-spacing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={bulkForm.control}
                  name="timeSlot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time of day</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-bulk-time"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_TIME_SLOTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bulkForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status for all</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-bulk-status"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOKING_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {BOOKING_STATUS_LABELS[s] || s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={bulkForm.control}
                  name="workoutCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workout type</FormLabel>
                      <Select value={field.value || "none"} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-bulk-workout"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {WORKOUT_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {WORKOUT_CATEGORY_LABELS[c as keyof typeof WORKOUT_CATEGORY_LABELS] || c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={bulkForm.control}
                  name="packageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deduct from package</FormLabel>
                      <Select value={field.value || "none"} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-bulk-package"
                        >
                          <SelectValue placeholder="No package" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No package (no balance change)</SelectItem>
                          {activePackages.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.type} — {p.totalSessions - p.usedSessions}/{p.totalSessions} left
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={bulkForm.control}
                name="adminNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin note (applied to all)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        {...field}
                        className="bg-white/5 border-white/10"
                        data-testid="input-bulk-notes"
                        placeholder="e.g. Imported pre-app sessions"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setBulkOpen(false)}
                  data-testid="button-cancel-bulk"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBulk.isPending}
                  data-testid="button-submit-bulk"
                >
                  {createBulk.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Create sessions
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingsList({ userId }: { userId: number }) {
  const { data: bookings = [], isLoading } = useBookings({ userId });
  const list = bookings as any[];

  if (isLoading) return <Skeleton />;
  if (list.length === 0) return <EmptyBox text="No bookings yet" />;

  return (
    <div className="space-y-2">
      {list
        .sort((a, b) => `${b.date}T${b.timeSlot}`.localeCompare(`${a.date}T${a.timeSlot}`))
        .map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-2 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
            data-testid={`detail-booking-${b.id}`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm">
                <span className="font-semibold">{format(new Date(b.date), "EEE, MMM d, yyyy")}</span>
                <span className="text-muted-foreground ml-3">{b.timeSlot}</span>
                {b.sessionType && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-primary/70">
                    {SESSION_TYPE_LABELS[b.sessionType as keyof typeof SESSION_TYPE_LABELS] || b.sessionType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
                >
                  {formatStatus(b.status)}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-muted-foreground">
                  {PAYMENT_STATUS_LABELS[(b.paymentStatus || "unpaid") as keyof typeof PAYMENT_STATUS_LABELS] || b.paymentStatus || "Unpaid"}
                </span>
                {b.workoutCategory && (
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-violet-300">
                    {WORKOUT_CATEGORY_LABELS[b.workoutCategory as keyof typeof WORKOUT_CATEGORY_LABELS] || b.workoutCategory}
                  </span>
                )}
              </div>
            </div>
            {(b.notes || b.clientNotes || b.adminNotes) && (
              <div className="space-y-1 pt-1 border-t border-white/5">
                {b.notes && (
                  <p className="text-[11px] text-muted-foreground italic">"{b.notes}"</p>
                )}
                {b.clientNotes && (
                  <p className="text-[11px]">
                    <span className="text-blue-300/80 font-semibold">Client: </span>
                    <span className="text-foreground/80">{b.clientNotes}</span>
                  </p>
                )}
                {b.adminNotes && (
                  <p className="text-[11px]">
                    <span className="text-amber-300/80 font-semibold">Admin: </span>
                    <span className="text-foreground/80">{b.adminNotes}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// =============== PACKAGES ===============

const newPackageSchema = z.object({
  type: z.enum(["10", "20", "25", "duo30"]),
  partnerUserId: z.string().optional(),
  notes: z.string().optional(),
});

function PackagesPanel({ client }: { client: UserResponse }) {
  const { data: packages = [] } = usePackages({ userId: client.id });
  const list = packages as Package[];
  const create = useCreatePackage();
  const del = useDeletePackage();
  const { data: clients = [] } = useClients();

  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof newPackageSchema>>({
    resolver: zodResolver(newPackageSchema),
    defaultValues: { type: "10", partnerUserId: "", notes: "" },
  });
  const type = form.watch("type");

  function onSubmit(values: z.infer<typeof newPackageSchema>) {
    const def = PACKAGE_DEFINITIONS[values.type];
    create.mutate(
      {
        userId: client.id,
        type: values.type,
        totalSessions: def.sessions,
        partnerUserId: def.isDuo && values.partnerUserId ? Number(values.partnerUserId) : null,
        notes: values.notes,
        isActive: true,
        usedSessions: 0,
      } as any,
      {
        onSuccess: () => {
          form.reset({ type: "10", partnerUserId: "", notes: "" });
          setOpen(false);
        },
      },
    );
  }

  const otherClients = clients.filter((c) => c.id !== client.id && c.role === "client");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Session Packages</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl" data-testid="button-add-package">
              <Plus size={14} className="mr-1" /> Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
            <DialogHeader>
              <DialogTitle>Assign New Package</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-package-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PACKAGE_DEFINITIONS).map(([key, def]) => (
                            <SelectItem key={key} value={key}>{def.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {PACKAGE_DEFINITIONS[type]?.isDuo && (
                  <FormField
                    control={form.control}
                    name="partnerUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duo Partner (optional)</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-partner">
                            <SelectValue placeholder="Select partner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {otherClients.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional notes..." className="bg-white/5 border-white/10" data-testid="input-package-notes" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={create.isPending} data-testid="button-submit-package">
                    {create.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
                    Add Package
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <EmptyBox text="No packages assigned" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((p) => {
            const def = PACKAGE_DEFINITIONS[p.type];
            const remaining = p.totalSessions - p.usedSessions;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-4 ${p.isActive ? "border-primary/30 bg-primary/5" : "border-white/5 bg-white/[0.02] opacity-70"}`}
                data-testid={`admin-package-${p.id}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-primary">{def?.label}</p>
                    <p className="text-2xl font-display font-bold mt-1">
                      {remaining} <span className="text-sm text-muted-foreground font-normal">/ {p.totalSessions}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {p.purchasedAt && format(new Date(p.purchasedAt), "MMM d, yyyy")}
                      {!p.isActive && " • Closed"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => del.mutate(p.id)}
                    className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                    data-testid={`button-delete-package-${p.id}`}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============== INBODY ===============

const inbodySchema = z.object({
  weight: z.string().optional(),
  bodyFat: z.string().optional(),
  muscleMass: z.string().optional(),
  bmi: z.string().optional(),
  visceralFat: z.string().optional(),
  bmr: z.string().optional(),
  water: z.string().optional(),
  score: z.string().optional(),
  notes: z.string().optional(),
});

function InbodyPanel({ userId }: { userId: number }) {
  const { data: records = [] } = useInbodyRecords({ userId });
  const upload = useUploadInbody();
  const del = useDeleteInbody();
  const fileRef = useRef<HTMLInputElement>(null);

  const list = (records as InbodyRecord[]).sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, userId });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">InBody Scans</h3>
        <Button size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()} disabled={upload.isPending} data-testid="button-admin-upload-inbody">
          {upload.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Upload size={13} className="mr-1.5" />}
          Upload Scan
        </Button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
      </div>

      {list.length === 0 ? (
        <EmptyBox text="No InBody scans" />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <InbodyRow key={r.id} record={r} onDelete={() => del.mutate(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function InbodyRow({ record, onDelete }: { record: InbodyRecord; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateInbody();

  const form = useForm<z.infer<typeof inbodySchema>>({
    resolver: zodResolver(inbodySchema),
    defaultValues: {
      weight: record.weight?.toString() ?? "",
      bodyFat: record.bodyFat?.toString() ?? "",
      muscleMass: record.muscleMass?.toString() ?? "",
      bmi: record.bmi?.toString() ?? "",
      visceralFat: record.visceralFat?.toString() ?? "",
      bmr: record.bmr?.toString() ?? "",
      water: record.water?.toString() ?? "",
      score: record.score?.toString() ?? "",
      notes: record.notes ?? "",
    },
  });

  function onSubmit(values: z.infer<typeof inbodySchema>) {
    const num = (s: string | undefined) => (s && s.trim() !== "" ? Number(s) : null);
    update.mutate(
      {
        id: record.id,
        weight: num(values.weight),
        bodyFat: num(values.bodyFat),
        muscleMass: num(values.muscleMass),
        bmi: num(values.bmi),
        visceralFat: num(values.visceralFat),
        bmr: num(values.bmr),
        water: num(values.water),
        score: num(values.score),
        notes: values.notes ?? null,
      } as any,
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4" data-testid={`admin-inbody-${record.id}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">
            {record.recordedAt && format(new Date(record.recordedAt), "PPP")}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {record.aiExtracted ? "AI-extracted" : "Manual"}
            {record.fileUrl && " • "}
            {record.fileUrl && (
              <a href={record.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View file
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditing(!editing)} className="h-8 w-8" data-testid={`button-edit-inbody-${record.id}`}>
            <Edit3 size={13} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-red-400 hover:bg-red-500/10">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {!editing ? (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <Stat label="Weight" v={record.weight} u="kg" />
          <Stat label="BF" v={record.bodyFat} u="%" />
          <Stat label="Muscle" v={record.muscleMass} u="kg" />
          <Stat label="BMI" v={record.bmi} />
          <Stat label="Visceral" v={record.visceralFat} />
          <Stat label="BMR" v={record.bmr} />
          <Stat label="Water" v={record.water} u="L" />
          <Stat label="Score" v={record.score} />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                ["weight", "Weight"],
                ["bodyFat", "Body Fat %"],
                ["muscleMass", "Muscle (kg)"],
                ["bmi", "BMI"],
                ["visceralFat", "Visceral Fat"],
                ["bmr", "BMR"],
                ["water", "Water (L)"],
                ["score", "Score"],
              ].map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.1" className="bg-white/5 border-white/10 h-9 text-sm" data-testid={`input-inbody-${name}`} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} className="bg-white/5 border-white/10 text-sm" />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={update.isPending} data-testid={`button-save-inbody-${record.id}`}>
                {update.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Save size={13} className="mr-1.5" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

function Stat({ label, v, u }: { label: string; v: number | null; u?: string }) {
  return (
    <div className="rounded-lg bg-background/40 border border-white/5 p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{v != null ? `${v}${u ?? ""}` : "—"}</p>
    </div>
  );
}

// =============== PROGRESS PHOTOS ===============

function ProgressPanel({ userId }: { userId: number }) {
  const { data: photos = [] } = useProgressPhotos({ userId });
  const upload = useUploadProgressPhoto();
  const del = useDeleteProgressPhoto();
  const fileRef = useRef<HTMLInputElement>(null);

  const list = (photos as ProgressPhoto[]).sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, userId, type: "current" });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Progress Photos</h3>
        <Button size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()} disabled={upload.isPending} data-testid="button-admin-upload-photo">
          {upload.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Upload size={13} className="mr-1.5" />}
          Add Photo
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      {list.length === 0 ? (
        <EmptyBox text="No progress photos yet" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-white/5 group" data-testid={`admin-photo-${p.id}`}>
              <img src={p.photoUrl} alt="Progress" className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white">
                <p className="text-[11px] font-medium">{p.recordedAt && format(new Date(p.recordedAt), "MMM d, yyyy")}</p>
                <p className="text-[9px] uppercase tracking-wider text-primary">{p.type}</p>
              </div>
              <button
                onClick={() => del.mutate(p.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                data-testid={`button-delete-photo-${p.id}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}
