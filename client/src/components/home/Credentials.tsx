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
 * "Credentials You Can Trust" — clean authority section. Hardcoded
 * because these are facts about the coach, NOT marketing copy. Per
 * the master prompt: never invent / never remove / never wrong level.
 */
export function Credentials() {
  const { t } = useTranslation();
  const items = [
    {
      icon: <Globe size={18} />,
      name: t("creds.ereps.name", "EREPS EQF Graduate Exercise Professional"),
      org: t("creds.ereps.org", "European Qualifications Framework — EQF Level 6"),
    },
    {
      icon: <Award size={18} />,
      name: t("creds.reps.name", "REPs UAE Certified Personal Trainer"),
      org: t("creds.reps.org", "Register of Exercise Professionals UAE"),
    },
    {
      icon: <GraduationCap size={18} />,
      name: t("creds.bsc.name", "Bachelor's Degree in Physical Education"),
      org: t("creds.bsc.org", "Academic foundation in movement science"),
    },
    {
      icon: <ShieldCheck size={18} />,
      name: t("creds.cpt.name", "Certified Personal Trainer"),
      org: t("creds.cpt.org", "Internationally recognized certification"),
    },
    {
      icon: <Heart size={18} />,
      name: t("creds.first.name", "First Aid & CPR Certified"),
      org: t("creds.first.org", "Safety-first session standards"),
    },
    {
      icon: <Briefcase size={18} />,
      name: t("creds.teacher.name", "Physical Education Teacher Background"),
      org: t("creds.teacher.org", "Years of structured coaching experience"),
    },
    {
      icon: <Trophy size={18} />,
      name: t("creds.exp.name", "5+ Years Coaching Experience"),
      org: t("creds.exp.org", "Premium personal training in Dubai"),
    },
  ];

  return (
    <section className="py-16 md:py-24" id="credentials" data-testid="credentials-section">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center mb-10">
          <p className="tron-eyebrow text-[11px] text-primary/90 mb-3">
            {t("creds.eyebrow", "COACH YOUSSEF")}
          </p>
          <h2 className="font-display font-bold text-3xl md:text-4xl">
            {t("creds.title", "Credentials You Can Trust")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-start gap-3"
              data-testid={`cred-${i}`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                {it.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm leading-snug">{it.name}</h3>
                <p className="text-xs text-primary/80 mt-0.5">{it.org}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
