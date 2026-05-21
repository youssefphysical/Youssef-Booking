import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useClients } from "@/hooks/use-clients";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Merge, Search, ShieldCheck } from "lucide-react";
import type { UserResponse } from "@shared/schema";

type ClientRow = UserResponse & {
  clientStatus?: string | null;
  mergedIntoUserId?: number | null;
};

export default function AdminMergeClients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [loserId, setLoserId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: clientsRaw = [], isLoading } = useClients();
  const clients = clientsRaw as ClientRow[];

  const mergeMutation = useMutation({
    mutationFn: async (payload: { winnerId: number; loserId: number }) => {
      const r = await apiRequest("POST", "/api/admin/clients/merge", payload);
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: "Clients merged",
        description: "Bookings, packages and history have been folded into the survivor.",
      });
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      setWinnerId(null);
      setLoserId(null);
      setConfirmOpen(false);
    },
    onError: (e: any) => {
      toast({
        title: "Merge failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = clients.filter((c) => !c.mergedIntoUserId);
    if (!q) return rows.slice(0, 60);
    return rows.filter((c) =>
      [c.fullName, c.email, c.phone, c.username]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [clients, search]);

  const winner = clients.find((c) => c.id === winnerId) || null;
  const loser = clients.find((c) => c.id === loserId) || null;
  const canMerge = !!winner && !!loser && winner.id !== loser.id;

  // Phase 5 review fix — preview what will move *before* the admin
  // confirms. Only fetches when both sides are picked & valid.
  const preview = useQuery<{
    counts: Record<string, number>;
    total: number;
    warning: string | null;
  }>({
    queryKey: [
      `/api/admin/clients/merge-preview?winnerId=${winnerId}&loserId=${loserId}`,
    ],
    enabled: canMerge,
  });

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Phase 5 · Hardening</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-merge-title">
            Merge duplicate clients
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            Folds the loser account into the survivor — bookings, packages, body metrics, photos,
            check-ins, notes and notifications all move over. The loser is soft-deleted (status
            <span className="text-foreground"> merged</span>) and can never log in again. Action is
            audit-logged.
          </p>
        </div>

        <div className="admin-card mb-5">
          <div className="flex items-center gap-3 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone"
              className="bg-white/5 border-white/10"
              data-testid="input-merge-search"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ClientPicker
                title="Survivor (winner)"
                hint="This account stays. All data moves here."
                rows={filtered}
                selectedId={winnerId}
                onSelect={setWinnerId}
                accent="primary"
                testIdPrefix="winner"
              />
              <ClientPicker
                title="Duplicate (loser)"
                hint="This account is folded in and soft-deleted."
                rows={filtered}
                selectedId={loserId}
                onSelect={setLoserId}
                accent="danger"
                testIdPrefix="loser"
              />
            </div>
          )}
        </div>

        {canMerge && (
          <div className="admin-card mb-5" data-testid="card-merge-preview">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  What will move
                </p>
                <h2 className="font-display font-bold text-base">
                  Preview ·{" "}
                  <span className="text-primary">
                    {preview.data?.total ?? (preview.isLoading ? "…" : 0)}
                  </span>{" "}
                  rows
                </h2>
              </div>
              {preview.isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {preview.data?.warning && (
              <p
                className="text-xs text-amber-300 mb-3"
                data-testid="text-merge-warning"
              >
                ⚠ {preview.data.warning}
              </p>
            )}
            {preview.data && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(preview.data.counts).map(([key, count]) => (
                  <div
                    key={key}
                    className={`rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs ${
                      count > 0 ? "text-foreground" : "text-muted-foreground/60"
                    }`}
                    data-testid={`text-merge-count-${key}`}
                  >
                    <div className="font-mono text-base text-primary">{count}</div>
                    <div className="capitalize">{key.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="admin-card flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div className="text-sm space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending merge</p>
            <p>
              <span className="text-primary font-semibold">{winner?.fullName || "—"}</span>
              <span className="text-muted-foreground mx-2">←</span>
              <span className="text-red-300 font-semibold">{loser?.fullName || "—"}</span>
            </p>
            {canMerge && (
              <p className="text-xs text-muted-foreground">
                {loser?.email || loser?.phone || `#${loser?.id}`} will be merged into{" "}
                {winner?.email || winner?.phone || `#${winner?.id}`}.
              </p>
            )}
          </div>
          <Button
            type="button"
            disabled={!canMerge || mergeMutation.isPending || preview.isLoading}
            onClick={() => setConfirmOpen(true)}
            data-testid="button-merge-open-confirm"
            className="hover-elevate active-elevate-2"
          >
            {mergeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Merge className="h-4 w-4 mr-2" />
            )}
            Merge accounts
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent data-testid="dialog-merge-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Confirm merge
              </AlertDialogTitle>
              <AlertDialogDescription>
                This is irreversible. <strong>{loser?.fullName}</strong> will be folded into{" "}
                <strong>{winner?.fullName}</strong>.{" "}
                <strong data-testid="text-confirm-total">{preview.data?.total ?? 0}</strong> rows
                across bookings, packages, body data, photos and notes will move to the survivor.
                The loser account will be soft-deleted and unable to log in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-merge-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="button-merge-confirm"
                onClick={() =>
                  canMerge && mergeMutation.mutate({ winnerId: winner!.id, loserId: loser!.id })
                }
              >
                Merge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ClientPicker({
  title,
  hint,
  rows,
  selectedId,
  onSelect,
  accent,
  testIdPrefix,
}: {
  title: string;
  hint: string;
  rows: ClientRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  accent: "primary" | "danger";
  testIdPrefix: string;
}) {
  const border = accent === "primary" ? "border-primary/30" : "border-red-500/30";
  const activeBg = accent === "primary" ? "bg-primary/10" : "bg-red-500/10";
  const activeText = accent === "primary" ? "text-primary" : "text-red-300";

  return (
    <div className={`rounded-2xl border ${border} bg-white/[0.02] p-4`}>
      <div className="mb-3">
        <h2 className="font-display font-bold text-sm">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No matches.</p>
        )}
        {rows.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              data-testid={`button-${testIdPrefix}-${c.id}`}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover-elevate active-elevate-2 ${
                active ? `${activeBg} ${activeText}` : "text-foreground/85 hover:bg-white/[0.04]"
              }`}
            >
              <div className="font-medium">{c.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {c.email || c.username || "—"}
                {c.phone ? ` · ${c.phone}` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
