import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Flame,
  Dumbbell,
  Trophy,
  Calendar,
  Crown,
  Sparkles,
  Lock,
  type LucideIcon,
} from "lucide-react";
import {
  BADGE_DEFINITIONS,
  type BadgeKey,
  type UserBadge,
} from "@shared/schema";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { CyanHairline } from "@/components/ui/CyanHairline";

// Task #74 — Achievements section on Profile.
// Renders the BADGE_DEFINITIONS catalogue, splitting earned from locked.
// New earnings since the last render fire a Tron-cyan toast (one per
// new badge). The bell-notification is still the canonical surface;
// this toast is just a quick celebratory cue when the user is on the
// page when an evaluation completes.

const ICONS: Record<string, LucideIcon> = {
  Flame,
  Dumbbell,
  Trophy,
  Calendar,
  Crown,
  Sparkles,
};

const TIER_GRADIENT: Record<string, string> = {
  bronze: "from-amber-700/20 to-amber-500/5 border-amber-500/30 text-amber-300",
  silver: "from-slate-400/20 to-slate-200/5 border-slate-300/30 text-slate-200",
  gold: "from-yellow-500/25 to-amber-400/5 border-yellow-400/40 text-yellow-300",
  platinum: "from-cyan-400/25 to-cyan-200/5 border-cyan-300/40 text-cyan-200",
};

function badgeLabel(t: (k: string, fb?: string) => string, key: BadgeKey) {
  return t(`badges.${key}.label`, defaultLabel(key));
}
function badgeDescription(t: (k: string, fb?: string) => string, key: BadgeKey) {
  return t(`badges.${key}.description`, defaultDescription(key));
}
function defaultLabel(key: BadgeKey): string {
  switch (key) {
    case "first_session": return "First Session";
    case "ten_sessions": return "10 Sessions";
    case "fifty_sessions": return "50 Sessions";
    case "consistency_champion": return "Consistency Champion";
    case "elite_discipline": return "Elite Discipline";
    case "transformation_started": return "Transformation Started";
  }
}
function defaultDescription(key: BadgeKey): string {
  switch (key) {
    case "first_session": return "Complete your first training session.";
    case "ten_sessions": return "Reach 10 completed sessions.";
    case "fifty_sessions": return "Reach 50 completed sessions.";
    case "consistency_champion": return "Train 3+ times every week for 4 weeks straight.";
    case "elite_discipline": return "Train 3+ times every single week for 12 weeks straight.";
    case "transformation_started": return "Complete your first session and upload your first InBody scan.";
  }
}

export function AchievementsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: badges = [], isLoading } = useQuery<UserBadge[]>({
    queryKey: ["/api/me/badges"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const earnedKeys = useMemo(() => new Set(badges.map((b) => b.badgeKey)), [badges]);
  const sorted = useMemo(
    () => [...BADGE_DEFINITIONS].sort((a, b) => a.order - b.order),
    [],
  );

  // Toast on freshly-earned badge (diff against previous render). The
  // bell notification is the canonical surface; this is just a quick
  // in-page celebration if the user happens to be on the Achievements
  // tab when evaluation completes.
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const prev = seenRef.current;
    if (prev == null) {
      seenRef.current = new Set(earnedKeys);
      return;
    }
    for (const k of Array.from(earnedKeys)) {
      if (!prev.has(k)) {
        toast({
          title: t("badges.toastTitle", "Badge unlocked"),
          description: badgeLabel(t, k as BadgeKey),
        });
      }
    }
    seenRef.current = new Set(earnedKeys);
  }, [earnedKeys, isLoading, toast, t]);

  const earnedCount = earnedKeys.size;
  const totalCount = sorted.length;

  return (
    <section
      id="achievements"
      className="relative overflow-hidden rounded-3xl border border-white/5 bg-card/60 p-6"
      data-testid="section-achievements"
    >
      <CyanHairline />
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary mb-1">
            {t("achievements.eyebrow", "Achievements")}
          </p>
          <h2 className="text-base font-semibold">
            {t("achievements.title", "Badges & milestones")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("achievements.subtitle", "Earn badges by training consistently and tracking your progress.")}
          </p>
        </div>
        <span
          className="text-[11px] uppercase tracking-widest text-muted-foreground"
          data-testid="text-achievements-progress"
        >
          {earnedCount} / {totalCount}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sorted.map((b) => (
            <div key={b.key} className="admin-shimmer h-[112px] rounded-2xl border border-white/[0.06]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sorted.map((def) => {
            const Icon = ICONS[def.icon] ?? Sparkles;
            const earned = earnedKeys.has(def.key);
            const label = badgeLabel(t, def.key);
            const desc = badgeDescription(t, def.key);
            return (
              <motion.div
                key={def.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                data-testid={`badge-tile-${def.key}`}
                data-earned={earned ? "true" : "false"}
                className={`relative rounded-2xl border p-4 overflow-hidden transition-all ${
                  earned
                    ? `bg-gradient-to-br ${TIER_GRADIENT[def.tier]} shadow-[0_0_18px_-12px_hsl(183_100%_60%/0.6)]`
                    : "border-white/10 bg-white/[0.02] text-muted-foreground"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                      earned ? "border-white/15 bg-white/5" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {earned ? <Icon size={18} /> : <Lock size={14} className="opacity-70" />}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        earned ? "" : "text-foreground/70"
                      }`}
                      data-testid={`badge-label-${def.key}`}
                    >
                      {label}
                    </p>
                    <p className="text-[11px] leading-snug mt-1 opacity-80">{desc}</p>
                  </div>
                </div>
                {earned && (
                  <p
                    className="mt-3 text-[10px] uppercase tracking-widest opacity-80"
                    data-testid={`badge-earned-at-${def.key}`}
                  >
                    {t("achievements.earned", "Earned")}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
