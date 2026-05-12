import { useMemo } from "react";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { TrendingDown, TrendingUp, Activity } from "lucide-react";
import { useInbodyRecords } from "@/hooks/use-inbody";
import type { InbodyRecord } from "@shared/schema";
import { useTranslation } from "@/i18n";

// Progress snapshot — one hero number (current weight + delta vs first
// reading) and a single ultra-minimal sparkline. NO axes, NO ticks, NO
// chart library. This is intentionally a single emotional moment, not
// an analytics dashboard. Falls back gracefully when there's <2 data
// points so the empty state still feels luxurious.

function buildSparkline(values: number[], width = 220, height = 56): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 8) - 4;
    return [x, y] as const;
  });
  // Smooth quadratic curve through the points.
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    d += ` Q ${px} ${py} ${mx} ${(py + cy) / 2}`;
    if (i === pts.length - 1) d += ` T ${cx} ${cy}`;
  }
  return d;
}

export function ProgressSnapshot({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: records = [], isLoading } = useInbodyRecords({ userId });

  const { latest, delta, sparkPath, count } = useMemo(() => {
    const list = (records as InbodyRecord[])
      .filter((r) => typeof r.weight === "number" && r.weight! > 0)
      .sort(
        (a, b) =>
          new Date(a.recordedAt as any).getTime() -
          new Date(b.recordedAt as any).getTime(),
      );
    if (list.length === 0) {
      return { latest: null, delta: null, sparkPath: "", count: 0 };
    }
    const first = list[0].weight as number;
    const last = list[list.length - 1].weight as number;
    return {
      latest: last,
      delta: last - first,
      sparkPath: buildSparkline(list.map((r) => r.weight as number)),
      count: list.length,
    };
  }, [records]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative h-full overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-6"
      data-testid="progress-snapshot"
    >
      <CyanHairline />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="tron-eyebrow text-[10px] font-semibold">
            {t("dashboard.progress", "Progress")}
          </p>
          {isLoading ? (
            <div className="mt-2 h-9 w-32 admin-shimmer rounded" />
          ) : latest === null ? (
            <h3 className="mt-1.5 text-xl sm:text-2xl font-display font-semibold leading-tight">
              {t("dashboard.noBodyData", "No data yet")}
            </h3>
          ) : (
            <>
              <h3
                className="mt-1.5 text-3xl sm:text-4xl font-display font-bold leading-none tabular-nums"
                data-testid="text-current-weight"
              >
                {latest.toFixed(1)}{" "}
                <span className="text-base sm:text-lg font-normal text-muted-foreground align-middle">
                  kg
                </span>
              </h3>
              {delta !== null && Math.abs(delta) >= 0.1 && (
                <p
                  className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${
                    delta < 0
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-400/25"
                      : "bg-cyan-500/10 text-cyan-300 border border-cyan-400/25"
                  }`}
                  data-testid="text-weight-delta"
                >
                  {delta < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} kg
                </p>
              )}
            </>
          )}
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/40 text-primary">
          <Activity size={18} />
        </div>
      </div>

      {/* Minimal sparkline — no axes, no ticks. */}
      {sparkPath ? (
        <div className="mt-5">
          <svg width="100%" height={56} viewBox="0 0 220 56" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(183 100% 60%)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="hsl(183 100% 60%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Soft area under the curve */}
            <motion.path
              d={`${sparkPath} L 220 56 L 0 56 Z`}
              fill="url(#sparkFill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <motion.path
              d={sparkPath}
              fill="none"
              stroke="hsl(183 100% 60%)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 0 6px hsl(183 100% 60% / 0.55))" }}
            />
          </svg>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {count} {t("dashboard.checkIns", "check-ins")} · {t("dashboard.sinceStart", "since you started")}
          </p>
        </div>
      ) : (
        !isLoading && (
          <p className="mt-4 text-xs text-muted-foreground max-w-xs">
            {t(
              "dashboard.progressEmpty",
              "Upload your first InBody scan and your trend will appear here.",
            )}
          </p>
        )
      )}
    </motion.section>
  );
}
