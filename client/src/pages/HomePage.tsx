import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Award,
  GraduationCap,
  ShieldCheck,
  Heart,
  Trophy,
  Briefcase,
  Globe,
  Dumbbell,
  Calendar,
  Instagram,
  MapPin,
  ArrowRight,
  User as UserIcon,
  Activity,
  Users as UsersIcon,
  Baby,
  Sparkles,
  Flame,
  Target,
  ShieldAlert,
} from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Footer } from "@/components/Footer";
import { HeroSlider } from "@/components/HeroSlider";
import { useTranslation } from "@/i18n";

const TRAIN_KEYS = [
  "trains.adults",
  "trains.beginners",
  "trains.fatLoss",
  "trains.muscleGain",
  "trains.kidsYouth",
  "trains.safeMovement",
] as const;

const SPECIALTY_KEYS = [
  { key: "bodyTransformation", icon: <Sparkles size={22} /> },
  { key: "fatLoss", icon: <Flame size={22} /> },
  { key: "muscleBuilding", icon: <Dumbbell size={22} /> },
  { key: "movement", icon: <Activity size={22} /> },
  { key: "kidsYouth", icon: <Baby size={22} /> },
  { key: "beginner", icon: <UsersIcon size={22} /> },
  { key: "strengthConditioning", icon: <Target size={22} /> },
  { key: "safeTraining", icon: <ShieldAlert size={22} /> },
] as const;

const CERT_KEYS = [
  { key: "bachelor", icon: <GraduationCap size={20} /> },
  { key: "uaeRecognition", icon: <ShieldCheck size={20} /> },
  { key: "repsUae", icon: <Award size={20} /> },
  { key: "ereps", icon: <Globe size={20} /> },
  { key: "iatd", icon: <Award size={20} /> },
  { key: "obesity", icon: <Heart size={20} /> },
  { key: "cpr", icon: <ShieldCheck size={20} /> },
  { key: "competitive", icon: <Trophy size={20} /> },
  { key: "gymExperience", icon: <Briefcase size={20} /> },
] as const;

export default function HomePage() {
  const { data: settings } = useSettings();
  const { t, lang } = useTranslation();
  const bio = (lang === "en" && settings?.profileBio?.trim()) || t("home.bio.fallback");

  return (
    <div className="min-h-screen pt-16">
      {/* ADMIN HERO IMAGE SLIDER (full-width, only renders when admin has uploaded slides) */}
      <HeroSlider />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[26rem] h-[26rem] bg-accent/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground mb-5">
              <MapPin size={12} className="text-primary" />
              <span>{t("hero.location")}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>{t("hero.tagline")}</span>
            </div>
            <h1
              className="text-4xl md:text-6xl font-display font-bold leading-[1.05]"
              data-testid="text-hero-name"
            >
              {t("hero.title")}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-5 leading-relaxed max-w-xl">
              {t("hero.role")}
            </p>
            <p className="text-base text-foreground/80 mt-4 max-w-xl">{t("hero.subtitle")}</p>

            <div className="mt-6 flex flex-wrap gap-1.5">
              {TRAIN_KEYS.map((key) => (
                <span
                  key={key}
                  className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary/90"
                >
                  {t(key)}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link href="/book" data-testid="link-book-session" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 blue-glow whitespace-nowrap btn-press">
                  <Calendar size={18} />
                  {t("hero.bookSession")}
                </button>
              </Link>
              <WhatsAppButton
                label={t("hero.contactWhatsapp")}
                size="md"
                testId="button-hero-whatsapp"
                className="w-full sm:w-auto"
              />
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground">
              <a
                href="https://instagram.com/youssef.fitness"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-primary transition-colors"
                data-testid="link-instagram"
              >
                <Instagram size={16} /> @youssef.fitness
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] max-w-sm mx-auto rounded-3xl overflow-hidden border border-white/10 navy-panel shadow-2xl">
              {settings?.profilePhotoUrl ? (
                <img
                  src={settings.profilePhotoUrl}
                  alt="Youssef Ahmed — Personal Training Service"
                  className="w-full h-full object-cover"
                  data-testid="img-profile"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60">
                  <UserIcon size={64} />
                  <p className="mt-4 text-xs uppercase tracking-widest">
                    {t("hero.imageComingSoon")}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/50">
                    {t("hero.imageHint")}
                  </p>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/85 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs">
                <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-bold">
                  REPs UAE
                </span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md font-semibold">
                  EREPS Level 6
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="max-w-4xl mx-auto px-5 py-20" id="about">
        <SectionHeader
          eyebrow={t("section.about.eyebrow")}
          title={t("section.about.title")}
        />
        <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-bio">
          {bio}
        </p>
        <p className="text-base text-muted-foreground/85 leading-relaxed mt-6">
          {t("section.about.extra")}
        </p>
      </section>

      {/* COACHING SPECIALTIES */}
      <section className="max-w-6xl mx-auto px-5 py-12" id="specialties">
        <SectionHeader
          eyebrow={t("section.specialties.eyebrow")}
          title={t("section.specialties.title")}
          subtitle={t("section.specialties.subtitle")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SPECIALTY_KEYS.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-white/5 bg-card/60 p-6 hover:bg-card/80 card-lift"
              data-testid={`specialty-card-${i}`}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mb-4">
                {s.icon}
              </div>
              <h3 className="font-display font-bold text-base">{t(`home.specialty.${s.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{t(`home.specialty.${s.key}.body`)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CERTIFICATIONS */}
      <section className="max-w-5xl mx-auto px-5 py-20" id="certifications">
        <SectionHeader
          eyebrow={t("section.certs.eyebrow")}
          title={t("section.certs.title")}
          subtitle={t("section.certs.subtitle")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CERT_KEYS.map((c, i) => (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-white/5 bg-card/60 p-5 card-lift"
              data-testid={`cert-card-${i}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base leading-snug">{t(`home.cert.${c.key}.name`)}</h3>
                  <p className="text-xs text-primary/80 mt-1">{t(`home.cert.${c.key}.org`)}</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
                    {t(`home.cert.${c.key}.country`)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{t(`home.cert.${c.key}.value`)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TRANSFORMATIONS PLACEHOLDER */}
      <section className="max-w-6xl mx-auto px-5 py-20" id="transformations">
        <SectionHeader
          eyebrow={t("section.transformations.eyebrow")}
          title={t("section.transformations.title")}
          subtitle={t("section.transformations.subtitle")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-muted-foreground/60"
              data-testid={`transformation-placeholder-${i}`}
            >
              <Dumbbell size={32} />
              <p className="mt-3 text-xs uppercase tracking-widest">
                {t("section.transformations.placeholder")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* BOOK & CONTACT CTA */}
      <section className="max-w-5xl mx-auto px-5 py-20" id="contact">
        <div className="rounded-3xl border border-white/10 navy-panel p-6 sm:p-8 md:p-12 relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="text-center max-w-xl mx-auto">
              <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
                {t("section.cta.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-display font-bold">
                {t("section.cta.title")}
              </h2>
              <p className="text-muted-foreground mt-3">{t("section.cta.subtitle")}</p>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center max-w-md sm:max-w-none mx-auto">
              <Link href="/book" data-testid="link-cta-book" className="w-full sm:w-auto">
                <button className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 blue-glow whitespace-nowrap btn-press">
                  {t("section.cta.bookSession")} <ArrowRight size={16} />
                </button>
              </Link>
              <WhatsAppButton
                label={t("section.cta.message")}
                message={t("home.cta.whatsappMessage")}
                testId="button-cta-whatsapp"
                className="w-full sm:w-auto"
              />
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              {t("section.cta.replies")}
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{eyebrow}</p>
      <h2 className="text-3xl md:text-4xl font-display font-bold">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
    </div>
  );
}

