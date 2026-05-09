import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  GraduationCap,
  ShieldCheck,
  Globe,
  Heart,
  Trophy,
  User as UserIcon,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useSettings } from "@/hooks/use-settings";

/**
 * Cinematic credentials section — replaces the old SaaS-card "About" +
 * "Certifications" pair with one editorial spread.
 *
 * Composition: full-bleed asymmetric grid. Left column = portrait photo
 * (large, no rounded card, just clean rect with a thin amber edge).
 * Right column = name, role, key certifications as a typographic list
 * — NO bordered cards, NO icon tiles per cert. Just rule-and-text rows
 * like a film-credit roll.
 */
const CERTS = [
  { key: "bachelor", icon: GraduationCap },
  { key: "uaeRecognition", icon: ShieldCheck },
  { key: "repsUae", icon: Award },
  { key: "ereps", icon: Globe },
  { key: "iatd", icon: Award },
  { key: "obesity", icon: Heart },
  { key: "cpr", icon: ShieldCheck },
  { key: "competitive", icon: Trophy },
] as const;

function PortraitPhoto({
  src,
  comingSoon,
  hint,
}: {
  src?: string | null;
  comingSoon: string;
  hint: string;
}) {
  const trimmed = (src || "").trim();
  const looksValid = trimmed.length >= 10;
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [trimmed]);

  if (!looksValid || errored) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center text-white/30 bg-black/40"
        data-testid="cinematic-portrait-placeholder"
      >
        <UserIcon size={72} />
        <p className="mt-4 text-[11px] uppercase tracking-[0.28em]">{comingSoon}</p>
        <p className="mt-1 text-[10px] text-white/25">{hint}</p>
      </div>
    );
  }
  return (
    <img
      src={trimmed}
      alt="Coach Youssef Ahmed"
      className="w-full h-full object-cover"
      style={{ objectPosition: "center top" }}
      decoding="async"
      onError={() => setErrored(true)}
      data-testid="img-cinematic-portrait"
    />
  );
}

export function Credentials() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const bio = t("home.bio.fallback");

  return (
    <section
      className="relative max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32"
      id="about"
      data-testid="cinematic-credentials"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-start">
        {/* PORTRAIT — left 5 columns. Clean photo, thin amber-glow edge. */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="md:col-span-5"
        >
          <div className="relative aspect-[4/5] w-full max-w-md md:max-w-none mx-auto md:mx-0 overflow-hidden">
            <PortraitPhoto
              src={settings?.profilePhotoUrl}
              comingSoon={t("hero.imageComingSoon")}
              hint={t("hero.imageHint")}
            />
            {/* Cinematic edge — thin amber glow on the bottom + right edges
                like a film-still printed in a portfolio. */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{
                boxShadow:
                  "inset 0 -1px 0 rgba(255,184,0,0.45), inset -1px 0 0 rgba(125,249,255,0.18)",
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
              aria-hidden="true"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] tracking-[0.28em] uppercase">
              <span className="text-white/85">REPs UAE</span>
              <span className="amber-dot" aria-hidden="true" />
              <span className="text-white/85">EREPS L6</span>
            </div>
          </div>
        </motion.div>

        {/* NAME + BIO + CERT ROLL — right 7 columns */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="md:col-span-7"
        >
          <div className="flex items-center gap-3 mb-5 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-white/60">
            <span className="hero-eyebrow-rule" aria-hidden="true" />
            <span>{t("section.about.eyebrow", "THE COACH")}</span>
          </div>
          <h2
            className="font-display font-bold text-white leading-[1.05] tracking-[-0.025em]"
            style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
            data-testid="text-credentials-name"
          >
            {t("hero.title", "Youssef Ahmed")}
          </h2>
          <p className="mt-4 text-sm tracking-[0.18em] uppercase text-primary/85">
            {t("hero.role", "Premium personal trainer · Dubai · UAE")}
          </p>
          <p
            className="mt-7 text-base sm:text-lg text-white/75 leading-[1.7] max-w-2xl"
            data-testid="text-credentials-bio"
          >
            {bio}
          </p>

          {/* CERT ROLL — film-credit style, NO cards */}
          <div className="mt-10 sm:mt-12">
            <p className="text-[10px] tracking-[0.32em] uppercase text-white/50 mb-5">
              {t("section.certs.eyebrow", "CERTIFICATIONS & EDUCATION")}
            </p>
            <ul className="space-y-3.5">
              {CERTS.map(({ key, icon: Icon }) => (
                <li
                  key={key}
                  className="grid grid-cols-12 gap-3 items-baseline border-b border-white/[0.05] pb-3.5"
                  data-testid={`cert-row-${key}`}
                >
                  <span className="col-span-1 flex items-start pt-1 text-primary/70">
                    <Icon size={14} />
                  </span>
                  <span className="col-span-11 sm:col-span-7 font-display text-white text-sm sm:text-base leading-snug">
                    {t(`home.cert.${key}.name`)}
                  </span>
                  <span className="col-span-12 sm:col-span-4 text-[11px] tracking-[0.18em] uppercase text-white/55 sm:text-end">
                    {t(`home.cert.${key}.org`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
