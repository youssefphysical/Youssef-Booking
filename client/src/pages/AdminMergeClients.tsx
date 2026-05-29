import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Loader2, Merge, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DangerConfirmDialog } from "@/components/admin/DangerConfirmDialog";
import type { UserResponse } from "@shared/schema";

type ClientRow = UserResponse & {
  clientStatus?: string | null;
  mergedIntoUserId?: number | null;
};

function useClientSearch(q: string) {
  return useQuery<ClientRow[]>({
    queryKey: ["/api/admin/search", q],
    queryFn: async () => {
      if (q.trim().length < 1) return [];
      const r = await apiRequest("GET", `/api/admin/search?q=${encodeURIComponent(q.trim())}`);
      const data = await r.json();
      return (Array.isArray(data) ? data : data.results ?? []) as ClientRow[];
    },
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}

export default function AdminMergeClients() {
  const { toast } = useToast();
  const [winnerSearch, setWinnerSearch] = useState("");
  const [loserSearch, setLoserSearch] = useState("");
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [loserId, setLoserId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [winnerQ, setWinnerQ] = useState("");
  const [loserQ, setLoserQ] = useState("");

  const winnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (winnerTimer.current) clearTimeout(winnerTimer.current);
    winnerTimer.current = setTimeout(() => setWinnerQ(winnerSearch), 300);
    return () => { if (winnerTimer.current) clearTimeout(winnerTimer.current); };
  }, [winnerSearch]);

  useEffect(() => {
    if (loserTimer.current) clearTimeout(loserTimer.current);
    loserTimer.current = setTimeout(() => setLoserQ(loserSearch), 300);
    return () => { if (loserTimer.current) clearTimeout(loserTimer.current); };
  }, [loserSearch]);

  const winnerResults = useClientSearch(winnerQ);
  const loserResults = useClientSearch(loserQ);

  const allResults = [
    ...(winnerResults.data ?? []),
    ...(loserResults.data ?? []),
  ];

  const winner = allResults.find((c) => c.id === winnerId) ?? null;
  const loser = allResults.find((c) => c.id === loserId) ?? null;
  const canMerge = !!winner && !!loser && winner.id !== loser.id;

  const preview = useQuery<{
    counts: Record<string, number>;
    total: number;
    warning: string | null;
  }>({
    queryKey: [`/api/admin/clients/merge-preview?winnerId=${winnerId}&loserId=${loserId}`],
    enabled: canMerge,
  });

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
      setWinnerSearch("");
      setLoserSearch("");
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

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Admin · Super Admin</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-merge-title">
            Merge duplicate clients
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            Folds the loser account into the survivor — bookings, packages, body metrics, photos,
            check-ins, notes and notifications all move over. The loser is soft-deleted (status{" "}
            <span className="text-foreground">merged</span>) and can never log in again. Action is
            audit-logged.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <ClientSearch
            title="Survivor (winner)"
            hint="This account stays. All data moves here."
            accent="primary"
            search={winnerSearch}
            onSearchChange={(v) => {
              setWinnerSearch(v);
              if (winnerId) setWinnerId(null);
            }}
            results={winnerResults.data ?? []}
            isLoading={winnerResults.isFetching}
            selectedId={winnerId}
            excludeId={loserId}
            onSelect={setWinnerId}
            testIdPrefix="winner"
          />
          <ClientSearch
            title="Duplicate (loser)"
            hint="This account is folded in and soft-deleted."
            accent="danger"
            search={loserSearch}
            onSearchChange={(v) => {
              setLoserSearch(v);
              if (loserId) setLoserId(null);
            }}
            results={loserResults.data ?? []}
            isLoading={loserResults.isFetching}
            selectedId={loserId}
            excludeId={winnerId}
            onSelect={setLoserId}
            testIdPrefix="loser"
          />
        </div>

        {canMerge && (
          <div className="admin-card mb-5" data-testid="card-merge-preview">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">What will move</p>
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
              <p className="text-xs text-amber-300 mb-3" data-testid="text-merge-warning">
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

        <DangerConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirm merge — this is irreversible"
          description={
            <span>
              <strong>{loser?.fullName}</strong> will be folded into{" "}
              <strong>{winner?.fullName}</strong>.{" "}
              <strong data-testid="text-confirm-total">{preview.data?.total ?? 0}</strong> rows across
              bookings, packages, body data, photos and notes will move to the survivor. The loser
              account will be soft-deleted and unable to log in.
            </span>
          }
          confirmKeyword="MERGE"
          confirmLabel="Merge accounts"
          onConfirm={() =>
            canMerge && mergeMutation.mutate({ winnerId: winner!.id, loserId: loser!.id })
          }
          isPending={mergeMutation.isPending}
          testId="dialog-merge-confirm"
        />
      </div>
    </div>
  );
}

function ClientSearch({
  title,
  hint,
  accent,
  search,
  onSearchChange,
  results,
  isLoading,
  selectedId,
  excludeId,
  onSelect,
  testIdPrefix,
}: {
  title: string;
  hint: string;
  accent: "primary" | "danger";
  search: string;
  onSearchChange: (v: string) => void;
  results: ClientRow[];
  isLoading: boolean;
  selectedId: number | null;
  excludeId: number | null;
  onSelect: (id: number) => void;
  testIdPrefix: string;
}) {
  const border = accent === "primary" ? "border-primary/30" : "border-red-500/30";
  const activeBg = accent === "primary" ? "bg-primary/10" : "bg-red-500/10";
  const activeText = accent === "primary" ? "text-primary" : "text-red-300";

  const visible = results.filter((c) => !c.mergedIntoUserId && c.id !== excludeId);
  const selected = results.find((c) => c.id === selectedId);

  return (
    <div className={`rounded-2xl border ${border} bg-white/[0.02] p-4 space-y-3`}>
      <div>
        <h2 className="font-display font-bold text-sm">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      {selected && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg ${activeBg} ${activeText} text-sm`}
          data-testid={`selected-${testIdPrefix}`}
        >
          <div>
            <div className="font-semibold">{selected.fullName}</div>
            <div className="text-xs opacity-70">{selected.email || selected.username || "—"}</div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(selectedId!)}
            className="text-xs opacity-60 hover:opacity-100 ml-2 shrink-0"
            data-testid={`button-deselect-${testIdPrefix}`}
          >
            ✕
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="bg-white/5 border-white/10 pl-8 text-sm"
          data-testid={`input-${testIdPrefix}-search`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {search.trim().length > 0 && !isLoading && (
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {visible.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 text-center">No matches.</p>
          )}
          {visible.map((c) => {
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
      )}

      {search.trim().length === 0 && !selected && (
        <p className="text-xs text-muted-foreground/50 text-center py-2">
          Type to search clients
        </p>
      )}
    </div>
  );
}
