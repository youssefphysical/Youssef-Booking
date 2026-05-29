import { useEffect, useRef, useState, useCallback } from "react";
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
import { createElement } from "react";

/**
 * Guards unsaved form changes from accidental navigation.
 *
 * Attaches a `beforeunload` listener (tab close / hard refresh) and patches
 * `history.pushState` to intercept Wouter link clicks while `isDirty` is
 * true. Returns a `guard` React element — render it anywhere in the tree.
 *
 * Usage:
 *   const { guard } = useUnsavedChanges(form.formState.isDirty);
 *   return <>{guard}<form>…</form></>;
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const pendingUrlRef = useRef<string | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const orig = window.history.pushState.bind(window.history);

    window.history.pushState = function (data, unused, url) {
      if (isDirtyRef.current && url != null) {
        pendingUrlRef.current = String(url);
        setShowDialog(true);
        return;
      }
      orig(data, unused, url);
    };

    return () => {
      window.history.pushState = orig;
    };
  }, []);

  const confirmNav = useCallback(() => {
    setShowDialog(false);
    const url = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (url) {
      const orig = Object.getPrototypeOf(window.history).pushState.bind(window.history);
      orig(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    }
  }, []);

  const cancelNav = useCallback(() => {
    setShowDialog(false);
    pendingUrlRef.current = null;
  }, []);

  const guard = createElement(
    AlertDialog,
    { open: showDialog, onOpenChange: (o: boolean) => !o && cancelNav() },
    createElement(
      AlertDialogContent,
      { className: "bg-card border-white/10" },
      createElement(
        AlertDialogHeader,
        null,
        createElement(AlertDialogTitle, null, "Unsaved changes"),
        createElement(
          AlertDialogDescription,
          null,
          "You have unsaved changes. If you leave now your edits will be lost.",
        ),
      ),
      createElement(
        AlertDialogFooter,
        null,
        createElement(AlertDialogCancel, { onClick: cancelNav }, "Stay"),
        createElement(AlertDialogAction, { onClick: confirmNav }, "Leave anyway"),
      ),
    ),
  );

  return { guard };
}
