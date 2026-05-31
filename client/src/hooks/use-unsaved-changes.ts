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
 * Attaches a `beforeunload` listener (tab close / hard refresh) and
 * intercepts Wouter's `history.pushState` calls while `isDirty` is true.
 *
 * Uses a module-level singleton interceptor shared across ALL hook instances
 * on the page — avoids the "last-mounted wins" bug where each instance's
 * cleanup restores a stale pushState snapshot, leaving other instances
 * unprotected. Only one confirmation dialog opens at a time.
 *
 * Usage:
 *   const { guard } = useUnsavedChanges(form.formState.isDirty);
 *   return <>{guard}<form>…</form></>;
 */

// ─── Module-level singleton ────────────────────────────────────────────────
interface _Inst {
  isDirty: () => boolean;
  openDialog: (url: string) => void;
}

let _nextId = 0;
const _registry = new Map<number, _Inst>();
let _origPushState: typeof window.history.pushState | null = null;

function _anyDirty(): boolean {
  for (const v of Array.from(_registry.values())) if (v.isDirty()) return true;
  return false;
}

function _install() {
  if (_origPushState) return; // idempotent — only one interceptor ever installed
  _origPushState = window.history.pushState.bind(window.history);
  (window.history as any).pushState = function (
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    if (url != null && _anyDirty()) {
      const urlStr = String(url);
      for (const inst of Array.from(_registry.values())) {
        if (inst.isDirty()) {
          inst.openDialog(urlStr);
          return;
        }
      }
    }
    _origPushState!(data as any, unused, url as any);
  };
}

function _uninstall() {
  if (!_origPushState) return;
  (window.history as any).pushState = _origPushState;
  _origPushState = null;
}

function _doNavigate(url: string) {
  const push = _origPushState ?? window.history.pushState.bind(window.history);
  push(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────
export function useUnsavedChanges(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const pendingUrlRef = useRef<string | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const idRef = useRef(-1);
  if (idRef.current === -1) idRef.current = _nextId++;

  useEffect(() => {
    const id = idRef.current;
    _registry.set(id, {
      isDirty: () => isDirtyRef.current,
      openDialog: (url: string) => {
        pendingUrlRef.current = url;
        setShowDialog(true);
      },
    });
    _install();
    return () => {
      _registry.delete(id);
      if (_registry.size === 0) _uninstall();
    };
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const confirmNav = useCallback(() => {
    setShowDialog(false);
    const url = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (url) _doNavigate(url);
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
