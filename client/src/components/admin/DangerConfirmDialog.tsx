import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, TriangleAlert } from "lucide-react";

interface DangerConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /**
   * When set, the confirm button is disabled until the user types this exact
   * string into the keyword field (case-sensitive). Useful for destructive
   * operations like "MERGE" or "REPAIR".
   */
  confirmKeyword?: string;
  onConfirm: () => void;
  isPending?: boolean;
  confirmLabel?: string;
  testId?: string;
}

export function DangerConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmKeyword,
  onConfirm,
  isPending,
  confirmLabel = "Confirm",
  testId = "dialog-danger-confirm",
}: DangerConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  const keywordOk = !confirmKeyword || typed === confirmKeyword;

  function handleOpenChange(next: boolean) {
    if (!next) setTyped("");
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-card border-white/10" data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-400">
            <TriangleAlert size={18} className="shrink-0" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {confirmKeyword && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{confirmKeyword}</span> to
              confirm:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmKeyword}
              className="bg-white/5 border-white/10 font-mono"
              data-testid={`${testId}-keyword-input`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isPending}
            onClick={() => setTyped("")}
            data-testid={`${testId}-cancel`}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!keywordOk || isPending}
            onClick={onConfirm}
            data-testid={`${testId}-confirm`}
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
          >
            {isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
