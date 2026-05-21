import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Check,
  Plus,
  CalendarClock,
  Bell,
  StickyNote,
  Eye,
  X,
  Loader2,
} from "lucide-react";

/**
 * Task #57 — floating admin Quick Actions panel.
 * Anchored bottom-right on every client detail page; collapses to a
 * single round Zap button until expanded. Each action funnels through
 * the existing admin REST endpoints (which now also write to the
 * admin audit log via the `audit()` seam in server/routes.ts).
 *
 * Actions:
 *  • Approve package         POST /api/admin/packages/:id/approve
 *  • Add session             POST /api/admin/packages/:id/sessions-adjust
 *  • Extend expiry           POST /api/admin/packages/:id/extend
 *  • Send notification       POST /api/admin/clients/:id/notify
 *  • Add note                PATCH /api/admin/clients/:id/admin-notes
 *  • View as client          POST /api/admin/impersonate/:userId
 */
export function QuickActionsPanel({
  clientId,
  clientName,
  packageId,
}: {
  clientId: number;
  clientName: string;
  packageId?: number | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | "add_session" | "extend" | "notify" | "note">(null);
  const [draft, setDraft] = useState<string>("");
  const [days, setDays] = useState<number>(7);
  const [sessions, setSessions] = useState<number>(1);

  const invalidateClient = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/clients/${clientId}/activity`] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/clients/${clientId}/audit-log`] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
  };

  const approve = useMutation({
    mutationFn: async () => {
      if (!packageId) throw new Error("No active package");
      await apiRequest("POST", `/api/admin/packages/${packageId}/approve`, { approved: true });
    },
    onSuccess: () => {
      toast({ title: "Package approved" });
      invalidateClient();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addSession = useMutation({
    mutationFn: async () => {
      if (!packageId) throw new Error("No active package");
      await apiRequest("POST", `/api/admin/packages/${packageId}/sessions-adjust`, {
        delta: sessions,
        reason: draft || "Manual session grant",
      });
    },
    onSuccess: () => {
      toast({ title: `+${sessions} session${sessions > 1 ? "s" : ""}` });
      invalidateClient();
      setModal(null);
      setDraft("");
      setSessions(1);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const extend = useMutation({
    mutationFn: async () => {
      if (!packageId) throw new Error("No active package");
      await apiRequest("POST", `/api/admin/packages/${packageId}/extend`, {
        addDays: days,
        reason: draft || `Extended by ${days} days`,
      });
    },
    onSuccess: () => {
      toast({ title: `Expiry extended by ${days}d` });
      invalidateClient();
      setModal(null);
      setDraft("");
      setDays(7);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const notify = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/clients/${clientId}/notify`, {
        title: "Message from your coach",
        body: draft,
        link: "/dashboard",
      });
    },
    onSuccess: () => {
      toast({ title: "Notification sent" });
      invalidateClient();
      setModal(null);
      setDraft("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/clients/${clientId}/admin-notes`, {
        adminNotes: draft,
      });
    },
    onSuccess: () => {
      toast({ title: "Note saved" });
      invalidateClient();
      setModal(null);
      setDraft("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  async function viewAsClient() {
    try {
      await apiRequest("POST", `/api/admin/impersonate/${clientId}`);
      queryClient.invalidateQueries();
      window.location.assign("/dashboard");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  return (
    <>
      <div
        className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2"
        data-testid="quick-actions-panel"
      >
        {open && (
          <div className="rounded-2xl border border-white/10 bg-[#0a0f17]/95 backdrop-blur-md shadow-2xl shadow-primary/10 p-2 w-[240px] space-y-1">
            <ActionRow
              icon={<Check size={14} />}
              label="Approve package"
              onClick={() => approve.mutate()}
              busy={approve.isPending}
              disabled={!packageId}
              testId="qa-approve"
            />
            <ActionRow
              icon={<Plus size={14} />}
              label="Add session"
              onClick={() => { setModal("add_session"); setOpen(false); }}
              disabled={!packageId}
              testId="qa-add-session"
            />
            <ActionRow
              icon={<CalendarClock size={14} />}
              label="Extend expiry"
              onClick={() => { setModal("extend"); setOpen(false); }}
              disabled={!packageId}
              testId="qa-extend"
            />
            <ActionRow
              icon={<Bell size={14} />}
              label="Send notification"
              onClick={() => { setModal("notify"); setOpen(false); }}
              testId="qa-notify"
            />
            <ActionRow
              icon={<StickyNote size={14} />}
              label="Add note"
              onClick={() => { setModal("note"); setOpen(false); }}
              testId="qa-note"
            />
            <ActionRow
              icon={<Eye size={14} />}
              label="View as client"
              onClick={viewAsClient}
              testId="qa-view-as"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid="button-quick-actions-toggle"
          className="w-12 h-12 rounded-full bg-primary text-black shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
          aria-label="Quick actions"
        >
          {open ? <X size={18} /> : <Zap size={18} />}
        </button>
      </div>

      {modal && (
        <Modal title={MODAL_TITLES[modal]} onClose={() => setModal(null)}>
          {modal === "add_session" && (
            <>
              <NumberField label="Sessions to add" value={sessions} setValue={setSessions} min={1} max={50} testId="input-add-sessions" />
              <TextField label="Reason (optional)" value={draft} setValue={setDraft} testId="input-reason" />
              <ModalActions
                busy={addSession.isPending}
                onConfirm={() => addSession.mutate()}
                onCancel={() => setModal(null)}
                confirmLabel="Add sessions"
              />
            </>
          )}
          {modal === "extend" && (
            <>
              <NumberField label="Days to add" value={days} setValue={setDays} min={1} max={365} testId="input-extend-days" />
              <TextField label="Reason (optional)" value={draft} setValue={setDraft} testId="input-reason" />
              <ModalActions
                busy={extend.isPending}
                onConfirm={() => extend.mutate()}
                onCancel={() => setModal(null)}
                confirmLabel="Extend expiry"
              />
            </>
          )}
          {modal === "notify" && (
            <>
              <TextField label="Message" value={draft} setValue={setDraft} testId="input-notify-body" multiline />
              <ModalActions
                busy={notify.isPending}
                onConfirm={() => notify.mutate()}
                onCancel={() => setModal(null)}
                confirmLabel="Send"
                disabled={!draft.trim()}
              />
            </>
          )}
          {modal === "note" && (
            <>
              <p className="text-[11px] text-muted-foreground mb-2">
                Replaces the current admin note for {clientName}.
              </p>
              <TextField label="Note" value={draft} setValue={setDraft} testId="input-note-body" multiline />
              <ModalActions
                busy={addNote.isPending}
                onConfirm={() => addNote.mutate()}
                onCancel={() => setModal(null)}
                confirmLabel="Save note"
              />
            </>
          )}
        </Modal>
      )}
    </>
  );
}

const MODAL_TITLES: Record<string, string> = {
  add_session: "Add sessions",
  extend: "Extend expiry",
  notify: "Send notification",
  note: "Add note",
};

function ActionRow({
  icon,
  label,
  onClick,
  busy,
  disabled,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      data-testid={testId}
      className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-[12.5px] text-left text-foreground/90 hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <span className="text-primary">{busy ? <Loader2 size={14} className="animate-spin" /> : icon}</span>
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0f17] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="quick-action-modal"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-modal-close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NumberField({
  label, value, setValue, min, max, testId,
}: { label: string; value: number; setValue: (v: number) => void; min?: number; max?: number; testId: string }) {
  return (
    <label className="block mb-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Math.max(min ?? 0, Math.min(max ?? 9999, Number(e.target.value) || 0)))}
        data-testid={testId}
        className="mt-1 w-full h-9 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-sm focus:outline-none focus:border-primary/50"
      />
    </label>
  );
}

function TextField({
  label, value, setValue, multiline, testId,
}: { label: string; value: string; setValue: (v: string) => void; multiline?: boolean; testId: string }) {
  if (multiline) {
    return (
      <label className="block mb-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          data-testid={testId}
          className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
        />
      </label>
    );
  }
  return (
    <label className="block mb-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        data-testid={testId}
        className="mt-1 w-full h-9 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-sm focus:outline-none focus:border-primary/50"
      />
    </label>
  );
}

function ModalActions({
  busy, onConfirm, onCancel, confirmLabel, disabled,
}: { busy?: boolean; onConfirm: () => void; onCancel: () => void; confirmLabel: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-2">
      <button
        type="button"
        onClick={onCancel}
        data-testid="button-modal-cancel"
        className="h-9 px-3 rounded-lg text-[12px] text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        data-testid="button-modal-confirm"
        className="h-9 px-4 rounded-lg text-[12.5px] font-semibold bg-primary text-black hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}
