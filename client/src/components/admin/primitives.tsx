import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Hoisted formatters — avoid per-frame allocations during count-up animation.
const FMT_INT = new Intl.NumberFormat("en-US");
const FMT_EGP = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

export type AdminTone =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "schedule"
  | "muted";

export const ADMIN_TONE_BG: Record<AdminTone, string> = {
  default: "bg-primary/15 text-primary",
  info: "bg-sky-500/15 text-sky-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
  schedule: "bg-cyan-500/15 text-cyan-300",
  muted: "bg-white/[0.06] text-muted-foreground",
};

export const ADMIN_TONE_TEXT: Record<AdminTone, string> = {
  default: "text-primary",
  info: "text-sky-300",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-red-300",
  schedule: "text-cyan-300",
  muted: "text-muted-foreground",
};

// =====================================================
// Card — single source for the dark-luxury panel pattern
// =====================================================
export function AdminCard({
  children,
  className,
  padded = true,
  testId,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  testId?: string;
  as?: any;
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl sm:rounded-3xl border border-white/8 bg-[rgba(8,15,28,0.82)] shadow-sm shadow-black/20",
        padded && "p-3.5 sm:p-5",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </Tag>
  );
}

// =====================================================
// PageHeader — eyebrow + title + subtitle, consistent rhythm
// =====================================================
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  testId,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="mb-4 sm:mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary mb-1 sm:mb-1.5">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="text-[22px] sm:text-3xl font-display font-bold leading-tight"
          data-testid={testId}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground text-[12.5px] sm:text-sm mt-0.5 sm:mt-1">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

// =====================================================
// SectionTitle — small in-card header with optional CTA
// =====================================================
export function AdminSectionTitle({
  title,
  cta,
}: {
  title: string;
  cta?: { href: string; label: string; testId?: string; external?: boolean };
}) {
  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4 gap-3">
      <h3 className="font-display font-bold text-[15px] sm:text-lg truncate">
        {title}
      </h3>
      {cta ? (
        cta.external ? (
          <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] sm:text-xs text-primary inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
            data-testid={cta.testId}
          >
            {cta.label} <ExternalLink size={12} />
          </a>
        ) : (
          <Link
            href={cta.href}
            className="text-[11px] sm:text-xs text-primary inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
            data-testid={cta.testId}
          >
            {cta.label} <ChevronRight size={12} className="rtl:rotate-180" />
          </Link>
        )
      ) : null}
    </div>
  );
}

// =====================================================
// CountUp — eased animated counter for premium KPIs
// =====================================================
export function useAdminCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// =====================================================
// StatCard — premium KPI tile
// =====================================================
export function AdminStatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
  testId,
  spanFullOnMobile = false,
  format = "int",
  animate = false,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone?: AdminTone;
  testId: string;
  spanFullOnMobile?: boolean;
  format?: "int" | "percent" | "currencyEGP" | "raw";
  animate?: boolean;
}) {
  const isNumber = typeof value === "number";
  const animated = useAdminCountUp(isNumber && animate ? (value as number) : 0);
  const toRender = isNumber && animate ? animated : (isNumber ? value : 0);
  const display = !isNumber
    ? (value as string)
    : format === "percent"
      ? `${Math.round((toRender as number) * 100)}%`
      : format === "currencyEGP"
        ? FMT_EGP.format(Math.round(toRender as number))
        : format === "int"
          ? FMT_INT.format(Math.round(toRender as number))
          : String(toRender);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border border-white/8 bg-[rgba(8,15,28,0.82)] p-3 sm:p-5 min-h-[92px] sm:min-h-[108px] flex flex-col justify-between shadow-sm shadow-black/20",
        spanFullOnMobile && "col-span-2 lg:col-span-1",
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
            ADMIN_TONE_BG[tone],
          )}
        >
          {icon}
        </div>
        <p className="text-[22px] sm:text-[28px] font-display font-bold leading-none tracking-tight tabular-nums text-end">
          {display}
        </p>
      </div>
      <div>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 leading-snug break-words [overflow-wrap:anywhere] line-clamp-2 font-medium uppercase tracking-wide">
          {label}
        </p>
        {sub ? (
          <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 leading-snug">{sub}</p>
        ) : null}
      </div>
    </motion.div>
  );
}

// =====================================================
// AlertRow — urgent strip item with priority semantics
// =====================================================
export function AdminAlertRow({
  icon,
  count,
  label,
  href,
  tone,
  testId,
}: {
  icon: ReactNode;
  count: number;
  label: string;
  href: string;
  tone: AdminTone;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        "flex items-center gap-2.5 sm:gap-3 min-h-[56px] sm:min-h-[60px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border transition-colors",
        count > 0
          ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl shrink-0",
          count > 0 ? ADMIN_TONE_BG[tone] : ADMIN_TONE_BG.muted,
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-display font-bold text-lg sm:text-xl leading-none tabular-nums",
              count > 0 ? ADMIN_TONE_TEXT[tone] : "text-muted-foreground/70",
            )}
          >
            {count}
          </span>
        </div>
        <p className="text-[11px] sm:text-[12px] text-muted-foreground leading-snug mt-0.5 truncate">
          {label}
        </p>
      </div>
      <ChevronRight
        size={14}
        className={cn(
          "shrink-0 rtl:rotate-180",
          count > 0 ? "text-muted-foreground/80" : "text-muted-foreground/40",
        )}
      />
    </Link>
  );
}

// =====================================================
// ChartCard — wrapper for recharts panels (consistent height + heading)
// =====================================================
export function AdminChartCard({
  title,
  subtitle,
  children,
  testId,
  height = "h-[220px] sm:h-[260px]",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testId: string;
  height?: string;
}) {
  return (
    <AdminCard testId={testId}>
      <div className="mb-3 sm:mb-4">
        <h3 className="font-display font-bold text-[14.5px] sm:text-base leading-tight">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className={height}>{children}</div>
    </AdminCard>
  );
}

// =====================================================
// EmptyState — premium empty placeholder
// =====================================================
export function AdminEmptyState({
  icon,
  title,
  body,
  cta,
  testId,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  cta?: { href: string; label: string; testId?: string };
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-10 px-4"
      data-testid={testId}
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center text-muted-foreground/80 mb-3">
        {icon}
      </div>
      <h4 className="font-display font-bold text-[14.5px] sm:text-base leading-tight">{title}</h4>
      {body ? (
        <p className="text-[12px] text-muted-foreground mt-1 max-w-[28ch] leading-relaxed">
          {body}
        </p>
      ) : null}
      {cta ? (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
          data-testid={cta.testId}
        >
          {cta.label}
          <ChevronRight size={13} className="rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  );
}
