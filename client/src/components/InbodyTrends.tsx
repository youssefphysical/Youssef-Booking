import { useMemo } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { InbodyRecord } from "@shared/schema";

type Direction = "up" | "down" | "flat";
type Sentiment = "good" | "bad" | "neutral";

type Series = {
  key: "weight" | "bodyFat" | "muscleMass";
  label: string;
  unit: string;
  /** Direction of change that's GOOD for the client */
  goodDirection: "up" | "down" | "either";
  goodChip: string;
  badChip: string;
  neutralChip: string;
};

const SERIES: Series[] = [
  {
    key: "bodyFat",
    label: "Body Fat",
    unit: "%",
    goodDirection: "down",
    goodChip: "Fat is improving",
    badChip: "Fat is rising",
    neutralChip: "Fat is steady",
  },
  {
    key: "muscleMass",
    label: "Muscle Mass",
    unit: "kg",
    goodDirection: "up",
    goodChip: "Muscle is growing",
    badChip: "Muscle is dropping",
    neutralChip: "Muscle is stable",
  },
  {
    key: "weight",
    label: "Weight",
    unit: "kg",
    goodDirection: "either",
    goodChip: "Trending toward goal",
    badChip: "Trending away from goal",
    neutralChip: "Weight is stable",
  },
];

function classifyDirection(latest: number, prior: number): Direction {
  const delta = latest - prior;
  // Treat <0.3 absolute change as flat to avoid noise
  if (Math.abs(delta) < 0.3) return "flat";
  return delta > 0 ? "up" : "down";
}

function sentimentFor(s: Series, dir: Direction): Sentiment {
  if (dir === "flat") return "neutral";
  if (s.goodDirection === "either") return "neutral";
  if (s.goodDirection === "up") return dir === "up" ? "good" : "bad";
  return dir === "down" ? "good" : "bad";
}

function chipColour(sentiment: Sentiment): string {
  if (sentiment === "good")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (sentiment === "bad")
    return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

function strokeColour(sentiment: Sentiment): string {
  if (sentiment === "good") return "#34d399"; // emerald-400
  if (sentiment === "bad") return "#f87171"; // red-400
  return "#fbbf24"; // amber-400
}

export function InbodyTrends({ records }: { records: InbodyRecord[] }) {
  // Sort oldest -> newest for a left-to-right time axis.
  const ordered = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime(),
      ),
    [records],
  );

  if (ordered.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Add at least 2 InBody scans to see trend charts.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4" data-testid="inbody-trends">
      {SERIES.map((s) => {
        const points = ordered
          .map((r) => ({
            t: r.recordedAt ? new Date(r.recordedAt).getTime() : 0,
            label: r.recordedAt ? format(new Date(r.recordedAt), "MMM d") : "",
            value: r[s.key] as number | null,
          }))
          .filter((p) => p.value != null) as { t: number; label: string; value: number }[];

        if (points.length < 2) {
          return (
            <div
              key={s.key}
              className="rounded-2xl border border-white/10 bg-card/60 p-5"
              data-testid={`trend-card-${s.key}`}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="text-sm text-muted-foreground mt-3">Not enough data</p>
            </div>
          );
        }

        const latest = points[points.length - 1].value;
        const prior = points[points.length - 2].value;
        const dir = classifyDirection(latest, prior);
        const sentiment = sentimentFor(s, dir);
        const stroke = strokeColour(sentiment);
        const chipClass = chipColour(sentiment);
        const chipText =
          sentiment === "good" ? s.goodChip : sentiment === "bad" ? s.badChip : s.neutralChip;
        const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
        const delta = latest - prior;
        const deltaTxt = `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${s.unit}`;

        return (
          <div
            key={s.key}
            className="rounded-2xl border border-white/10 bg-card/60 p-5"
            data-testid={`trend-card-${s.key}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-2xl font-display font-bold mt-1">
                  {latest.toFixed(1)}
                  <span className="text-sm text-muted-foreground font-normal">
                    {" "}
                    {s.unit}
                  </span>
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border ${chipClass}`}
                data-testid={`trend-delta-${s.key}`}
              >
                <Icon size={11} /> {deltaTxt}
              </span>
            </div>

            <div className="h-32 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#888"
                    tick={{ fontSize: 10, fill: "#888" }}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#888"
                    tick={{ fontSize: 10, fill: "#888" }}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    width={28}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0c0e14",
                      border: "1px solid #ffffff15",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#aaa" }}
                    formatter={(v: any) => [`${v} ${s.unit}`, s.label]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={stroke}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: stroke }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p
              className={`mt-3 inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border ${chipClass}`}
              data-testid={`trend-chip-${s.key}`}
            >
              {chipText}
            </p>
          </div>
        );
      })}
    </div>
  );
}
