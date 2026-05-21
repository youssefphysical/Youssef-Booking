import { useMemo } from "react";

type Cell = { dow: number; hour: number; count: number };

const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CapacityHeatmap({
  hours,
  cells,
}: {
  hours: number[];
  cells: Cell[];
}) {
  const { matrix, max } = useMemo(() => {
    const m = new Map<string, number>();
    let mx = 0;
    for (const c of cells) {
      m.set(`${c.dow}:${c.hour}`, c.count);
      if (c.count > mx) mx = c.count;
    }
    return { matrix: m, max: mx };
  }, [cells]);

  function bg(count: number): string {
    if (count === 0) return "rgba(255,255,255,0.03)";
    const intensity = Math.min(1, count / Math.max(max, 1));
    // Tron-cyan ramp, low-saturation floor → full primary at top.
    const a = 0.12 + intensity * 0.78;
    return `hsl(183 100% 65% / ${a.toFixed(3)})`;
  }
  function textColor(count: number): string {
    if (count === 0) return "rgba(255,255,255,0.25)";
    return count / Math.max(max, 1) > 0.45 ? "#03101a" : "rgba(255,255,255,0.9)";
  }

  return (
    <div className="overflow-x-auto" data-testid="capacity-heatmap">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-[10px] text-muted-foreground font-normal w-10" />
            {hours.map((h) => (
              <th
                key={h}
                className="text-[10px] text-muted-foreground font-normal tabular-nums"
                title={`${h}:00`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW_LABEL.map((label, dow) => (
            <tr key={dow}>
              <td className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold pr-2 text-end">
                {label}
              </td>
              {hours.map((h) => {
                const v = matrix.get(`${dow}:${h}`) ?? 0;
                return (
                  <td
                    key={h}
                    className="rounded-md text-center align-middle"
                    style={{
                      background: bg(v),
                      width: 24,
                      height: 24,
                      fontSize: 10,
                      color: textColor(v),
                      fontWeight: 600,
                    }}
                    title={`${label} ${h}:00 — ${v} session${v === 1 ? "" : "s"}`}
                    data-testid={`heatmap-cell-${dow}-${h}`}
                  >
                    {v > 0 ? v : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((i) => (
          <span
            key={i}
            className="rounded-sm"
            style={{
              width: 14,
              height: 14,
              background:
                i === 0 ? "rgba(255,255,255,0.05)" : `hsl(183 100% 65% / ${0.12 + i * 0.78})`,
            }}
          />
        ))}
        <span>More</span>
        <span className="ml-auto">Last 90 days · Dubai local</span>
      </div>
    </div>
  );
}
