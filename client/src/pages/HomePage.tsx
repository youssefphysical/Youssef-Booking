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
import { MessageCircle, HelpCircle } from "lucide-react";

const PROFESSIONAL_TITLE =
  "Certified Personal Trainer | Physical Education Teacher | Movement & Kinesiology Specialist";

const SUBTITLE =
  "Science-based coaching for body transformation, movement quality, and long-term performance.";

const TRAINS = [
  "Adults",
  "Beginners",
  "Fat-Loss Clients",
  "Muscle-Gain Clients",
  "Kids & Youth",
  "Safe Movement Coaching",
];

const specialties = [
  {
    icon: <Sparkles size={22} />,
    title: "Body Transformation",
    body: "Structured programs to reshape body composition with sustainable, long-term results.",
  },
  {
    icon: <Flame size={22} />,
    title: "Fat Loss & Weight Management",
    body: "Safe, science-based fat-loss systems built around your lifestyle and recovery.",
  },
  {
    icon: <Dumbbell size={22} />,
    title: "Muscle Building",
    body: "Progressive resistance training to build lean muscle, strength, and confidence.",
  },
  {
    icon: <Activity size={22} />,
    title: "Movement & Kinesiology",
    body: "Quality-of-movement coaching rooted in academic physical education and biomechanics.",
  },
  {
    icon: <Baby size={22} />,
    title: "Kids & Youth Fitness",
    body: "Age-appropriate fitness, coordination, and athletic development for young clients.",
  },
  {
    icon: <UsersIcon size={22} />,
    title: "Beginner-Friendly Coaching",
    body: "A calm, supportive starting point for clients who are new to structured training.",
  },
  {
    icon: <Target size={22} />,
    title: "Strength & Conditioning",
    body: "Performance-driven programming to improve strength, power, and athletic capacity.",
  },
  {
    icon: <ShieldAlert size={22} />,
    title: "Safe Training for All Levels",
    body: "Personalized adjustments for injuries, age, and ability — safety first, always.",
  },
];

const certifications = [
  {
    icon: <GraduationCap size={20} />,
    name: "Bachelor's Degree in Physical Education",
    org: "Suez Canal University — Faculty of Physical Education",
    country: "Egypt",
    value:
      "Academic foundation in training methods, sports science, anatomy, physiology, and coaching. 150 credit hours, Very Good grade.",
  },
  {
    icon: <ShieldCheck size={20} />,
    name: "UAE Academic Qualification Recognition",
    org: "UAE Ministry of Higher Education & Scientific Research",
    country: "United Arab Emirates",
    value: "Official recognition of Youssef's academic qualification in the UAE.",
  },
  {
    icon: <Award size={20} />,
    name: "REPs UAE — Category A Personal Trainer",
    org: "Registered Exercise Professional",
    country: "Dubai, UAE",
    value: "Compliant with UAE fitness industry standards for personal trainers.",
  },
  {
    icon: <Globe size={20} />,
    name: "EREPS — Graduate Exercise Professional",
    org: "European Register of Exercise Professionals",
    country: "Europe (EQF Level 6)",
    value: "Recognition under European fitness professional standards.",
  },
  {
    icon: <Award size={20} />,
    name: "Personal Trainer Certification",
    org: "International Academy for Training and Development (IATD)",
    country: "International",
    value: "Professional coaching foundation and practical training knowledge.",
  },
  {
    icon: <Heart size={20} />,
    name: "Obesity & Weight Management Specialist",
    org: "Specialized education",
    country: "International",
    value: "Fat loss, obesity management, and safe weight control strategies.",
  },
  {
    icon: <ShieldCheck size={20} />,
    name: "CPR / First Aid Training",
    org: "Safety certified",
    country: "International",
    value: "Trained to support a safer exercise environment and handle emergencies.",
  },
  {
    icon: <Trophy size={20} />,
    name: "Competitive Sports Background",
    org: "Bodybuilding & Rowing",
    country: "Egypt / International",
    value: "Official competition experience — discipline, athletic mindset, and practical understanding of body transformation.",
  },
  {
    icon: <Briefcase size={20} />,
    name: "Professional Gym Experience",
    org: "UFC Gym, Gold's Gym, Fitness Zone",
    country: "Egypt / UAE",
    value: "Personal training, client coaching, program design, and transformation support.",
  },
];

export default function HomePage() {
  const { data: settings } = useSettings();
  const bio =
    settings?.profileBio ||
    "Youssef Ahmed is a certified personal trainer and physical education teacher based in Dubai, specializing in body transformation, movement quality, and structured performance coaching. His background combines academic physical education, competitive sports experience, personal training, and real-world coaching with clients of different ages and fitness levels.";

  return (
    <div className="min-h-screen pt-16">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[26rem] h-[26rem] bg-accent/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground mb-5">
              <MapPin size={12} className="text-primary" />
              <span>Dubai, UAE</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>Personal Training & Coaching</span>
            </div>
            <h1
              className="text-4xl md:text-6xl font-display font-bold leading-[1.05]"
              data-testid="text-hero-name"
            >
              Youssef
              <br />
              <span className="text-gradient-blue">Ahmed</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-5 leading-relaxed max-w-xl">
              {PROFESSIONAL_TITLE}
            </p>
            <p className="text-base text-foreground/80 mt-4 max-w-xl">{SUBTITLE}</p>

            <div className="mt-6 flex flex-wrap gap-1.5">
              {TRAINS.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary/90"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link href="/book" data-testid="link-book-session" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors blue-glow">
                  <Calendar size={18} />
                  Book a Session
                </button>
              </Link>
              <WhatsAppButton
                label="Contact on WhatsApp"
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
                  alt="Youssef Ahmed — Youssef Fitness"
                  className="w-full h-full object-cover"
                  data-testid="img-profile"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60">
                  <UserIcon size={64} />
                  <p className="mt-4 text-xs uppercase tracking-widest">Profile photo coming soon</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/50">Editable from admin settings</p>
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
        <SectionHeader eyebrow="About Youssef" title="A foundation built on academics, sport, and service" />
        <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-bio">
          {bio}
        </p>
        <p className="text-base text-muted-foreground/85 leading-relaxed mt-6">
          Through Youssef Fitness, he focuses on building safe, personalized, and result-driven training systems
          for adults, beginners, athletes, kids, and clients looking to improve strength, body composition,
          confidence, and overall movement.
        </p>
      </section>

      {/* COACHING SPECIALTIES */}
      <section className="max-w-6xl mx-auto px-5 py-12" id="specialties">
        <SectionHeader
          eyebrow="What I Coach"
          title="Coaching Specialties"
          subtitle="Programs designed around your goal, your level, and your safety."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {specialties.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-white/5 bg-card/60 p-5 hover:border-primary/30 hover:bg-card/80 transition-colors"
              data-testid={`specialty-card-${i}`}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mb-4">
                {s.icon}
              </div>
              <h3 className="font-display font-bold text-base">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CERTIFICATIONS */}
      <section className="max-w-5xl mx-auto px-5 py-20" id="certifications">
        <SectionHeader
          eyebrow="Credentials"
          title="Certifications & Professional Background"
          subtitle="Education, recognitions, and professional experience."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certifications.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-white/5 bg-card/60 p-5 hover:border-primary/25 transition-colors"
              data-testid={`cert-card-${i}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base leading-snug">{c.name}</h3>
                  <p className="text-xs text-primary/80 mt-1">{c.org}</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
                    {c.country}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{c.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TRANSFORMATIONS PLACEHOLDER */}
      <section className="max-w-6xl mx-auto px-5 py-20" id="transformations">
        <SectionHeader
          eyebrow="Results"
          title="Client Transformations"
          subtitle="Real progress, structured programs."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-muted-foreground/60"
              data-testid={`transformation-placeholder-${i}`}
            >
              <Dumbbell size={32} />
              <p className="mt-3 text-xs uppercase tracking-widest">Photo coming soon</p>
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
              <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Get Started</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold">Ready to start?</h2>
              <p className="text-muted-foreground mt-3">
                Book a session online or message Youssef directly. He usually replies within a few
                hours.
              </p>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center max-w-md sm:max-w-none mx-auto">
              <Link href="/book" data-testid="link-cta-book" className="w-full sm:w-auto">
                <button className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors blue-glow">
                  Book a Session <ArrowRight size={16} />
                </button>
              </Link>
              <WhatsAppButton
                label="Message on WhatsApp"
                message="Hi Youssef, I'd like to ask about your training programs."
                testId="button-cta-whatsapp"
                className="w-full sm:w-auto"
              />
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              <ContactRow
                icon={<HelpCircle size={16} />}
                label="Ask about training"
                helper="Packages, schedule, specialties."
                message="Hi Youssef, I'd like to ask about your training packages."
                testId="button-ask-whatsapp"
              />
              <ContactRow
                icon={<MessageCircle size={16} />}
                label="Confirm a booking"
                helper="Already booked? Confirm with Youssef."
                message="Hi Youssef, I'd like to confirm my upcoming session."
                testId="button-confirm-whatsapp"
              />
            </div>
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

function ContactRow({
  label,
  helper,
  message,
  testId,
  icon,
}: {
  label: string;
  helper: string;
  message: string;
  testId: string;
  icon?: React.ReactNode;
}) {
  return (
    <a
      href={`https://wa.me/971505394754?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className="group rounded-2xl border border-white/10 bg-card/60 p-4 flex items-center gap-3 hover:border-primary/30 hover:bg-white/[0.04] transition-colors"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{helper}</p>
      </div>
      <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />
    </a>
  );
}
