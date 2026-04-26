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
import { formatStatus, statusColor } from "@/lib/booking-utils";
import {
  PACKAGE_DEFINITIONS,
  type UserResponse,
  type Package,
  type InbodyRecord,
  type ProgressPhoto,
} from "@shared/schema";
import { api } from "@shared/routes";

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
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
            {client.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-client-name">{client.fullName}</h1>
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
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 text-sm font-semibold"
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
        <TabsContent value="bookings"><BookingsList userId={client.id} /></TabsContent>
        <TabsContent value="packages"><PackagesPanel client={client} /></TabsContent>
        <TabsContent value="inbody"><InbodyPanel userId={client.id} /></TabsContent>
        <TabsContent value="progress"><ProgressPanel userId={client.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ client }: { client: UserResponse }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <InfoCard icon={<Target size={13} />} label="Fitness Goal" value={client.fitnessGoal || "—"} />
      <InfoCard icon={<MapPin size={13} />} label="Area" value={client.area || "—"} />
      <InfoCard
        icon={<HeartPulse size={13} />}
        label="Emergency Contact"
        value={
          client.emergencyContactName || client.emergencyContactPhone
            ? `${client.emergencyContactName || ""} ${client.emergencyContactPhone ? `• ${client.emergencyContactPhone}` : ""}`
            : "—"
        }
      />
      <InfoCard
        icon={<Calendar size={13} />}
        label="Member Since"
        value={client.createdAt ? format(new Date(client.createdAt), "PPP") : "—"}
      />
      <InfoCard icon={<Notebook size={13} />} label="Notes" value={client.notes || "—"} className="sm:col-span-2" />
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
            className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]"
            data-testid={`detail-booking-${b.id}`}
          >
            <div className="text-sm">
              <span className="font-semibold">{format(new Date(b.date), "EEE, MMM d, yyyy")}</span>
              <span className="text-muted-foreground ml-3">{b.timeSlot}</span>
              {b.notes && <span className="text-xs text-muted-foreground ml-3 italic">"{b.notes}"</span>}
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
            >
              {formatStatus(b.status)}
            </span>
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
