type FunnelData = {
  registered: number;
  trialBooked: number;
  trialCompleted: number;
  converted: number;
  active: number;
};

const STAGES: Array<{ key: keyof FunnelData; label: string; hint: string }> = [
  { key: "registered", label: "Registered", hint: "All-time signups" },
  { key: "trialBooked", label: "Trial booked", hint: "Booked a trial session" },
  { key: "trialCompleted", label: "Trial completed", hint: "Trial completed" },
  { key: "converted", label: "Converted", hint: "Paid package" },
  { key: "active", label: "Active", hint: "Currently retained" },
];

export function TrialFunnel({ data }: { data: FunnelData }) {
  const max = Math.max(1, ...STAGES.map((s) => data[s.key]));
  return (
    <div className="space-y-2" data-testid="trial-funnel">
      {STAGES.map((stage, i) => {
        const v = data[stage.key];
        const pct = (v / max) * 100;
        // Conversion vs previous stage
        const prev = i === 0 ? null : data[STAGES[i - 1].key];
        const conv = prev && prev > 0 ? (v / prev) * 100 : null;
        return (
          <div key={stage.key} data-testid={`funnel-${stage.key}`}>
            <div className="flex items-center justify-between text-[11.5px] mb-1">
              <span className="font-semibold text-foreground/90">{stage.label}</span>
              <span className="text-muted-foreground tabular-nums">
                <span className="text-foreground font-display font-bold">{v}</span>
                {conv != null && (
                  <span className="ml-2 text-[10px] text-primary/80">
                    {conv.toFixed(0)}% step
                  </span>
                )}
              </span>
            </div>
            <div className="h-7 rounded-md bg-white/[0.03] border border-white/5 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-primary/80 via-primary/60 to-primary/30"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  transition: "width 600ms ease-out",
                  boxShadow: "0 0 12px -4px hsl(183 100% 60% / 0.6)",
                }}
              />
              <div className="absolute inset-0 flex items-center px-2 text-[10px] text-muted-foreground">
                {stage.hint}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
