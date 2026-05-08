import { useEffect, useState } from "react";
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
import { usePackageTemplates } from "@/hooks/use-package-templates";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Footer } from "@/components/Footer";
import { HeroSlider } from "@/components/HeroSlider";
import { Transformations } from "@/components/Transformations";
import { CoachProtocols } from "@/components/CoachProtocols";
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

/**
 * ProfilePhoto (v9.1, May-2026)
 *
 * Defensive image renderer for the homepage hero profile card. Three
 * separate failure modes resolve to the same clean placeholder, so a
 * visitor never sees the browser's broken-image icon:
 *
 *   1. No URL saved (settings.profilePhotoUrl is null/undefined).
 *   2. URL is empty/whitespace-only or a stale `https://` placeholder
 *      (length-checked after trim — a bare scheme is < 9 chars).
 *   3. URL is set but the image fails to load at runtime
 *      (404, CORS, expired CDN URL, decoded data-URL is corrupt).
 *
 * Image styling matches the spec: object-fit: cover + object-position:
 * center top so the trainer's head/shoulders stay in the visible frame
 * on the 4:5 portrait card regardless of source aspect ratio.
 */
function ProfilePhoto({
  src,
  comingSoon,
  hint,
}: {
  src?: string | null;
  comingSoon: string;
  hint: string;
}) {
  const trimmed = (src || "").trim();
  // A bare scheme like "https://" is 8 chars — anything that short is
  // never a real image URL, treat as empty.
  const looksValid = trimmed.length >= 10;
  const [errored, setErrored] = useState(false);

  // If the saved URL changes (admin uploaded a new one), reset the
  // error state so the new image is given a fresh load attempt.
  useEffect(() => {
    setErrored(false);
  }, [trimmed]);

  if (!looksValid || errored) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60"
        data-testid="profile-photo-placeholder"
      >
        <UserIcon size={64} />
        <p className="mt-4 text-xs uppercase tracking-widest">{comingSoon}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/50">{hint}</p>
      </div>
    );
  }

  return (
    <img
      src={trimmed}
      alt="Youssef Ahmed — Personal Training Service"
      className="w-full h-full"
      style={{ objectFit: "cover", objectPosition: "center top" }}
      decoding="async"
      onError={() => setErrored(true)}
      data-testid="img-profile"
    />
  );
}

export default function HomePage() {
  // `useSettings` is still called because `settings.profilePhotoUrl`
  // is consumed lower in the page. The bio, however, no longer depends
  // on it (see About section comment).
  const { data: settings } = useSettings();
  const { t } = useTranslation();
  // INSTANT-RENDER ABOUT BIO (v8.4 — May 2026):
  // Per spec "ABOUT TEXT INSTANT RENDER", the About bio MUST appear
  // on first paint with NO loading delay (same strategy as the
  // adjacent Certifications text, which renders pure i18n directly).
  //
  // The previous v8.3 skeleton-then-text approach was technically
  // stable (no text swap) but introduced a visible ~150ms-1s delay
  // while waiting for `/api/settings`. That violates the new spec:
  //   "Render About copy directly from i18n/static translation at
  //    initial render. Do NOT wait for admin/API content before
  //    showing About text."
  //
  // Resolution: the bio is now ALWAYS sourced from the i18n key
  // `home.bio.fallback`, which exists in all 10 languages. This
  // guarantees:
  //   • First paint: real text, no skeleton, no blank area.
  //   • No API dependency for the bio → no loading flicker.
  //   • Stable forever — text never changes after first paint
  //     (i18n is synchronous, in-bundle).
  //   • Language switching still works automatically because `t()`
  //     re-resolves on lang change.
  //
  // Admin's `settings.profileBio` is intentionally NOT consulted on
  // the public homepage. Per spec "If admin override exists, use it
  // only after load if it is same source/stable; otherwise keep
  // i18n as immediate default." — the production admin bio differs
  // from the i18n copy, so the i18n default is kept as the single
  // immediate source. (Admin can still read/write `profileBio` via
  // the admin panel for other purposes; this just decouples the
  // public homepage from that source.)
  const bio = t("home.bio.fallback");

  // v8.8 (May-2026): the parent div now carries `.homepage-shell`,
  // which applies ONE continuous page-level background (radial accent
  // + 4-stop dark navy linear gradient — see index.css) so that every
  // section below sits on the same dark surface. Eliminates visible
  // bands between hero, Youssef Ahmed, About, and other sections per
  // the "UNIFY HOMEPAGE BACKGROUND SECTIONS" spec.
  return (
    <div className="min-h-screen pt-16 homepage-shell">
      {/* ADMIN HERO IMAGE SLIDER (full-width, only renders when admin has uploaded slides) */}
      <HeroSlider />

      {/* HERO / Youssef Ahmed section.
          v8.8 (May-2026): the three previous absolute-positioned
          background layers (bg-gradient-to-b from-primary/10 via-
          background to-background, bg-primary/15 blur-3xl sphere
          top-right, bg-accent/40 blur-3xl sphere bottom-left) were
          REMOVED so the shared .homepage-shell on the parent div
          shows through. Those layers were the section-specific
          background blocks that created the visible bands — the
          shell now provides the continuous dark surface AND the
          subtle radial accent. Section padding (py-16 md:py-28),
          content layout (grid md:grid-cols-2 gap-12 items-center),
          all cards, all text, all CTAs are UNCHANGED. */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground mb-5">
              <MapPin size={12} className="text-primary" />
              <span>{t("hero.location")}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>{t("hero.tagline")}</span>
            </div>
            <h1
              className="hero-headline-fluid-secondary font-display font-bold leading-[1.12]"
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
              {/* v9.1 (May-2026): broken-image hardening + framing.
                  - URL is trim-validated so empty strings, whitespace,
                    or stale "https://" placeholders never reach
                    <img src>.
                  - onError flips to the placeholder so visitors never
                    see the browser's broken-image icon if a saved
                    URL ever 404s.
                  - object-position: center top keeps the subject's
                    head/shoulders in frame on the 4:5 portrait card. */}
              <ProfilePhoto
                src={settings?.profilePhotoUrl}
                comingSoon={t("hero.imageComingSoon")}
                hint={t("hero.imageHint")}
              />
              {/* POLISH PASS (May 2026): bottom overlay reduced ~35 %
                  (from-black/85 → from-black/55) so the profile photo
                  reads as bright + premium instead of fighting a heavy
                  black wall. The certification badges still have plenty
                  of contrast against the softened pad. */}
              <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
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
      <section className="homepage-section max-w-4xl mx-auto px-5 py-20" id="about">
        <SectionHeader
          eyebrow={t("section.about.eyebrow")}
          title={t("section.about.title")}
        />
        {/* v8.4 instant-render: bio is pure i18n, no loading state,
            same paint timing as the adjacent Certifications heading. */}
        <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-bio">
          {bio}
        </p>
        <p className="text-base text-muted-foreground/85 leading-relaxed mt-6">
          {t("section.about.extra")}
        </p>
      </section>

      {/* HOW IT WORKS — 3-STEP TEASER STRIP (May 2026)
          Client-first UX: a single-glance promise of "what does it
          take to start?" — three minimal cards, no images, no heavy
          glow. Sits between the about-bio and specialties so the
          visitor sees the journey BEFORE the product features. The
          deep-dive 6-step page lives at /how-it-works (linked from
          the nav and the bottom CTA below). i18n uses the t(key,
          fallback) signature so adding new keys does not require
          touching the auto-generated translations.ts file. */}
      <section className="homepage-section max-w-6xl mx-auto px-5 pt-4 pb-12" id="how-it-works-teaser">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { n: "01", k: "choose", title: "Choose your goal", body: "Fat loss, muscle gain, or body recomposition — pick the outcome that matters to you." },
            { n: "02", k: "book",   title: "Book your session", body: "Pick any slot 6 AM – 10 PM. Sessions deduct from your active plan automatically." },
            { n: "03", k: "track",  title: "Track your progress", body: "InBody trends, progress photos, and session history — all in your private dashboard." },
          ].map((s, i) => (
            <motion.div
              key={s.k}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-white/5 bg-card/60 p-5 card-lift text-start"
              data-testid={`step-card-${s.k}`}
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-primary/80 font-semibold mb-5">
                {t(`steps.${s.k}.n`, s.n)} · {t(`steps.${s.k}.eyebrow`, "Step")}
              </div>
              <h3 className="font-display font-bold text-base mb-2">
                {t(`steps.${s.k}.title`, s.title)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(`steps.${s.k}.body`, s.body)}
              </p>
            </motion.div>
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <Link
            href="/how-it-works"
            className="text-sm text-primary/85 hover:text-primary inline-flex items-center gap-1.5 transition-colors"
            data-testid="link-steps-see-all"
          >
            {t("steps.seeAll", "See the full 6-step guide")}
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* COACHING SPECIALTIES */}
      <section className="homepage-section max-w-6xl mx-auto px-5 py-12" id="specialties">
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
      <section className="homepage-section max-w-5xl mx-auto px-5 py-20" id="certifications">
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

      {/* PACKAGES — admin-managed catalogue. Renders nothing when empty. */}
      <PublicPackages />

      {/* COACH-CURATED PROTOCOLS — public teaser. Renders the 3 public
          tiers (Essentials / Performance / Concierge) with locked-state
          framing + WhatsApp request CTA. Falls back to default copy when
          admin hasn't authored any rows yet, so this section is never
          empty for visitors. */}
      <CoachProtocols mode="homepage" />

      {/* TRANSFORMATIONS — admin-managed before/after cards.
          Renders nothing until at least one active row exists. */}
      <Transformations />

      {/* WHY TRAIN WITH YOUSSEF — premium conversion section */}
      <section className="homepage-section max-w-6xl mx-auto px-5 py-20" id="why">
        <SectionHeader
          eyebrow={t("section.why.eyebrow")}
          title={t("section.why.title")}
          subtitle={t("section.why.subtitle")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: "certified", icon: <ShieldCheck size={22} /> },
            { key: "structured", icon: <Target size={22} /> },
            { key: "results", icon: <Trophy size={22} /> },
            { key: "professional", icon: <Sparkles size={22} /> },
          ].map((c, i) => (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.05 }}
              className="tron-card rounded-2xl p-6"
              data-testid={`why-card-${c.key}`}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary mb-4 tron-edge">
                {c.icon}
              </div>
              <h3 className="font-display font-bold text-base">
                {t(`section.why.${c.key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {t(`section.why.${c.key}.body`)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BOOK & CONTACT CTA */}
      <section className="homepage-section max-w-5xl mx-auto px-5 py-20" id="contact">
        <div className="tron-card rounded-3xl p-6 sm:p-8 md:p-12 relative overflow-hidden">
          {/* Subtle TRON layers — grid wash, blue corner glow, top neon beam. */}
          <div className="absolute inset-0 tron-grid-fine opacity-30 pointer-events-none" aria-hidden="true" />
          <div className="absolute -right-20 -bottom-20 w-72 h-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-6 right-6 top-0 tron-beam pointer-events-none" />
          <div className="relative">
            <div className="text-center max-w-xl mx-auto">
              <p className="tron-eyebrow text-xs mb-2">
                {t("section.cta.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-display font-bold">
                {t("section.cta.title")}
              </h2>
              <p className="text-muted-foreground mt-3">{t("section.cta.subtitle")}</p>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center max-w-md sm:max-w-none mx-auto">
              <Link href="/book" data-testid="link-cta-book" className="w-full sm:w-auto">
                <button className="tron-cta w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold whitespace-nowrap btn-press">
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

// =====================================================================
// PUBLIC PACKAGES SECTION
// Driven by the admin Package Builder. Hides itself completely when no
// active templates exist so the homepage stays clean for new sites.
// Pricing is intentionally displayed (this is the public storefront).
// =====================================================================
function PublicPackages() {
  const { t } = useTranslation();
  const { data: templates = [] } = usePackageTemplates({ activeOnly: true });

  if (!templates || templates.length === 0) return null;

  return (
    <section className="homepage-section max-w-6xl mx-auto px-5 py-20" id="packages">
      <SectionHeader
        eyebrow={t("home.packages.eyebrow")}
        title={t("home.packages.title")}
        subtitle={t("home.packages.subtitle")}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {templates.map((tpl, i) => {
          const message = t("home.packages.whatsappMsg").replace("{name}", tpl.name);
          const hasBonus = tpl.bonusSessions > 0;
          // Display: prefer paidSessions+bonusSessions when set; fall back to
          // totalSessions if only that is configured (legacy templates).
          const paid = tpl.paidSessions || (hasBonus ? Math.max(tpl.totalSessions - tpl.bonusSessions, 0) : tpl.totalSessions);
          return (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="tron-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col h-full min-w-0"
              data-testid={`public-package-${tpl.id}`}
            >
              {/* Eyebrow + name */}
              <div className="min-w-0">
                <p className="tron-eyebrow text-[10px] mb-1.5 truncate">
                  {t(`admin.packageBuilder.type.${tpl.type}`)}
                </p>
                <h3 className="font-display font-bold text-lg sm:text-xl leading-tight break-words">
                  {tpl.name}
                </h3>
              </div>

              {/* Sessions block — premium hierarchy with bonus visually
                  separated in green when present */}
              <div className="mt-4 mb-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-3xl sm:text-[34px] font-display font-bold tabular-nums leading-none">
                    {paid}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {t("home.packages.sessions")}
                  </span>
                </div>

                {hasBonus && (
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/12 border border-emerald-400/30 px-2.5 py-1 text-emerald-300 shadow-[0_0_18px_-6px_rgba(16,185,129,0.55)]">
                      <Sparkles size={12} className="shrink-0" />
                      <span className="text-[13px] font-display font-bold tabular-nums leading-none">
                        +{tpl.bonusSessions}
                      </span>
                      <span className="text-[11px] font-semibold leading-none">
                        {t("home.packages.bonus")}
                      </span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300/80 whitespace-nowrap">
                      {t("home.packages.bonusBadge", "Bonus by Coach")}
                    </span>
                  </div>
                )}

                {hasBonus && (
                  <p className="text-[11px] text-muted-foreground mt-2.5 pt-2.5 border-t border-white/5">
                    {t("home.packages.totalLabel", "Total")}:{" "}
                    <strong className="text-foreground tabular-nums">{paid + tpl.bonusSessions}</strong>{" "}
                    {t("home.packages.sessions")}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="mb-3">
                <p className="text-[26px] sm:text-3xl font-display font-bold tabular-nums text-primary leading-none">
                  {tpl.totalPrice.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("common.aed")}
                  </span>
                </p>
                {tpl.pricePerSession > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {tpl.pricePerSession.toLocaleString()} {t("common.aed")} /{" "}
                    {t("home.packages.perSession")}
                  </p>
                )}
              </div>

              {/* Validity + description */}
              <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                <li className="flex items-center gap-2 min-w-0">
                  <Calendar size={13} className="text-primary shrink-0" />
                  <span className="truncate">
                    {t("home.packages.validFor")}: {tpl.expirationValue}{" "}
                    {t(`admin.packageBuilder.unit.${tpl.expirationUnit}`)}
                  </span>
                </li>
                {tpl.description && (
                  <li className="text-xs leading-relaxed pt-1 break-words">{tpl.description}</li>
                )}
              </ul>

              <WhatsAppButton
                label={t("home.packages.requestCta")}
                message={message}
                testId={`button-request-package-${tpl.id}`}
                className="mt-5 w-full"
              />
            </motion.div>
          );
        })}
      </div>
    </section>
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
    <div className="mb-8 text-start">
      <p className="tron-eyebrow text-xs mb-5">{eyebrow}</p>
      <h2 className="text-3xl md:text-4xl font-display font-bold">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-3">{subtitle}</p>}
    </div>
  );
}

