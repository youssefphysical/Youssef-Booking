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
import { usePackageTemplates } from "@/hooks/use-package-templates";
import { expirationToDays } from "@shared/schema";
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
import { motion } from "framer-motion";
import { whatsappUrl } from "@/lib/whatsapp";
import { SiWhatsapp } from "react-icons/si";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ImageCropper, dataUrlToFile, type AspectPreset } from "@/components/ImageCropper";
import { translateStatus, statusColor, ALL_TIME_SLOTS } from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
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
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONES,
  PACKAGE_PAYMENT_STATUSES,
  PACKAGE_PAYMENT_STATUS_LABELS,
  SESSION_HISTORY_ACTION_LABELS,
  type ClientStatus,
  type PackagePaymentStatus,
  type PackageSessionHistory,
  type UserResponse,
  type Package,
  type InbodyRecord,
  type ProgressPhoto,
} from "@shared/schema";
import { Snowflake, FileText, Bell, FileCheck2, Wallet, Pause, Play, Plus as PlusIcon, Minus, BadgeCheck } from "lucide-react";
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
import { useTranslation } from "@/i18n";

export default function AdminClientDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: clients = [] } = useClients();
  const client = clients.find((c) => c.id === id);

  const { data: settings } = useSettings();

  if (!client) {
    return (
      <div className="admin-shell">
        <div className="admin-container">
          <Link href="/admin/clients" className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mb-4">
            <ArrowLeft size={14} /> {t("admin.clientDetail.back")}
          </Link>
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
            {t("admin.clientDetail.loading")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
      <Link
        href="/admin/clients"
        data-testid="link-back-clients"
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft size={14} /> {t("admin.clientDetail.back")}
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
              <VerifiedToggle clientId={client.id} verifiedOverride={client.verifiedOverride} isVerified={!!client.isVerified} />
              <ClientStatusBadge status={(client.clientStatus ?? "incomplete") as ClientStatus} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              {client.email && <span className="inline-flex items-center gap-1.5"><Mail size={11} /> {client.email}</span>}
              {client.phone && <span className="inline-flex items-center gap-1.5"><Phone size={11} /> {client.phone}</span>}
              {client.area && <span className="inline-flex items-center gap-1.5"><MapPin size={11} /> {client.area}</span>}
            </div>
            <div className="mt-3">
              <ClientStatusControl client={client} />
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
        <TabsList className="bg-white/5 mb-6 h-auto flex flex-wrap p-1 gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">{t("admin.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-detail-packages">
            <PackageIcon size={13} className="mr-1.5" /> {t("admin.clientDetail.tabPackage", "Package")}
          </TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-detail-bookings">
            <Calendar size={13} className="mr-1.5" /> {t("admin.clientDetail.tabSessions", "Sessions")}
          </TabsTrigger>
          <TabsTrigger value="inbody" data-testid="tab-detail-inbody">
            <HeartPulse size={13} className="mr-1.5" /> {t("admin.clientDetail.tabHealth", "Health & Goals")}
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-detail-progress">
            <ImageIcon size={13} className="mr-1.5" /> {t("admin.clientDetail.tabProgress", "Progress")}
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-detail-notes">
            <FileText size={13} className="mr-1.5" /> {t("admin.clientDetail.tabNotes", "Notes")}
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-detail-documents">
            <FileCheck2 size={13} className="mr-1.5" /> {t("admin.clientDetail.tabDocuments", "Documents")}
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-detail-alerts">
            <Bell size={13} className="mr-1.5" /> {t("admin.clientDetail.tabAlerts", "Alerts")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab client={client} /></TabsContent>
        <TabsContent value="packages">
          <PackagesPanel client={client} />
          <div className="mt-6">
            <SessionHistoryCard userId={client.id} />
          </div>
        </TabsContent>
        <TabsContent value="bookings"><BookingsTab client={client} /></TabsContent>
        <TabsContent value="inbody">
          <HealthGoalsPanel client={client} />
          <div className="mt-6">
            <InbodyPanel userId={client.id} />
          </div>
        </TabsContent>
        <TabsContent value="progress"><ProgressPanel userId={client.id} /></TabsContent>
        <TabsContent value="notes"><NotesPanel client={client} /></TabsContent>
        <TabsContent value="documents"><DocumentsPanel client={client} /></TabsContent>
        <TabsContent value="alerts"><AlertsPanel client={client} /></TabsContent>
      </Tabs>
      </div>
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
  const { t } = useTranslation();
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
        <p className="text-xs font-semibold">{t("admin.clientDetail.membershipLevel", "Membership Level")}</p>
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
                <AlertDialogTitle>{t("admin.clientDetail.resetEmergencyTitle", "Reset Emergency Cancel?")}</AlertDialogTitle>
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
          <p className="text-xs font-semibold mb-1">{t("admin.clientDetail.sameDayAdjustment", "Same-Day Adjustment")}</p>
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
                <AlertDialogTitle>{t("admin.clientDetail.resetSameDayTitle", "Reset Same-Day Adjustment?")}</AlertDialogTitle>
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
          <p className="text-xs font-semibold mb-1">{t("admin.clientDetail.freeTrialSession", "Free Trial Session")}</p>
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
                <AlertDialogTitle>{t("admin.clientDetail.resetFreeTrialTitle", "Reset Free Trial?")}</AlertDialogTitle>
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
  const { t } = useTranslation();
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
        <p className="text-xs text-muted-foreground">{t("admin.clientDetail.noConsent", "No consent records on file.")}</p>
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
  const { t } = useTranslation();
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
          <h3 className="text-sm font-semibold">{t("admin.clientDetail.sessionHistory", "Session History")}</h3>
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
            <DialogTitle>{t("admin.clientDetail.addManualSession", "Add manual session")}</DialogTitle>
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
                              {formatTime12(s)}
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
            <DialogTitle>{t("admin.clientDetail.bulkAddSessions", "Bulk add historical sessions")}</DialogTitle>
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
                              {formatTime12(s)}
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
  const { t } = useTranslation();
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
                <span className="text-muted-foreground ml-3">{formatTime12(b.timeSlot)}</span>
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
                  {translateStatus(b.status, t)}
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

// New form: every field is editable. The template selector at the top
// auto-fills everything (name, sessions, prices, dates) but the admin
// can override each value before saving — and each value is captured
// as a snapshot on the package so future edits to the template never
// mutate this client's record.
const assignPackageSchema = z.object({
  templateId: z.number().nullable(),
  name: z.string().min(1, "Name required"),
  type: z.string().min(1),
  paidSessions: z.number().int().min(0),
  bonusSessions: z.number().int().min(0),
  totalSessions: z.number().int().min(1),
  pricePerSession: z.number().int().min(0),
  totalPrice: z.number().int().min(0),
  startDate: z.string(),
  expiryDate: z.string(),
  partnerUserId: z.string().optional(),
  notes: z.string().optional(),
});
type AssignPackageValues = z.infer<typeof assignPackageSchema>;

function isoToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDaysISO(start: string, days: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function PackagesPanel({ client }: { client: UserResponse }) {
  const { t } = useTranslation();
  const { data: packages = [] } = usePackages({ userId: client.id });
  const list = packages as Package[];
  const create = useCreatePackage();
  const del = useDeletePackage();
  const { data: clients = [] } = useClients();
  const { data: templates = [] } = usePackageTemplates({ activeOnly: true });

  const [open, setOpen] = useState(false);

  const form = useForm<AssignPackageValues>({
    resolver: zodResolver(assignPackageSchema),
    defaultValues: {
      templateId: null,
      name: "",
      type: "custom",
      paidSessions: 10,
      bonusSessions: 0,
      totalSessions: 10,
      pricePerSession: 0,
      totalPrice: 0,
      startDate: isoToday(),
      expiryDate: addDaysISO(isoToday(), 30),
      partnerUserId: "",
      notes: "",
    },
  });

  const watchedType = form.watch("type");
  const watchedTemplateId = form.watch("templateId");

  function applyTemplate(tplId: string) {
    if (tplId === "_custom") {
      form.reset({
        templateId: null,
        name: "",
        type: "custom",
        paidSessions: 10,
        bonusSessions: 0,
        totalSessions: 10,
        pricePerSession: 0,
        totalPrice: 0,
        startDate: isoToday(),
        expiryDate: addDaysISO(isoToday(), 30),
        partnerUserId: "",
        notes: "",
      });
      return;
    }
    const tpl = templates.find((t) => String(t.id) === tplId);
    if (!tpl) return;
    const start = isoToday();
    const expiry = addDaysISO(start, expirationToDays(tpl.expirationValue, tpl.expirationUnit));
    form.reset({
      templateId: tpl.id,
      name: tpl.name,
      type: tpl.type,
      paidSessions: tpl.paidSessions,
      bonusSessions: tpl.bonusSessions,
      totalSessions: tpl.totalSessions,
      pricePerSession: tpl.pricePerSession,
      totalPrice: tpl.totalPrice,
      startDate: start,
      expiryDate: expiry,
      partnerUserId: "",
      notes: "",
    });
  }

  function onSubmit(values: AssignPackageValues) {
    const isDuo = values.type === "duo" || values.type === "duo30";
    if (isDuo && !values.partnerUserId) {
      form.setError("partnerUserId", { message: "Partner is required for duo packages" });
      return;
    }
    create.mutate(
      {
        userId: client.id,
        type: values.type,
        totalSessions: values.totalSessions,
        usedSessions: 0,
        isActive: true,
        startDate: values.startDate,
        expiryDate: values.expiryDate,
        partnerUserId: isDuo && values.partnerUserId ? Number(values.partnerUserId) : null,
        notes: values.notes,
        templateId: values.templateId,
        name: values.name,
        paidSessions: values.paidSessions,
        bonusSessions: values.bonusSessions,
        pricePerSession: values.pricePerSession,
        totalPrice: values.totalPrice,
      } as any,
      {
        onSuccess: () => {
          applyTemplate("_custom");
          setOpen(false);
        },
      },
    );
  }

  const otherClients = clients.filter((c) => c.id !== client.id && c.role === "client");
  const isDuoSelected = watchedType === "duo" || watchedType === "duo30";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("admin.clientDetail.sessionPackages", "Session Packages")}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl" data-testid="button-add-package">
              <Plus size={14} className="mr-1" /> Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("admin.clientDetail.assignPackage", "Assign Package")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {/* Template chooser — auto-fills every field but each value is editable. */}
                <FormItem>
                  <FormLabel>Choose package</FormLabel>
                  <Select
                    value={watchedTemplateId ? String(watchedTemplateId) : "_custom"}
                    onValueChange={applyTemplate}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-package-template">
                      <SelectValue placeholder="Pick a saved package…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length > 0 && (
                        <>
                          {templates.map((tpl) => (
                            <SelectItem key={tpl.id} value={String(tpl.id)}>
                              {tpl.name} · {tpl.totalSessions}× · {tpl.totalPrice.toLocaleString()} AED
                            </SelectItem>
                          ))}
                        </>
                      )}
                      <SelectItem value="_custom">Custom (no template)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Manage saved packages in <strong>Package Builder</strong>. All fields below
                    remain editable before saving.
                  </p>
                </FormItem>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Standard 10 sessions"
                          className="bg-white/5 border-white/10"
                          data-testid="input-package-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-2">
                  <PkgNumberField form={form} name="paidSessions" label="Paid" testId="input-paid" />
                  <PkgNumberField form={form} name="bonusSessions" label="Bonus" testId="input-bonus" />
                  <PkgNumberField form={form} name="totalSessions" label="Total" testId="input-total" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PkgNumberField form={form} name="pricePerSession" label="Price / session (AED)" testId="input-price-session" />
                  <PkgNumberField form={form} name="totalPrice" label="Total price (AED)" testId="input-price-total" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="bg-white/5 border-white/10" data-testid="input-start-date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="bg-white/5 border-white/10" data-testid="input-expiry-date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {isDuoSelected && (
                  <FormField
                    control={form.control}
                    name="partnerUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duo Partner</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-partner">
                            <SelectValue placeholder="Select partner client…" />
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
                  <Button type="submit" disabled={create.isPending} className="rounded-xl" data-testid="button-submit-package">
                    {create.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
                    Assign Package
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
            // Prefer the snapshot fields captured at assignment time; fall back
            // to the legacy PACKAGE_DEFINITIONS table for pre-template rows.
            const bonus = (p as any).bonusSessions ?? def?.bonusSessions ?? 0;
            const base =
              (p as any).paidSessions ?? ((def?.sessions ?? p.totalSessions) - bonus);
            const displayName = (p as any).name || def?.label || p.type;
            const pct = Math.round((p.usedSessions / Math.max(p.totalSessions, 1)) * 100);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-4 card-lift ${p.isActive ? "border-primary/30 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent" : "border-white/5 bg-white/[0.02] opacity-70"}`}
                data-testid={`admin-package-${p.id}`}
              >
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {p.purchasedAt && format(new Date(p.purchasedAt), "MMM d, yyyy")}
                      {!p.isActive && " • Closed"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => del.mutate(p.id)}
                    className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                    data-testid={`button-delete-package-${p.id}`}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <SessionStat label="Base" value={base} />
                  <SessionStat label="Bonus" value={bonus} accent={bonus > 0 ? "text-amber-300" : undefined} />
                  <SessionStat label="Total" value={p.totalSessions} accent="text-primary" />
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-display font-bold leading-none tabular-nums">
                      {remaining}
                      <span className="text-xs font-normal text-muted-foreground ml-1">remaining</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{p.usedSessions} of {p.totalSessions} used</p>
                  </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-primary via-primary to-primary/60"
                  />
                </div>
                <PackageAdminControls pkg={p} />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============== ADMIN PACKAGE CONTROLS (payment / freeze / approve / sessions adjust) ===============

function PackageAdminControls({ pkg }: { pkg: Package }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/packages"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/clients", pkg.userId, "session-history"] });
  };

  const freezeMut = useMutation({
    mutationFn: async (vars: { frozen: boolean; reason?: string | null }) => {
      const r = await apiRequest("POST", `/api/admin/packages/${pkg.id}/freeze`, vars);
      return r.json();
    },
    onSuccess: () => { invalidate(); toast({ title: pkg.frozen ? "Package unfrozen" : "Package frozen" }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const paymentMut = useMutation({
    mutationFn: async (vars: { paymentStatus: PackagePaymentStatus; note?: string | null }) => {
      const r = await apiRequest("POST", `/api/admin/packages/${pkg.id}/payment`, vars);
      return r.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Payment status updated" }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const approveMut = useMutation({
    mutationFn: async (vars: { approved: boolean; note?: string | null }) => {
      const r = await apiRequest("POST", `/api/admin/packages/${pkg.id}/approve`, vars);
      return r.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Approval updated" }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const adjustMut = useMutation({
    mutationFn: async (vars: { delta: number; reason: string }) => {
      const r = await apiRequest("POST", `/api/admin/packages/${pkg.id}/sessions-adjust`, vars);
      return r.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Sessions adjusted" }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjDelta, setAdjDelta] = useState<number>(1);
  const [adjReason, setAdjReason] = useState("");

  const paymentStatus = ((pkg as any).paymentStatus ?? "unpaid") as PackagePaymentStatus;
  const adminApproved = !!(pkg as any).adminApproved;
  const isFrozen = !!(pkg as any).frozen;

  return (
    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border ${
            paymentStatus === "paid"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : paymentStatus === "partially_paid"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : paymentStatus === "pending"
              ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
          data-testid={`badge-payment-${pkg.id}`}
        >
          <Wallet size={11} className="inline mr-1 -mt-0.5" />
          {PACKAGE_PAYMENT_STATUS_LABELS[paymentStatus]}
        </span>
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border ${
            adminApproved
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
          data-testid={`badge-approved-${pkg.id}`}
        >
          <BadgeCheck size={11} className="inline mr-1 -mt-0.5" />
          {adminApproved ? "Approved" : "Awaiting approval"}
        </span>
        {isFrozen && (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
            <Snowflake size={11} className="inline mr-1 -mt-0.5" /> Frozen
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={paymentStatus}
          onValueChange={(v) => paymentMut.mutate({ paymentStatus: v as PackagePaymentStatus })}
        >
          <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 w-auto" data-testid={`select-payment-${pkg.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACKAGE_PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{PACKAGE_PAYMENT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs rounded-lg"
          onClick={() => freezeMut.mutate({ frozen: !isFrozen, reason: null })}
          disabled={freezeMut.isPending}
          data-testid={`button-freeze-${pkg.id}`}
        >
          {isFrozen ? <Play size={12} className="mr-1" /> : <Pause size={12} className="mr-1" />}
          {isFrozen ? "Unfreeze" : "Freeze"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs rounded-lg"
          onClick={() => approveMut.mutate({ approved: !adminApproved })}
          disabled={approveMut.isPending}
          data-testid={`button-approve-${pkg.id}`}
        >
          <BadgeCheck size={12} className="mr-1" />
          {adminApproved ? "Revoke approval" : "Approve"}
        </Button>

        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" data-testid={`button-adjust-${pkg.id}`}>
              <PlusIcon size={12} className="mr-1" />/<Minus size={12} className="ml-0.5 mr-1" /> Adjust
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-sm">
            <DialogHeader><DialogTitle>{t("admin.clientDetail.adjustSessions", "Adjust sessions")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Delta (positive adds, negative removes)</label>
                <Input
                  type="number"
                  value={adjDelta}
                  onChange={(e) => setAdjDelta(Number(e.target.value) || 0)}
                  className="bg-white/5 border-white/10"
                  data-testid="input-adjust-delta"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Reason</label>
                <Input
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Bonus session, complaint refund…"
                  className="bg-white/5 border-white/10"
                  data-testid="input-adjust-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!adjReason.trim() || !adjDelta) return;
                  adjustMut.mutate(
                    { delta: adjDelta, reason: adjReason.trim() },
                    { onSuccess: () => { setAdjustOpen(false); setAdjDelta(1); setAdjReason(""); } },
                  );
                }}
                disabled={adjustMut.isPending || !adjReason.trim() || !adjDelta}
                data-testid="button-submit-adjust"
              >
                {adjustMut.isPending && <Loader2 size={12} className="animate-spin mr-1" />} Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(pkg as any).paymentNote && (
        <p className="text-[11px] text-muted-foreground italic">Payment note: {(pkg as any).paymentNote}</p>
      )}
      {(pkg as any).frozenReason && (
        <p className="text-[11px] text-cyan-300/90 italic">Frozen reason: {(pkg as any).frozenReason}</p>
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
  const { t } = useTranslation();
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
        <h3 className="text-sm font-semibold">{t("admin.clientDetail.inbodyScans", "InBody Scans")}</h3>
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
  const { t } = useTranslation();
  const { data: photos = [] } = useProgressPhotos({ userId });
  const upload = useUploadProgressPhoto();
  const del = useDeleteProgressPhoto();
  const [cropperOpen, setCropperOpen] = useState(false);

  const list = (photos as ProgressPhoto[]).sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );

  // Body-photo presets — portrait-leaning since transformation shots are
  // typically full-body. 1:1 is included for grid/Instagram-style display.
  const progressAspects: AspectPreset[] = [
    { key: "4x5", label: "4:5", ratio: 4 / 5 },
    { key: "3x4", label: "3:4", ratio: 3 / 4 },
    { key: "1x1", label: "1:1", ratio: 1 },
  ];

  async function handleCropped(dataUrl: string) {
    try {
      const file = dataUrlToFile(dataUrl, `progress-${Date.now()}.webp`);
      await upload.mutateAsync({ file, userId, type: "current" });
      setCropperOpen(false);
    } catch {
      // useUploadProgressPhoto already surfaces a toast on error.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("admin.clientDetail.progressTitle")}</h3>
        <Button
          size="sm"
          className="rounded-xl"
          onClick={() => setCropperOpen(true)}
          disabled={upload.isPending}
          data-testid="button-admin-upload-photo"
        >
          {upload.isPending ? (
            <Loader2 size={13} className="animate-spin mr-1.5" />
          ) : (
            <Upload size={13} className="mr-1.5" />
          )}
          {t("admin.clientDetail.addPhoto")}
        </Button>
        <ImageCropper
          open={cropperOpen}
          onOpenChange={setCropperOpen}
          saving={upload.isPending}
          onCropped={handleCropped}
          aspects={progressAspects}
          outputLongEdgePx={1600}
          title={t("cropper.progressTitle")}
          description={t("cropper.progressDescription")}
        />
      </div>

      {list.length === 0 ? (
        <EmptyBox text={t("admin.clientDetail.noProgressPhotos")} />
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

function PkgNumberField({
  form,
  name,
  label,
  testId,
}: {
  form: any;
  name: string;
  label: string;
  testId: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              {...field}
              value={field.value ?? 0}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="bg-white/5 border-white/10 tabular-nums"
              data-testid={testId}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SessionStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-display font-bold tabular-nums leading-tight mt-0.5 ${accent || ""}`}>
        {value}
      </p>
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

// --- Admin verified-badge override -------------------------------------
import { ShieldCheck, ShieldOff, RotateCcw as ResetIcon } from "lucide-react";

function VerifiedToggle({
  clientId,
  verifiedOverride,
  isVerified,
}: {
  clientId: number;
  verifiedOverride: boolean | null | undefined;
  isVerified: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (value: boolean | null) => {
      const res = await apiRequest("PATCH", `/api/users/${clientId}`, {
        verifiedOverride: value,
      });
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      qc.invalidateQueries({ queryKey: [`/api/users/${clientId}`] });
    },
  });

  const isManual = verifiedOverride === true || verifiedOverride === false;
  const label = isVerified ? "Remove verified" : "Mark verified";
  const Icon = isVerified ? ShieldOff : ShieldCheck;
  const next = isVerified ? false : true;

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => m.mutate(next)}
        disabled={m.isPending}
        data-testid="button-toggle-verified"
        className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-semibold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50"
        title={label}
      >
        <Icon size={12} /> {label}
      </button>
      {isManual && (
        <button
          type="button"
          onClick={() => m.mutate(null)}
          disabled={m.isPending}
          data-testid="button-reset-verified"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50"
          title={t("admin.clientDetail.resetToAuto", "Reset to automatic")}
        >
          <ResetIcon size={12} />
        </button>
      )}
    </div>
  );
}

// =============== CLIENT STATUS (badge + admin control) ===============

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const tone = CLIENT_STATUS_TONES[status] ?? "neutral";
  const cls =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : tone === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : "border-white/10 bg-white/5 text-white/70";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border ${cls}`}
      data-testid={`badge-client-status-${status}`}
    >
      {CLIENT_STATUS_LABELS[status]}
    </span>
  );
}

function ClientStatusControl({ client }: { client: UserResponse }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const m = useMutation({
    mutationFn: async (status: ClientStatus) => {
      const r = await apiRequest("PATCH", `/api/users/${client.id}`, { clientStatus: status });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client status updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const current = (client.clientStatus ?? "incomplete") as ClientStatus;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("admin.clientDetail.lifecycle", "Lifecycle")}</span>
      <Select value={current} onValueChange={(v) => m.mutate(v as ClientStatus)}>
        <SelectTrigger className="h-8 w-44 text-xs bg-white/5 border-white/10" data-testid="select-client-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLIENT_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{CLIENT_STATUS_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// =============== HEALTH & GOALS PANEL ===============

function HealthGoalsPanel({ client }: { client: UserResponse }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    primaryGoal: client.primaryGoal ?? "",
    fitnessGoal: client.fitnessGoal ?? "",
    weeklyFrequency: client.weeklyFrequency ?? 3,
    preferredTrainingDays: ((client as any).preferredTrainingDays ?? []) as string[],
    injuries: (client as any).injuries ?? "",
    medicalNotes: (client as any).medicalNotes ?? "",
    medicalClearanceNote: (client as any).medicalClearanceNote ?? "",
    parqCompleted: !!(client as any).parqCompleted,
    waiverAccepted: !!(client as any).waiverAccepted,
  });

  const m = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("PATCH", `/api/users/${client.id}`, body);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Health & goals updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const toggleDay = (d: string) => {
    setForm((f) => ({
      ...f,
      preferredTrainingDays: f.preferredTrainingDays.includes(d)
        ? f.preferredTrainingDays.filter((x) => x !== d)
        : [...f.preferredTrainingDays, d],
    }));
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <HeartPulse size={13} /> Health & Goals
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">{t("admin.clientDetail.primaryGoal", "Primary Goal")}</label>
          <Select value={form.primaryGoal} onValueChange={(v) => setForm({ ...form, primaryGoal: v })}>
            <SelectTrigger className="h-9 text-xs bg-white/5 border-white/10" data-testid="select-primary-goal">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {PRIMARY_GOAL_OPTIONS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">{t("admin.clientDetail.weeklyFrequency", "Weekly Frequency")}</label>
          <Select value={String(form.weeklyFrequency ?? "")} onValueChange={(v) => setForm({ ...form, weeklyFrequency: Number(v) })}>
            <SelectTrigger className="h-9 text-xs bg-white/5 border-white/10" data-testid="select-health-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKLY_FREQUENCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground block mb-2">{t("admin.clientDetail.preferredDays", "Preferred Training Days")}</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              data-testid={`chip-day-${d}`}
              className={`px-3 h-8 rounded-full text-[11px] font-semibold border ${
                form.preferredTrainingDays.includes(d)
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground block mb-1">{t("admin.clientDetail.freeFormGoal", "Free-form fitness goal")}</label>
        <Textarea
          value={form.fitnessGoal}
          onChange={(e) => setForm({ ...form, fitnessGoal: e.target.value })}
          rows={2}
          className="bg-white/5 border-white/10 text-sm"
          data-testid="textarea-fitness-goal"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">{t("admin.clientDetail.injuries", "Injuries / limitations")}</label>
          <Textarea
            value={form.injuries}
            onChange={(e) => setForm({ ...form, injuries: e.target.value })}
            rows={3}
            className="bg-white/5 border-white/10 text-sm"
            data-testid="textarea-injuries"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">{t("admin.clientDetail.medicalNotes", "Medical notes")}</label>
          <Textarea
            value={form.medicalNotes}
            onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
            rows={3}
            className="bg-white/5 border-white/10 text-sm"
            data-testid="textarea-medical-notes"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground block mb-1">{t("admin.clientDetail.medicalClearance", "Medical clearance note")}</label>
        <Textarea
          value={form.medicalClearanceNote}
          onChange={(e) => setForm({ ...form, medicalClearanceNote: e.target.value })}
          rows={2}
          className="bg-white/5 border-white/10 text-sm"
          data-testid="textarea-medical-clearance"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-xs">
          <Switch
            checked={form.parqCompleted}
            onCheckedChange={(v) => setForm({ ...form, parqCompleted: v })}
            data-testid="switch-parq"
          />
          PAR-Q completed
        </label>
        <label className="inline-flex items-center gap-2 text-xs">
          <Switch
            checked={form.waiverAccepted}
            onCheckedChange={(v) => setForm({ ...form, waiverAccepted: v })}
            data-testid="switch-waiver"
          />
          Liability waiver signed
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => m.mutate(form)}
          disabled={m.isPending}
          data-testid="button-save-health"
        >
          {m.isPending && <Loader2 size={12} className="animate-spin mr-1" />} Save
        </Button>
      </div>
    </div>
  );
}

// =============== NOTES PANEL (categorized) ===============

function NotesPanel({ client }: { client: UserResponse }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    coachNotes: (client as any).coachNotes ?? "",
    goalNotes: (client as any).goalNotes ?? "",
    communicationNotes: (client as any).communicationNotes ?? "",
    adminNotes: (client as any).adminNotes ?? "",
  });
  const m = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("PATCH", `/api/users/${client.id}`, body);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Notes saved" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const fields: Array<{ key: keyof typeof form; label: string; hint: string; testId: string }> = [
    { key: "coachNotes", label: "Coach notes", hint: "Programming, technique, performance.", testId: "textarea-coach-notes" },
    { key: "goalNotes", label: "Goal notes", hint: "Long-term targets, milestones, body composition goals.", testId: "textarea-goal-notes" },
    { key: "communicationNotes", label: "Communication notes", hint: "Cadence, preferences, family / privacy considerations.", testId: "textarea-communication-notes" },
    { key: "adminNotes", label: "General admin notes", hint: "Anything else not covered above.", testId: "textarea-admin-notes" },
  ];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <FileText size={13} /> Internal notes (never shared with the client)
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key as string}>
            <label className="text-[11px] text-muted-foreground block mb-1">{f.label}</label>
            <Textarea
              value={form[f.key] as string}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              rows={4}
              className="bg-white/5 border-white/10 text-sm"
              data-testid={f.testId}
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => m.mutate(form)} disabled={m.isPending} data-testid="button-save-notes">
          {m.isPending && <Loader2 size={12} className="animate-spin mr-1" />} Save notes
        </Button>
      </div>
    </div>
  );
}

// =============== DOCUMENTS PANEL (consents + checklists) ===============

function DocumentsPanel({ client }: { client: UserResponse }) {
  const { t } = useTranslation();
  const parq = !!(client as any).parqCompleted;
  const waiver = !!(client as any).waiverAccepted;
  const medical = (client as any).medicalClearanceNote;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <FileCheck2 size={13} /> Onboarding checklist
        </p>
        <DocRow label="PAR-Q questionnaire" done={parq} />
        <DocRow label="Liability waiver" done={waiver} />
        <DocRow
          label="Medical clearance"
          done={!!(medical && String(medical).trim().length > 0)}
          detail={medical || "Not on file"}
        />
        <p className="text-[11px] text-muted-foreground/70">
          {t("admin.clientDetail.tickParQHint", "Tick PAR-Q / waiver from the Health & Goals tab.")}
        </p>
      </div>
      <ConsentsCard userId={client.id} />
    </div>
  );
}

function DocRow({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
      </div>
      <span
        className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border ${
          done
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-amber-500/40 bg-amber-500/10 text-amber-200"
        }`}
      >
        {done ? "On file" : "Missing"}
      </span>
    </div>
  );
}

// =============== ALERTS PANEL (computed) ===============

function AlertsPanel({ client }: { client: UserResponse }) {
  const { t } = useTranslation();
  const { data: packages = [] } = usePackages({ userId: client.id });
  const list = packages as Package[];
  const status = (client.clientStatus ?? "incomplete") as ClientStatus;
  const alerts: Array<{ tone: "danger" | "warning" | "info"; text: string }> = [];

  if (status === "incomplete") alerts.push({ tone: "warning", text: "Profile is incomplete — booking is blocked." });
  if (status === "pending") alerts.push({ tone: "info", text: "Awaiting your approval to allow booking." });
  if (status === "frozen") alerts.push({ tone: "warning", text: "Client is frozen — booking is blocked." });
  if (status === "expired") alerts.push({ tone: "danger", text: "No active package — client cannot book." });
  if (!(client as any).parqCompleted) alerts.push({ tone: "warning", text: "PAR-Q not completed." });
  if (!(client as any).waiverAccepted) alerts.push({ tone: "warning", text: "Liability waiver not signed." });

  for (const p of list) {
    if ((p as any).frozen) alerts.push({ tone: "info", text: `Package "${(p as any).name ?? p.type}" is frozen.` });
    if (!(p as any).adminApproved) alerts.push({ tone: "warning", text: `Package "${(p as any).name ?? p.type}" is awaiting approval.` });
    const ps = ((p as any).paymentStatus ?? "unpaid") as PackagePaymentStatus;
    if (ps === "unpaid" || ps === "pending") alerts.push({ tone: "warning", text: `Package "${(p as any).name ?? p.type}" payment is ${ps}.` });
    if (p.expiryDate) {
      const days = Math.round((new Date(p.expiryDate as any).getTime() - Date.now()) / 86400000);
      if (days <= 7 && days >= 0 && p.isActive) alerts.push({ tone: "warning", text: `Package "${(p as any).name ?? p.type}" expires in ${days} day(s).` });
      if (days < 0 && p.isActive) alerts.push({ tone: "danger", text: `Package "${(p as any).name ?? p.type}" expired ${Math.abs(days)} day(s) ago.` });
    }
    const remaining = p.totalSessions - p.usedSessions;
    if (remaining <= 2 && remaining > 0 && p.isActive) alerts.push({ tone: "warning", text: `Only ${remaining} session(s) left on "${(p as any).name ?? p.type}".` });
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <Bell size={13} /> Alerts ({alerts.length})
      </p>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.clientDetail.noAlerts", "All clear — no active alerts for this client.")}</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li
              key={i}
              data-testid={`alert-${i}`}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                a.tone === "danger"
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : a.tone === "warning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-200"
              }`}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =============== SESSION HISTORY (audit log) ===============

function SessionHistoryCard({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useQuery<PackageSessionHistory[]>({
    queryKey: ["/api/admin/clients", userId, "session-history"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/clients/${userId}/session-history`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load history");
      return r.json();
    },
  });
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5 mb-3">
        <Activity size={13} /> Session & package history
      </p>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("admin.clientDetail.noHistory", "No history yet.")}</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {data.map((row) => (
            <li
              key={row.id}
              data-testid={`history-${row.id}`}
              className="flex items-start gap-3 text-xs border-b border-white/5 pb-2 last:border-0"
            >
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {row.createdAt ? format(new Date(row.createdAt), "MMM d, HH:mm") : ""}
              </span>
              <div className="min-w-0">
                <p className="font-medium">
                  {SESSION_HISTORY_ACTION_LABELS[row.action as keyof typeof SESSION_HISTORY_ACTION_LABELS] ?? row.action}
                  {row.sessionsDelta !== 0 && (
                    <span className={`ml-2 ${row.sessionsDelta > 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {row.sessionsDelta > 0 ? "+" : ""}{row.sessionsDelta}
                    </span>
                  )}
                </p>
                {row.reason && <p className="text-muted-foreground mt-0.5">{row.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
