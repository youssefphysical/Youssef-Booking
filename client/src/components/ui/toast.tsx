import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

/**
 * Premium glass toast viewport.
 *
 * Positioning rules (per May 2026 polish brief):
 *   • Mobile  — top-center, full-width column, anchored below the
 *               notch via env(safe-area-inset-top). Centered with
 *               items-center so toasts read like a banner across the
 *               width without crowding the home pill in the corner.
 *   • Desktop — top-right (sm:items-end + sm:right-0 + sm:top-0),
 *               capped at 420px to match the legacy footprint.
 *
 * pointer-events-none on the viewport lets the user keep tapping
 * underneath even while a toast is mounted; each toast root re-enables
 * pointer-events-auto. Anchored above admin top bar (z-[100] vs
 * sticky tabs z-30, drawer z-50, command palette z-50 — Radix portals
 * to body so portal stacking handles the rest).
 */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    className={cn(
      "pointer-events-none fixed inset-x-0 top-0 z-[100] flex max-h-screen flex-col items-center gap-2 px-3",
      "sm:left-auto sm:right-0 sm:top-0 sm:items-end sm:max-w-[420px] sm:px-4 sm:pt-3",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

/**
 * Glass toast variants — calm, premium, AMOLED-friendly.
 *
 * All variants share: rounded-2xl, border + soft tinted background,
 * backdrop-blur-md, soft tonal shadow. Differences are tone only.
 *   • default     — neutral (bg-card glass)
 *   • success     — emerald
 *   • info        — cyan (Tron primary tone)
 *   • warning     — amber
 *   • destructive — soft red (kept `destructive group` for legacy
 *                   .destructive child selectors in ToastClose etc.)
 *
 * No transform-based open/close animation — slides in from top-full
 * on mobile and from right-full on desktop using Radix's swipe vars,
 * which compile to GPU-friendly translate3d under the hood. compact
 * padding (p-4 pr-9) so multi-line toasts don't feel oversized.
 * w-full keeps mobile full-width inside the centered viewport,
 * sm:w-auto lets desktop toasts size to content within max-w-[420px].
 */
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full sm:w-auto items-start gap-3 overflow-hidden rounded-2xl border p-4 pr-9 backdrop-blur-md transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-right-full",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-card/90 text-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]",
        success:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-50 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.45)]",
        info:
          "border-cyan-500/25 bg-cyan-500/10 text-cyan-50 shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.45)]",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-50 shadow-[0_10px_30px_-12px_rgba(245,158,11,0.45)]",
        destructive:
          "destructive group border-red-500/30 bg-red-500/10 text-red-50 shadow-[0_10px_30px_-12px_rgba(239,68,68,0.45)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
