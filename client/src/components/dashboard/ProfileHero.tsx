import { Link } from "wouter";
import { motion } from "framer-motion";
import { Crown, Sparkles, Star, Target } from "lucide-react";
import { differenceInWeeks } from "date-fns";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { VIP_TIER_LABELS, VIP_TIER_TAGLINES, normaliseTier } from "@shared/schema";
import { useTranslation } from "@/i18n";

// Cinematic profile hero (May 2026 luxury redesign).
// Pure presentational layer — consumes the existing `useAuth().user` shape
// and known package start date; no new API surface, no schema changes.
// Replaces the old greeting + avatar + small VIP chip block at the top of
// /dashboard with an athlete-portfolio style header (large display name,
// goal subtitle, glowing tier badge, soft cyan halos).

const GOAL_LABELS: Record<string, { label: string; subtitle: string }> = {
  weight_loss: { label: "Fat Loss Transformation", subtitle: "Lean, defined, sustainable" },
  muscle_gain: { label: "Muscle Gain Journey", subtitle: "Stronger every week" },
  body_recomposition: { label: "Body Recomposition", subtitle: "Build muscle, drop fat" },
  athletic_performance: { label: "Athletic Performance Phase", subtitle: "Train like an athlete" },
  general_fitness: { label: "General Fitness Journey", subtitle: "Move better, feel better" },
  rehabilitation: { label: "Rehabilitation Program", subtitle: "Rebuild with care" },
};

function tierIcon(tier: string) {
  if (tier === "diamond_elite" || tier === "pro_elite" || tier === "elite") return Crown;
  if (tier === "momentum") return Star;
  return Sparkles;
}

function tierColor(tier: string): string {
  switch (tier) {
    case "diamond_elite":
      return "bg-gradient-to-r from-cyan-400/20 to-violet-500/20 border-cyan-300/40 text-cyan-100 shadow-[0_0_24px_-6px_hsl(183_100%_60%/0.35)]";
    case "pro_elite":
      return "bg-gradient-to-r from-fuchsia-500/15 to-purple-500/15 border-fuchsia-400/30 text-fuchsia-200";
    case "elite":
      return "bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-amber-400/30 text-amber-200";
    case "momentum":
      return "bg-emerald-500/15 border-emerald-400/30 text-emerald-200";
    case "starter":
      return "bg-sky-500/10 border-sky-400/30 text-sky-200";
    default:
      return "bg-blue-500/10 border-blue-400/30 text-blue-200";
  }
}

export function ProfileHero({
  user,
  joinedAt,
}: {
  user: {
    fullName: string;
    profilePictureUrl?: string | null;
    isVerified?: boolean | null;
    vipTier?: string | null;
    primaryGoal?: string | null;
  };
  /** Earliest known training-program start. Falls back to undefined → no
   *  week counter shown. Pass active package's startDate or createdAt. */
  joinedAt?: string | Date | null;
}) {
  const { t } = useTranslation();
  const tier = normaliseTier(user.vipTier);
  const TierIcon = tierIcon(tier);
  const goal = user.primaryGoal ? GOAL_LABELS[user.primaryGoal] : null;
  const weeks =
    joinedAt != null
      ? Math.max(1, differenceInWeeks(new Date(), new Date(joinedAt as any)) + 1)
      : null;
  const subtitle = goal
    ? weeks
      ? `${goal.label} · Week ${weeks}`
      : goal.label
    : t("dashboard.subtitle");

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080808]/95 p-6 sm:p-8 mb-6"
      data-testid="profile-hero"
    >
      <CyanHairline intensity="strong" />
      {/* Cinematic radial glows — top-left + bottom-right for depth without weight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, hsl(183 100% 60% / 0.22), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, hsl(183 100% 60% / 0.14), transparent 70%)" }}
      />
      {/* Subtle vertical noise gradient to give depth on AMOLED */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, hsl(183 100% 60% / 0.02) 100%)",
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
        <Link
          href="/profile"
          data-testid="link-hero-avatar"
          className="shrink-0 self-start sm:self-center"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-2 rounded-full opacity-70 blur-md"
              style={{
                background:
                  "radial-gradient(circle, hsl(183 100% 60% / 0.55), transparent 70%)",
              }}
            />
            <div className="relative rounded-full ring-2 ring-primary/45 ring-offset-2 ring-offset-[#050505]">
              <UserAvatar
                src={user.profilePictureUrl}
                name={user.fullName}
                size={92}
                testId="img-hero-avatar"
              />
            </div>
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="tron-eyebrow text-[10px] font-semibold mb-2">
            {t("dashboard.eyebrow")}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold leading-[1.05] tracking-tight"
              data-testid="text-hero-name"
            >
              {user.fullName}
            </h1>
            {user.isVerified && (
              <VerifiedBadge size="md" testId="badge-hero-verified" />
            )}
          </div>
          <div
            className="mt-3 flex items-center gap-2 text-sm sm:text-base text-foreground/85"
            data-testid="text-hero-subtitle"
          >
            <Target size={15} className="text-primary shrink-0" />
            <span>{subtitle}</span>
          </div>
          <div className="mt-4">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border ${tierColor(
                tier,
              )}`}
              data-testid={`hero-vip-${tier}`}
            >
              <TierIcon size={12} />
              {VIP_TIER_LABELS[tier] ?? t("dashboard.member")}
              <span className="hidden sm:inline opacity-70 normal-case font-normal text-[10px]">
                · {VIP_TIER_TAGLINES[tier]?.split(".")[0] ?? ""}
              </span>
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
