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
} from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { WhatsAppButton } from "@/components/WhatsAppButton";

const certifications = [
  {
    icon: <GraduationCap size={20} />,
    title: "Bachelor's Degree in Physical Education",
    sub: "Suez Canal University",
    body:
      "Faculty of Physical Education, Suez Canal University, Egypt. Completed 150 credit hours with a Very Good grade. Foundation in training methods, sports science, anatomy, physiology, and coaching.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "UAE Academic Qualification Recognition",
    sub: "UAE Ministry of Higher Education & Scientific Research",
    body: "Official recognition of Youssef's academic qualification in the United Arab Emirates.",
  },
  {
    icon: <Award size={20} />,
    title: "REPs UAE – Category A Personal Trainer",
    sub: "Registered Exercise Professional, Dubai",
    body: "Compliant with UAE fitness industry standards for personal trainers.",
  },
  {
    icon: <Globe size={20} />,
    title: "EREPS – European Register of Exercise Professionals",
    sub: "Graduate Exercise Professional, EQF Level 6",
    body: "Recognition under European fitness professional standards.",
  },
  {
    icon: <Award size={20} />,
    title: "Personal Trainer Certification – IATD",
    sub: "International Academy for Training and Development",
    body: "Professional coaching foundation and practical training knowledge.",
  },
  {
    icon: <Heart size={20} />,
    title: "Obesity & Weight Management Specialist",
    sub: "Specialized education",
    body: "Fat loss, obesity management, and safe weight control strategies.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "CPR / First Aid Training",
    sub: "Safety certified",
    body: "Trained to support a safer exercise environment and handle emergencies.",
  },
  {
    icon: <Trophy size={20} />,
    title: "Competitive Sports Background",
    sub: "Bodybuilding & Rowing",
    body: "Official competition experience — discipline, athletic mindset, and practical understanding of body transformation.",
  },
  {
    icon: <Briefcase size={20} />,
    title: "UFC Gym / Gold's Gym / Fitness Zone",
    sub: "Professional gym experience",
    body: "Personal training, client coaching, program design, group training, and transformation support.",
  },
  {
    icon: <Globe size={20} />,
    title: "International Client Service",
    sub: "Premium environments",
    body: "Working with international clients in premium environments with positive testimonials and professional service standards.",
  },
];

export default function HomePage() {
  const { data: settings } = useSettings();
  const bio =
    settings?.profileBio ||
    "Youssef Tarek Hashim Ahmed is a certified personal trainer and physical education teacher based in Dubai.";

  return (
    <div className="min-h-screen pt-16">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground mb-5">
              <MapPin size={12} className="text-primary" />
              <span>Dubai, UAE</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>Certified Personal Trainer</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-[1.05]" data-testid="text-hero-name">
              Youssef Tarek
              <br />
              <span className="text-gradient-gold">Hashim Ahmed</span>
            </h1>
            <p className="text-muted-foreground text-lg mt-5 max-w-xl">
              Certified Personal Trainer & Physical Education Teacher. Safe, structured, result-driven programs for every client.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" data-testid="link-book-session">
                <button className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors gold-glow">
                  <Calendar size={18} />
                  Book a Session
                </button>
              </Link>
              <WhatsAppButton label="Contact on WhatsApp" size="md" testId="button-hero-whatsapp" />
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
            <div className="relative aspect-[4/5] max-w-sm mx-auto rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-card to-card/30 shadow-2xl">
              {settings?.profilePhotoUrl ? (
                <img
                  src={settings.profilePhotoUrl}
                  alt="Youssef Tarek"
                  className="w-full h-full object-cover"
                  data-testid="img-profile"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                  <UserIcon size={64} />
                  <p className="mt-4 text-xs uppercase tracking-widest">Photo coming soon</p>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs">
                <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-bold">REPs UAE</span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md font-semibold">EREPS Level 6</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="max-w-4xl mx-auto px-5 py-20" id="about">
        <SectionHeader eyebrow="About" title="Built on academics, sport, and service" />
        <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-bio">{bio}</p>
        <p className="text-base text-muted-foreground/80 leading-relaxed mt-6">
          His background includes a Bachelor's Degree in Physical Education from Suez Canal University,
          REPs UAE registration, EREPS recognition, first aid training, obesity and weight management
          education, competitive bodybuilding experience, and professional work with clients from
          different cultures.
        </p>
      </section>

      {/* CERTIFICATIONS TIMELINE */}
      <section className="max-w-4xl mx-auto px-5 py-12" id="certifications">
        <SectionHeader
          eyebrow="Credentials"
          title="Certifications & Background"
          subtitle="Education, recognitions, and professional experience"
        />

        <div className="relative space-y-5">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-white/10 to-transparent hidden sm:block" />
          {certifications.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.04 }}
              className="relative sm:pl-14"
              data-testid={`cert-card-${i}`}
            >
              <div className="hidden sm:flex absolute left-0 top-4 w-10 h-10 rounded-full bg-primary/15 border border-primary/30 items-center justify-center text-primary">
                {c.icon}
              </div>
              <div className="rounded-2xl border border-white/5 bg-card/60 p-5 hover:border-white/15 transition-colors">
                <div className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 border border-primary/30 text-primary mb-3">
                  {c.icon}
                </div>
                <h3 className="font-display font-bold text-lg">{c.title}</h3>
                <p className="text-xs uppercase tracking-widest text-primary/80 mt-1">{c.sub}</p>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{c.body}</p>
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
          subtitle="Real progress, structured programs"
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
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-card via-card to-primary/5 p-8 md:p-12 relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative">
            <SectionHeader eyebrow="Get Started" title="Book your first session" />
            <p className="text-muted-foreground max-w-lg">
              Reserve a training slot online, or message Youssef directly on WhatsApp to ask about programs and availability.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/book" data-testid="link-cta-book">
                <button className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
                  Book a Session <ArrowRight size={16} />
                </button>
              </Link>
              <WhatsAppButton
                label="Ask About Training"
                message="Hi Youssef, I'd like to ask about your training programs."
                testId="button-cta-whatsapp"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 mt-10">
        <div className="max-w-6xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Youssef Tarek. Personal Training, Dubai.</p>
          <div className="flex items-center gap-5">
            <Link href="/policy" className="hover:text-primary" data-testid="link-footer-policy">
              Cancellation Policy
            </Link>
            <a
              href="https://instagram.com/youssef.fitness"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
              data-testid="link-footer-instagram"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{eyebrow}</p>
      <h2 className="text-3xl md:text-4xl font-display font-bold">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
    </div>
  );
}
