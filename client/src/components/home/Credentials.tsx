import { motion } from "framer-motion";
import {
  ShieldCheck,
  GraduationCap,
  Award,
  Globe,
  Heart,
  Trophy,
  Briefcase,
} from "lucide-react";
import { useTranslation } from "@/i18n";

/**
 * "Credentials You Can Trust" — Cinematic Refinement Pass (May-2026).
 *
 * Switched from a 2-col card grid to an editorial single-column list
 * with cyan hairline separators. Reads like the masthead of a luxury
 * magazine — quiet, authoritative — and contrasts with the dark-card
 * sections (Hero / Philosophy) without re-using the editorial-numbered
 * pattern from CompleteSystem.
 *
 * Items remain hardcoded per the master prompt (never invent / never
 * remove / never wrong level).
 *
 * Other refinements:
 *   • Section py-16 → py-14 on mobile.
 *   • Larger title (text-3xl → md:text-5xl) with tighter tracking.
 *   • Subtitle adds a single calm line of context.
 */
export function Credentials() {
  const { t } = useTranslation();
  const items = [
    {
      icon: <Globe size={20} />,
      name: t("creds.ereps.name", "EREPS EQF Graduate Exercise Professional"),
      org: t("creds.ereps.org", "European Qualifications Framework — EQF Level 6"),
    },
    {
      icon: <Award size={20} />,
      name: t("creds.reps.name", "REPs UAE Certified Personal Trainer"),
      org: t("creds.reps.org", "Register of Exercise Professionals UAE"),
    },
    {
      icon: <GraduationCap size={20} />,
      name: t("creds.bsc.name", "Bachelor's Degree in Physical Education"),
      org: t("creds.bsc.org", "Academic foundation in movement science"),
    },
    {
      icon: <ShieldCheck size={20} />,
      name: t("creds.cpt.name", "Certified Personal Trainer"),
      org: t("creds.cpt.org", "Internationally recognized certification"),
    },
    {
      icon: <Heart size={20} />,
      name: t("creds.first.name", "First Aid & CPR Certified"),
      org: t("creds.first.org", "Safety-first session standards"),
    },
    {
      icon: <Briefcase size={20} />,
      name: t("creds.teacher.name", "Physical Education Teacher Background"),
      org: t("creds.teacher.org", "Years of structured coaching experience"),
    },
    {
      icon: <Trophy size={20} />,
      name: t("creds.exp.name", "5+ Years Coaching Experience"),
      org: t("creds.exp.org", "Premium personal training in Dubai"),
    },
  ];

  return (
    <section className="relative py-14 md:py-24" id="credentials" data-testid="credentials-section">
      <div className="relative max-w-3xl mx-auto px-5">
        <div className="text-center mb-10 md:mb-14">
          <p className="tron-eyebrow text-[11px] mb-3">
            {t("creds.eyebrow", "COACH YOUSSEF")}
          </p>
          <h2 className="font-display font-bold text-3xl md:text-5xl tracking-[-0.02em] leading-[1.05]">
            {t("creds.title", "Credentials You Can Trust")}
          </h2>
          <p className="mt-4 text-sm md:text-base text-muted-foreground/85 leading-relaxed max-w-xl mx-auto">
            {t(
              "creds.subtitle",
              "Verified qualifications. Documented experience. Quiet authority.",
            )}
          </p>
        </div>
        <ul className="divide-y divide-white/5">
          {items.map((it, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.04, duration: 0.45 }}
              className="flex items-start gap-4 md:gap-5 py-5"
              data-testid={`cred-${i}`}
            >
              <span className="w-11 h-11 rounded-xl bg-primary/[0.08] border border-primary/20 flex items-center justify-center text-primary shrink-0">
                {it.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-base md:text-lg leading-snug text-foreground/95">
                  {it.name}
                </h3>
                <p className="text-xs md:text-sm text-primary/75 mt-1 tracking-wide">
                  {it.org}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
