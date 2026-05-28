import { useState, useEffect } from "react";
import {
  Loader2,
  FileText,
  Megaphone,
  Globe,
  Dumbbell,
  Utensils,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  User as UserIcon,
  ArrowRight,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

// ─── Section definitions ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: "hero",     label: "Hero",     icon: <Sparkles size={14} /> },
  { id: "services", label: "Services", icon: <Dumbbell size={14} /> },
  { id: "about",    label: "About",    icon: <UserIcon  size={14} /> },
  { id: "cta",      label: "CTA",      icon: <Megaphone size={14} /> },
  { id: "footer",   label: "Footer",   icon: <Globe     size={14} /> },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Keys per section ─────────────────────────────────────────────────────────
const SECTION_KEYS: Record<SectionId, string[]> = {
  hero:     ["heroTagline", "heroRole", "heroSubtitle"],
  services: ["servicePtTitle", "servicePtBody", "serviceNutritionTitle", "serviceNutritionBody", "serviceSupplementTitle", "serviceSupplementBody"],
  about:    ["aboutBody", "aboutExtra"],
  cta:      ["ctaEyebrow", "ctaTitle", "ctaSubtitle"],
  footer:   ["footerTagline"],
};

function sectionOf(key: string): SectionId {
  for (const [sId, keys] of Object.entries(SECTION_KEYS) as [SectionId, string[]][]) {
    if (keys.includes(key)) return sId;
  }
  return "hero";
}

// ─── Defaults (English fallback shown as placeholder) ────────────────────────
const DEFAULTS: Record<string, string> = {
  heroTagline:             "Available Dubai Wide",
  heroRole:                "Certified Personal Trainer & Nutrition Coach · Dubai",
  heroSubtitle:            "Real coaching. Real results. Personalised programmes that fit your life.",
  servicePtTitle:          "1-on-1 Personal Training",
  servicePtBody:           "Fully customised sessions designed around your goals, fitness level, and schedule — with real-time coaching and form correction.",
  serviceNutritionTitle:   "Personalised Nutrition",
  serviceNutritionBody:    "Science-backed nutrition plans tailored to your lifestyle, body composition goals, and food preferences — no crash diets.",
  serviceSupplementTitle:  "Supplement Protocol",
  serviceSupplementBody:   "Targeted supplement guidance based on your blood work, training demands, and health goals — no guesswork, no waste.",
  aboutBody:               "With over 10 years of coaching experience across Dubai, I specialise in fat loss, muscle building, and body recomposition for all fitness levels.",
  aboutExtra:              "My approach combines evidence-based training with sustainable nutrition — so results stick and clients stay motivated long-term.",
  ctaEyebrow:              "Ready to Start?",
  ctaTitle:                "Book Your First Session",
  ctaSubtitle:             "Join clients who train with purpose. Personalised coaching, proven methods, real results.",
  footerTagline:           "Premium Personal Training · Dubai",
};

// ─── Character limits ─────────────────────────────────────────────────────────
const LIMITS: Record<string, number> = {
  heroTagline:             60,
  heroRole:                100,
  heroSubtitle:            200,
  servicePtTitle:          60,
  servicePtBody:           220,
  serviceNutritionTitle:   60,
  serviceNutritionBody:    220,
  serviceSupplementTitle:  60,
  serviceSupplementBody:   220,
  aboutBody:               400,
  aboutExtra:              300,
  ctaEyebrow:              50,
  ctaTitle:                80,
  ctaSubtitle:             200,
  footerTagline:           80,
};

type Fields = Record<string, string>;

// ─── Shared field editor ──────────────────────────────────────────────────────
function ContentField({
  fieldKey, label, values, onChange, multiline = false,
}: {
  fieldKey: string;
  label: string;
  values: Fields;
  onChange: (k: string, v: string) => void;
  multiline?: boolean;
}) {
  const val = values[fieldKey] ?? "";
  const limit = LIMITS[fieldKey] ?? 200;
  const over = val.length > limit;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
        <span className={cn("text-[10px] tabular-nums", over ? "text-red-400" : "text-muted-foreground/60")}>
          {val.length}/{limit}
        </span>
      </div>
      {multiline ? (
        <Textarea
          value={val}
          placeholder={DEFAULTS[fieldKey] ?? ""}
          rows={3}
          maxLength={limit + 40}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="resize-none text-sm"
          data-testid={`input-content-${fieldKey}`}
        />
      ) : (
        <Input
          value={val}
          placeholder={DEFAULTS[fieldKey] ?? ""}
          maxLength={limit + 20}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="text-sm"
          data-testid={`input-content-${fieldKey}`}
        />
      )}
      {over && <p className="text-[10px] text-red-400 mt-0.5">Over {limit}-character limit — trim before saving.</p>}
    </div>
  );
}

// ─── Save/Reset footer strip ──────────────────────────────────────────────────
function SectionActions({
  sectionId, dirty, saving, onSave, onReset,
}: {
  sectionId: SectionId;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-4">
      <Button type="button" variant="outline" size="sm" onClick={onReset} data-testid={`button-content-reset-${sectionId}`}>
        <RotateCcw size={12} className="mr-1.5" />
        Reset defaults
      </Button>
      <Button type="button" size="sm" disabled={!dirty || saving} onClick={onSave} data-testid={`button-content-save-${sectionId}`}>
        {saving && <Loader2 size={12} className="mr-1.5 animate-spin" />}
        Save
      </Button>
    </div>
  );
}

// ─── Preview wrapper ──────────────────────────────────────────────────────────
function PreviewBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-background/40 p-4 mb-5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary/70 font-semibold mb-3">
        <Eye size={11} /> Preview
      </div>
      {children}
    </div>
  );
}

// ─── Section contents ─────────────────────────────────────────────────────────
function HeroContent({ vals, onChange }: { vals: Fields; onChange: (k: string, v: string) => void }) {
  const v = (k: string) => vals[k] || DEFAULTS[k];
  return (
    <>
      <PreviewBox>
        <div className="space-y-1.5 max-w-sm">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {v("heroTagline")}
          </div>
          <p className="text-[11px] text-muted-foreground">{v("heroRole")}</p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{v("heroSubtitle")}</p>
        </div>
      </PreviewBox>
      <div className="space-y-4">
        <ContentField fieldKey="heroTagline"  label="Availability badge"     values={vals} onChange={onChange} />
        <ContentField fieldKey="heroRole"     label="Role / subtitle line"   values={vals} onChange={onChange} />
        <ContentField fieldKey="heroSubtitle" label="Intro paragraph"        values={vals} onChange={onChange} multiline />
      </div>
    </>
  );
}

function ServicesContent({ vals, onChange }: { vals: Fields; onChange: (k: string, v: string) => void }) {
  const v = (k: string) => vals[k] || DEFAULTS[k];
  return (
    <>
      <PreviewBox>
        <div className="grid grid-cols-3 gap-2">
          {(["pt", "nutrition", "supplement"] as const).map((s) => (
            <div key={s} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                {s === "pt" && <Dumbbell size={12} className="text-primary shrink-0" />}
                {s === "nutrition" && <Utensils size={12} className="text-primary shrink-0" />}
                {s === "supplement" && <FlaskConical size={12} className="text-primary shrink-0" />}
              </div>
              <p className="text-[11px] font-semibold leading-snug line-clamp-2">{v(`service${capitalize(s)}Title`)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">{v(`service${capitalize(s)}Body`)}</p>
            </div>
          ))}
        </div>
      </PreviewBox>
      <div className="space-y-5">
        {[
          { prefix: "servicePt",         eyebrow: "Personal Training",  icon: <Dumbbell size={12} className="text-primary" /> },
          { prefix: "serviceNutrition",  eyebrow: "Nutrition Plans",    icon: <Utensils size={12} className="text-primary" /> },
          { prefix: "serviceSupplement", eyebrow: "Supplement Protocol",icon: <FlaskConical size={12} className="text-primary" /> },
        ].map(({ prefix, eyebrow, icon }) => (
          <div key={prefix} className="border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
            <p className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold mb-3 flex items-center gap-1.5">
              {icon} {eyebrow}
            </p>
            <div className="space-y-3">
              <ContentField fieldKey={`${prefix}Title`} label="Card title" values={vals} onChange={onChange} />
              <ContentField fieldKey={`${prefix}Body`}  label="Card body"  values={vals} onChange={onChange} multiline />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AboutContent({ vals, onChange }: { vals: Fields; onChange: (k: string, v: string) => void }) {
  const v = (k: string) => vals[k] || DEFAULTS[k];
  return (
    <>
      <PreviewBox>
        <div className="space-y-2 max-w-lg">
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">{v("aboutBody")}</p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-3">{v("aboutExtra")}</p>
        </div>
      </PreviewBox>
      <div className="space-y-4">
        <ContentField fieldKey="aboutBody"  label="Main bio paragraph"      values={vals} onChange={onChange} multiline />
        <ContentField fieldKey="aboutExtra" label="Secondary paragraph"     values={vals} onChange={onChange} multiline />
      </div>
    </>
  );
}

function CtaContent({ vals, onChange }: { vals: Fields; onChange: (k: string, v: string) => void }) {
  const v = (k: string) => vals[k] || DEFAULTS[k];
  return (
    <>
      <PreviewBox>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center max-w-sm mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">{v("ctaEyebrow")}</p>
          <h3 className="font-display font-bold text-base leading-snug">{v("ctaTitle")}</h3>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{v("ctaSubtitle")}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-black text-[11px] font-semibold">
            Book Session <ArrowRight size={11} />
          </div>
        </div>
      </PreviewBox>
      <div className="space-y-4">
        <ContentField fieldKey="ctaEyebrow"  label="Eyebrow (small label above title)" values={vals} onChange={onChange} />
        <ContentField fieldKey="ctaTitle"    label="Headline"                           values={vals} onChange={onChange} />
        <ContentField fieldKey="ctaSubtitle" label="Subtext"                            values={vals} onChange={onChange} multiline />
      </div>
    </>
  );
}

function FooterContent({ vals, onChange }: { vals: Fields; onChange: (k: string, v: string) => void }) {
  const v = (k: string) => vals[k] || DEFAULTS[k];
  return (
    <>
      <PreviewBox>
        <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
          <div className="w-5 h-5 rounded bg-primary/20 border border-primary/30 grid place-items-center shrink-0">
            <Globe size={10} className="text-primary" />
          </div>
          <span className="text-muted-foreground/60">·</span>
          <span>{v("footerTagline")}</span>
        </div>
      </PreviewBox>
      <ContentField fieldKey="footerTagline" label="Footer tagline" values={vals} onChange={onChange} />
    </>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminContent() {
  const { toast } = useToast();
  const { data: rawSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [vals, setVals] = useState<Fields>({});
  const [dirty, setDirty] = useState<Partial<Record<SectionId, boolean>>>({});
  const [activeTab, setActiveTab] = useState<SectionId>("hero");
  const [mobileOpen, setMobileOpen] = useState<Partial<Record<SectionId, boolean>>>({ hero: true });
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!isLoading && rawSettings && !initialised) {
      setVals((rawSettings.contentSettings as Fields) ?? {});
      setInitialised(true);
    }
  }, [isLoading, rawSettings, initialised]);

  function handleChange(key: string, val: string) {
    setVals((p) => ({ ...p, [key]: val }));
    setDirty((p) => ({ ...p, [sectionOf(key)]: true }));
  }

  function handleReset(sectionId: SectionId) {
    const keys = SECTION_KEYS[sectionId];
    setVals((p) => {
      const next = { ...p };
      keys.forEach((k) => delete next[k]);
      return next;
    });
    setDirty((p) => ({ ...p, [sectionId]: true }));
  }

  function handleSave(sectionId: SectionId) {
    const keys = SECTION_KEYS[sectionId];
    for (const k of keys) {
      const limit = LIMITS[k] ?? 200;
      if ((vals[k] ?? "").length > limit) {
        toast({ title: `"${k}" exceeds ${limit} characters`, variant: "destructive" });
        return;
      }
    }
    updateSettings.mutate({ contentSettings: vals }, {
      onSuccess: () => {
        toast({ title: "Content saved" });
        setDirty((p) => ({ ...p, [sectionId]: false }));
      },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="admin-shell">
        <div className="admin-container flex items-center gap-2 text-muted-foreground pt-16">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  const sectionProps = (id: SectionId) => ({
    vals,
    onChange: handleChange,
  });

  const sectionActions = (id: SectionId) => (
    <SectionActions
      sectionId={id}
      dirty={!!dirty[id]}
      saving={updateSettings.isPending}
      onSave={() => handleSave(id)}
      onReset={() => handleReset(id)}
    />
  );

  const renderContent = (id: SectionId) => {
    switch (id) {
      case "hero":     return <HeroContent     {...sectionProps(id)} />;
      case "services": return <ServicesContent {...sectionProps(id)} />;
      case "about":    return <AboutContent    {...sectionProps(id)} />;
      case "cta":      return <CtaContent      {...sectionProps(id)} />;
      case "footer":   return <FooterContent   {...sectionProps(id)} />;
    }
  };

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">System</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-content-title">
            Website Content
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mt-1">
            Edit public-facing text for each homepage section. Leave a field empty to use the default copy.
          </p>
        </div>

        {/* ── DESKTOP: tabbed editor ──────────────────────────────────────── */}
        <div className="hidden md:flex gap-6 items-start">
          {/* Tab strip */}
          <nav
            className="w-40 shrink-0 flex flex-col gap-1 sticky top-20"
            data-testid="content-tab-strip"
            role="tablist"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={activeTab === s.id}
                onClick={() => setActiveTab(s.id)}
                data-testid={`tab-content-${s.id}`}
                className={cn(
                  "relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  activeTab === s.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {activeTab === s.id && (
                  <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-primary" />
                )}
                <span className="shrink-0">{s.icon}</span>
                {s.label}
                {dirty[s.id] && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-label="unsaved changes" />
                )}
              </button>
            ))}
          </nav>

          {/* Active panel */}
          <div className="flex-1 admin-card" role="tabpanel" data-testid={`panel-content-${activeTab}`}>
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/5">
              <span className="text-primary">{SECTIONS.find((s) => s.id === activeTab)?.icon}</span>
              <h2 className="font-display font-bold text-lg">{SECTIONS.find((s) => s.id === activeTab)?.label}</h2>
            </div>
            {renderContent(activeTab)}
            {sectionActions(activeTab)}
          </div>
        </div>

        {/* ── MOBILE: accordion ───────────────────────────────────────────── */}
        <div className="md:hidden admin-stack">
          {SECTIONS.map((s) => {
            const isOpen = !!mobileOpen[s.id];
            return (
              <section key={s.id} className="admin-card" data-testid={`accordion-content-${s.id}`}>
                <button
                  type="button"
                  onClick={() => setMobileOpen((p) => ({ ...p, [s.id]: !p[s.id] }))}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  data-testid={`toggle-content-${s.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      {s.icon}
                    </div>
                    <span className="font-display font-bold text-base">{s.label}</span>
                    {dirty[s.id] && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-label="unsaved changes" />
                    )}
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-5">
                    {renderContent(s.id)}
                    {sectionActions(s.id)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
