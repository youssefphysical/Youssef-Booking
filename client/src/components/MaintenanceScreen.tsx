import { Wrench } from "lucide-react";

export function MaintenanceScreen() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6 bg-background text-foreground"
      data-testid="screen-maintenance"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className="mx-auto h-16 w-16 rounded-full flex items-center justify-center border"
          style={{
            borderColor: "hsl(183 100% 74% / 0.4)",
            background: "hsl(183 100% 74% / 0.06)",
            boxShadow: "0 0 24px hsl(183 100% 74% / 0.18)",
          }}
        >
          <Wrench className="h-7 w-7" style={{ color: "hsl(183 100% 74%)" }} aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-maintenance-title">
            We'll be right back
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Youssef is making a few improvements to the platform. Please check back in a few minutes —
            your account and bookings are safe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          data-testid="button-maintenance-retry"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover-elevate active-elevate-2"
          style={{
            borderColor: "hsl(183 100% 74% / 0.4)",
            color: "hsl(183 100% 74%)",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
