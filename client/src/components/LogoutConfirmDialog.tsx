import { LogOut, Loader2 } from "lucide-react";
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
import { useTranslation } from "@/i18n";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

export function LogoutConfirmDialog({ open, onOpenChange, onConfirm, isPending }: Props) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={(next) => (!isPending ? onOpenChange(next) : null)}>
      <AlertDialogContent
        className="max-w-sm rounded-2xl border-white/10 bg-card/95 backdrop-blur-xl p-5 sm:p-6 gap-3"
        data-testid="dialog-logout-confirm"
      >
        <AlertDialogHeader className="text-start">
          <div className="mx-auto sm:mx-0 mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <LogOut size={18} />
          </div>
          <AlertDialogTitle data-testid="text-logout-title" className="text-base sm:text-lg">
            {t("auth.logout.title", "Log out?")}
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="text-logout-description" className="text-sm leading-relaxed">
            {t("auth.logout.message", "Are you sure you want to log out?")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel
            disabled={isPending}
            data-testid="button-logout-cancel"
            className="h-10 rounded-xl"
          >
            {t("auth.logout.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            data-testid="button-logout-confirm"
            className="h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin no-rtl-flip" />
                <span>{t("auth.logout.loading", "Logging out…")}</span>
              </>
            ) : (
              <span>{t("auth.logout.confirm", "Yes, log out")}</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
