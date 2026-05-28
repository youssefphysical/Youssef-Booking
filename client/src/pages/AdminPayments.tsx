import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  CreditCard,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCcw,
  ReceiptText,
  Download,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminEmptyState,
  AdminSkeleton,
} from "@/components/admin/primitives";
import {
  PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_METHODS,
  PAYMENT_RECORD_STATUS_LABELS,
  PAYMENT_RECORD_METHOD_LABELS,
  insertPaymentSchema,
  type Payment,
  type UserResponse,
} from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDateDubai } from "@shared/dates";

type PaymentWithUser = Payment & {
  user: { id: number; fullName: string; email: string | null } | null;
  package: { id: number; name: string | null; type: string | null } | null;
};

type PaymentSummary = {
  totalReceived: number;
  totalPending: number;
  countThisMonth: number;
};

const FMT_AED = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  received: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  failed: "bg-red-500/15 text-red-300 border-red-500/20",
  refunded: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  partial: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={12} />,
  received: <CheckCircle2 size={12} />,
  failed: <AlertCircle size={12} />,
  refunded: <RefreshCcw size={12} />,
  partial: <ReceiptText size={12} />,
};

const createPaymentFormSchema = insertPaymentSchema.omit({ packageId: true, paidAt: true }).extend({
  userId: z.number({ required_error: "Client is required" }).int().positive("Client is required"),
  amount: z.number({ required_error: "Amount is required" }).int().min(1, "Amount must be at least AED 1"),
  paidAt: z.string().optional(),
  packageId: z.number().int().optional(),
});
type CreatePaymentForm = z.infer<typeof createPaymentFormSchema>;

function exportPaymentsToCSV(payments: PaymentWithUser[]) {
  const today = new Date().toISOString().slice(0, 10);
  const headers = ["Date", "Client", "Package", "Amount (AED)", "Method", "Status", "Reference", "Notes"];

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = payments.map((p) => [
    escape(p.createdAt ? formatDateDubai(p.createdAt) : ""),
    escape(p.user?.fullName ?? "Unknown"),
    escape(p.package?.name || p.package?.type || ""),
    escape(String(p.amount)),
    escape(PAYMENT_RECORD_METHOD_LABELS[p.method as keyof typeof PAYMENT_RECORD_METHOD_LABELS] ?? p.method),
    escape(PAYMENT_RECORD_STATUS_LABELS[p.status as keyof typeof PAYMENT_RECORD_STATUS_LABELS] ?? p.status),
    escape(p.receiptReference ?? ""),
    escape(p.notes ?? ""),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPayments() {
  const { toast } = useToast();
  const [search, setSearch] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("search") ?? "";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("status") ?? "all";
  });
  const [methodFilter, setMethodFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("method") ?? "all";
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentWithUser | null>(null);

  const [userIdFilter] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("userId") ?? "";
  });

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (methodFilter !== "all") queryParams.set("method", methodFilter);
  if (fromDate) queryParams.set("from", fromDate);
  if (toDate) queryParams.set("to", toDate);
  if (search) queryParams.set("search", search);
  if (userIdFilter) queryParams.set("userId", userIdFilter);
  const qString = queryParams.toString();

  const { data: payments = [], isLoading, error } = useQuery<PaymentWithUser[]>({
    queryKey: ["/api/admin/payments", qString],
    queryFn: () =>
      fetch(`/api/admin/payments${qString ? `?${qString}` : ""}`, { credentials: "include" }).then(
        (r) => r.json(),
      ),
  });

  const { data: summary } = useQuery<PaymentSummary>({
    queryKey: ["/api/admin/payments/summary"],
  });

  const hasFilters = statusFilter !== "all" || methodFilter !== "all" || !!fromDate || !!toDate || !!search || !!userIdFilter;
  const clearFilters = () => {
    setStatusFilter("all");
    setMethodFilter("all");
    setFromDate("");
    setToDate("");
    setSearch("");
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/summary"] });
      toast({ title: "Payment deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to delete", variant: "destructive" }),
  });

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
        <AdminPageHeader
          eyebrow="Financial"
          title="Payments"
          subtitle="Track all received and pending payments in AED"
          testId="text-payments-title"
          right={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportPaymentsToCSV(payments)}
                disabled={payments.length === 0}
                data-testid="button-export-payments-csv"
                className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
              >
                <Download size={14} />
                Export CSV
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
                data-testid="button-new-payment"
                className="gap-2"
              >
                <Plus size={14} />
                New Payment
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <AdminStatCard
            icon={<CheckCircle2 size={16} />}
            label="Total Received"
            value={summary?.totalReceived ?? 0}
            format="currencyAED"
            tone="success"
            animate
            testId="stat-payments-received"
          />
          <AdminStatCard
            icon={<Clock size={16} />}
            label="Total Pending"
            value={summary?.totalPending ?? 0}
            format="currencyAED"
            tone="warning"
            animate
            testId="stat-payments-pending"
          />
          <AdminStatCard
            icon={<CreditCard size={16} />}
            label="Payments This Month"
            value={summary?.countThisMonth ?? 0}
            tone="info"
            animate
            testId="stat-payments-this-month"
          />
        </div>

        <AdminCard padded={false} className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client or reference…"
                className="ps-9 h-9 bg-white/5 border-white/10"
                data-testid="input-search-payments"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10 text-xs" data-testid="select-payment-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PAYMENT_RECORD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{PAYMENT_RECORD_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[150px] h-9 bg-white/5 border-white/10 text-xs" data-testid="select-payment-method">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {PAYMENT_RECORD_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_RECORD_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[140px] h-9 bg-white/5 border-white/10 text-xs"
              data-testid="input-from-date"
              placeholder="From"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[140px] h-9 bg-white/5 border-white/10 text-xs"
              data-testid="input-to-date"
              placeholder="To"
            />
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-colors"
                data-testid="button-clear-payment-filters"
              >
                Clear
              </button>
            )}
            <span className="ms-auto text-[11px] text-muted-foreground tabular-nums">
              {payments.length} record{payments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </AdminCard>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <AdminSkeleton key={i} className="h-20" rounded="xl" />
            ))}
          </div>
        ) : error ? (
          <AdminCard className="text-center py-10">
            <p className="text-sm text-destructive" data-testid="text-payments-error">
              Failed to load payments
            </p>
          </AdminCard>
        ) : payments.length === 0 ? (
          <AdminEmptyState
            icon={<CreditCard size={28} />}
            title={hasFilters ? "No matching payments" : "No payments yet"}
            body={
              hasFilters
                ? "Try clearing filters to see all records."
                : "Create the first payment record using the button above."
            }
            testId="text-payments-empty"
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <AdminCard padded={false} className="overflow-hidden">
                <table className="w-full text-sm" data-testid="table-payments">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-muted-foreground/70">
                      <th className="text-start px-4 py-3 font-medium">Client</th>
                      <th className="text-start px-4 py-3 font-medium">Package</th>
                      <th className="text-start px-4 py-3 font-medium">Amount</th>
                      <th className="text-start px-4 py-3 font-medium">Method</th>
                      <th className="text-start px-4 py-3 font-medium">Status</th>
                      <th className="text-start px-4 py-3 font-medium">Reference</th>
                      <th className="text-start px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {payments.map((p, i) => (
                      <PaymentRow
                        key={p.id}
                        payment={p}
                        index={i}
                        onDelete={() => setDeleteTarget(p)}
                      />
                    ))}
                  </tbody>
                </table>
              </AdminCard>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {payments.map((p, i) => (
                <PaymentCard
                  key={p.id}
                  payment={p}
                  index={i}
                  onDelete={() => setDeleteTarget(p)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <CreatePaymentDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/summary"] });
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the{" "}
              <strong>{FMT_AED.format(deleteTarget?.amount ?? 0)}</strong> payment
              {deleteTarget?.user ? ` for ${deleteTarget.user.fullName}` : ""}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-payment">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-payment"
            >
              {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
        STATUS_COLORS[status] ?? "bg-white/10 text-muted-foreground border-white/10",
      )}
    >
      {STATUS_ICONS[status]}
      {PAYMENT_RECORD_STATUS_LABELS[status as keyof typeof PAYMENT_RECORD_STATUS_LABELS] ?? status}
    </span>
  );
}

function PaymentRow({
  payment,
  index,
  onDelete,
}: {
  payment: PaymentWithUser;
  index: number;
  onDelete: () => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="hover:bg-white/[0.02] transition-colors"
      data-testid={`row-payment-${payment.id}`}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-sm leading-tight">
          {payment.user?.fullName ?? "Unknown"}
        </p>
        {payment.user?.email && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{payment.user.email}</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
        {payment.package
          ? <span className="truncate block">{payment.package.name || payment.package.type}</span>
          : <span className="text-white/20">—</span>}
      </td>
      <td className="px-4 py-3 font-semibold tabular-nums text-primary">
        {FMT_AED.format(payment.amount)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
        {PAYMENT_RECORD_METHOD_LABELS[payment.method as keyof typeof PAYMENT_RECORD_METHOD_LABELS] ?? payment.method}
      </td>
      <td className="px-4 py-3">
        <PaymentStatusPopover payment={payment} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {payment.receiptReference || "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {payment.createdAt ? formatDateDubai(payment.createdAt) : "—"}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          data-testid={`button-delete-payment-${payment.id}`}
          aria-label="Delete payment"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </motion.tr>
  );
}

function PaymentCard({
  payment,
  index,
  onDelete,
}: {
  payment: PaymentWithUser;
  index: number;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-xl border border-white/[0.08] bg-card/60 p-4"
      data-testid={`card-payment-${payment.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">
            {payment.user?.fullName ?? "Unknown"}
          </p>
          {payment.user?.email && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{payment.user.email}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PaymentStatusPopover payment={payment} />
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            data-testid={`button-delete-card-payment-${payment.id}`}
            aria-label="Delete payment"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {payment.package && (
        <p className="text-[11px] text-muted-foreground mb-2">
          {payment.package.name || payment.package.type}
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="font-bold tabular-nums text-primary">{FMT_AED.format(payment.amount)}</span>
        <span className="text-muted-foreground capitalize">
          {PAYMENT_RECORD_METHOD_LABELS[payment.method as keyof typeof PAYMENT_RECORD_METHOD_LABELS] ?? payment.method}
        </span>
        {payment.receiptReference && (
          <span className="font-mono text-[11px] text-muted-foreground">{payment.receiptReference}</span>
        )}
        <span className="text-muted-foreground tabular-nums ml-auto text-xs">
          {payment.createdAt ? formatDateDubai(payment.createdAt) : "—"}
        </span>
      </div>
      {payment.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic border-t border-white/5 pt-2">
          {payment.notes}
        </p>
      )}
    </motion.div>
  );
}

function PaymentStatusPopover({ payment }: { payment: PaymentWithUser }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(payment.notes ?? "");

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      apiRequest("PATCH", `/api/admin/payments/${payment.id}`, body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/summary"] });
      toast({ title: "Payment updated" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: e?.message || "Update failed", variant: "destructive" }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1"
          data-testid={`button-status-popover-${payment.id}`}
        >
          <StatusBadge status={payment.status} />
          <ChevronDown size={10} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 space-y-3" align="start">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Update payment
        </p>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_RECORD_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => patchMutation.mutate({ status: s, notes: notes || undefined })}
                disabled={patchMutation.isPending}
                data-testid={`button-set-status-${s}-${payment.id}`}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                  payment.status === s
                    ? STATUS_COLORS[s]
                    : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                {PAYMENT_RECORD_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="text-xs bg-white/5 border-white/10 resize-none"
            data-testid={`textarea-payment-notes-${payment.id}`}
          />
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={patchMutation.isPending}
          onClick={() => patchMutation.mutate({ status: payment.status, notes: notes || undefined })}
          data-testid={`button-save-payment-notes-${payment.id}`}
        >
          {patchMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
          Save notes
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function CreatePaymentDialog({
  open,
  onOpenChange,
  onCreated,
  prefillUserId,
  prefillUserName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  prefillUserId?: number;
  prefillUserName?: string;
}) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const { data: packages = [] } = useQuery<any[]>({
    queryKey: ["/api/packages"],
    enabled: open,
  });
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const form = useForm<CreatePaymentForm>({
    resolver: zodResolver(createPaymentFormSchema),
    defaultValues: {
      userId: prefillUserId,
      status: "pending",
      method: "cash",
      amount: 0,
      receiptReference: "",
      notes: "",
      paidAt: "",
    },
  });

  const isPrefilled = !!prefillUserId;

  const selectedUserId = form.watch("userId");
  const selectedClient = useMemo(
    () => (clients as UserResponse[]).find((c) => c.id === selectedUserId),
    [clients, selectedUserId],
  );
  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    return (clients as UserResponse[]).filter(
      (c) =>
        !q ||
        (c.fullName ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [clients, clientSearch]);

  const clientPackages = useMemo(
    () => (packages ?? []).filter((p: any) => p.userId === selectedUserId),
    [packages, selectedUserId],
  );

  const createMutation = useMutation({
    mutationFn: (body: CreatePaymentForm) =>
      apiRequest("POST", "/api/admin/payments", {
        ...body,
        packageId: body.packageId || null,
        paidAt: body.paidAt || null,
        receiptReference: body.receiptReference || null,
        notes: body.notes || null,
      }).then((r) => r.json()),
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      form.reset({ userId: prefillUserId, status: "pending", method: "cash", amount: 0, receiptReference: "", notes: "", paidAt: "" });
      setClientSearch("");
      toast({ title: "Payment created" });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to create payment", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            New Payment
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4"
            data-testid="form-create-payment"
          >
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  {isPrefilled ? (
                    <div
                      className="flex items-center gap-2 h-9 px-3 rounded-md border border-white/10 bg-white/5 text-sm text-foreground"
                      data-testid="select-payment-client-prefilled"
                    >
                      {prefillUserName ?? `Client #${prefillUserId}`}
                    </div>
                  ) : (
                    <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            data-testid="select-payment-client"
                            className={cn(
                              "w-full justify-between font-normal bg-white/5 border-white/10 hover:bg-white/10",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {selectedClient
                              ? `${selectedClient.fullName}${selectedClient.email ? ` — ${selectedClient.email}` : ""}`
                              : "Select client…"}
                            <ChevronsUpDown size={14} className="ms-2 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[380px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search by name or email…"
                            value={clientSearch}
                            onValueChange={setClientSearch}
                            data-testid="input-client-search"
                          />
                          <CommandList>
                            <CommandEmpty>No clients found.</CommandEmpty>
                            <CommandGroup>
                              {filteredClients.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={String(c.id)}
                                  onSelect={() => {
                                    field.onChange(c.id);
                                    form.setValue("packageId", undefined);
                                    setClientPickerOpen(false);
                                    setClientSearch("");
                                  }}
                                >
                                  <Check
                                    size={14}
                                    className={cn(
                                      "mr-2 shrink-0",
                                      field.value === c.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <span className="truncate">
                                    {c.fullName}
                                    {c.email ? (
                                      <span className="text-muted-foreground ml-1 text-xs">— {c.email}</span>
                                    ) : null}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="packageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package (optional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                    value={field.value ? String(field.value) : "none"}
                    disabled={!selectedUserId}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-package">
                        <SelectValue placeholder="Link to package…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No package</SelectItem>
                      {clientPackages.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name || p.type} — {p.totalSessions} sessions
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (AED) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 2500"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      data-testid="input-payment-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-method-form">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_RECORD_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{PAYMENT_RECORD_METHOD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-status-form">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_RECORD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{PAYMENT_RECORD_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="receiptReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Reference</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. TXN-1234"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-payment-reference"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paidAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-payment-date"
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes…"
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                      data-testid="textarea-payment-notes-new"
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-create-payment"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-create-payment"
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Create Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
