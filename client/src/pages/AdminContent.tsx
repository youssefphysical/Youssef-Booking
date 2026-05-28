import { useState, useEffect } from "react";
import { Loader2, FileText, Megaphone, Gift, Globe, Dumbbell, Utensils, FlaskConical, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

// ── Default copy mirrored from HomePage.tsx ──────────────────────────────────
const DEFAULTS: Record<string, string> = {
  servicePtTitle:             "1-on-1 Personal Training",
  servicePtBody:              "Fully customised sessions designed around your goals, fitness level, and schedule — with real-time coaching and form correction.",
  serviceNutritionTitle:      "Personalised Nutrition",
  serviceNutritionBody:       "Science-backed nutrition plans tailored to your lifestyle, body composition goals, and food preferences — no crash diets.",
  serviceSupplementTitle:     "Supplement Protocol",
  serviceSupplementBody:      "Targeted supplement guidance based on your blood work, training demands, and health goals — no guesswork, no waste.",
  ctaEyebrow:                 "Ready to Start?",
  ctaTitle:                   "Book Your First Session",
  ctaSubtitle:                "Join clients who train with purpose. Personalised coaching, proven methods, real results.",
  trialEyebrow:               "Free Trial",
  trialTitle:                 "Try a Free Session",
  trialBody:                  "Not sure where to start? Book a complimentary trial session — no commitment, no pressure. Just results.",
  footerTagline:              "Premium Personal Training · Dubai",
};

// ── Field limits ──────────────────────────────────────────────────────────────
const LIMITS: Record<string, number> = {
  servicePtTitle:         60,
  servicePtBody:          220,
  serviceNutritionTitle:  60,
  serviceNutritionBody:   220,
  serviceSupplementTitle: 60,
  serviceSupplementBody:  220,
  ctaEyebrow:             50,
  ctaTitle:               80,
  ctaSubtitle:            200,
  trialEyebrow:           50,
  trialTitle:             80,
  trialBody:              220,
  footerTagline:          80,
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Fields = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function charCount(val: string, limit: number) {
  const over = val.length > limit;
  return (
    <span className={`text-[10px] tabular-nums ${over ? "text-red-400" : "text-muted-foreground/60"}`}>
      {val.length}/{limit}
    </span>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
function ContentField({
  fieldKey,
  label,
  values,
  onChange,
  multiline = false,
}: {
  fieldKey: string;
  label: string;
  values: Fields;
  onChange: (key: string, val: string) => void;
  multiline?: boolean;
}) {
  const val = values[fieldKey] ?? "";
  const limit = LIMITS[fieldKey] ?? 200;
  const placeholder = DEFAULTS[fieldKey] ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </label>
        {charCount(val, limit)}
      </div>
      {multiline ? (
        <Textarea
          value={val}
          placeholder={placeholder}
          rows={3}
          maxLength={limit + 40}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="resize-none text-sm"
          data-testid={`input-content-${fieldKey}`}
        />
      ) : (
        <Input
          value={val}
          placeholder={placeholder}
          maxLength={limit + 20}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="text-sm"
          data-testid={`input-content-${fieldKey}`}
        />
      )}
      {val.length > limit && (
        <p className="text-[10px] text-red-400 mt-0.5">
          Over {limit}-character limit — trim before saving.
        </p>
      )}
    </div>
  );
}

// ── Section accordion ─────────────────────────────────────────────────────────
function ContentSection({
  id,
  icon,
  title,
  description,
  children,
  dirty,
  saving,
  onSave,
  onReset,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="admin-card" data-testid={`section-content-${id}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-start justify-between gap-3 text-left"
        data-testid={`toggle-content-${id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-base leading-snug">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="shrink-0 pt-1 text-muted-foreground">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div className="mt-5 space-y-4">
          {children}
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              data-testid={`button-content-reset-${id}`}
            >
              <RotateCcw size={13} className="mr-1.5" />
              Reset defaults
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saving}
              onClick={onSave}
              data-testid={`button-content-save-${id}`}
            >
              {saving && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminContent() {
  const { toast } = useToast();
  const { data: rawSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [vals, setVals] = useState<Fields>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!isLoading && rawSettings && !initialised) {
      setVals((rawSettings.contentSettings as Fields) ?? {});
      setInitialised(true);
    }
  }, [isLoading, rawSettings, initialised]);

  function handleChange(key: string, val: string) {
    setVals((p) => ({ ...p, [key]: val }));
    const sectionId = sectionOf(key);
    setDirty((p) => ({ ...p, [sectionId]: true }));
  }

  function handleReset(sectionId: string, keys: string[]) {
    setVals((p) => {
      const next = { ...p };
      keys.forEach((k) => delete next[k]);
      return next;
    });
    setDirty((p) => ({ ...p, [sectionId]: true }));
  }

  function handleSave(sectionId: string) {
    // Guard: no value may exceed its character limit
    const sectionKeys = SECTION_KEYS[sectionId] ?? [];
    for (const k of sectionKeys) {
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

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">System</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-content-title">
            Website Content
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mt-1">
            Edit public-facing text for the homepage. Leave a field empty to use the default copy.
          </p>
        </div>

        <div className="admin-stack">
          {/* SERVICES */}
          <ContentSection
            id="services"
            icon={<Dumbbell size={16} />}
            title="Services"
            description="Titles and body text for the three service cards (Personal Training, Nutrition, Supplement)."
            dirty={!!dirty["services"]}
            saving={updateSettings.isPending}
            onSave={() => handleSave("services")}
            onReset={() => handleReset("services", SECTION_KEYS["services"])}
          >
            <div className="pb-1">
              <p className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold mb-3 flex items-center gap-1.5">
                <Dumbbell size={12} /> Personal Training
              </p>
              <div className="space-y-3">
                <ContentField fieldKey="servicePtTitle" label="Card title" values={vals} onChange={handleChange} />
                <ContentField fieldKey="servicePtBody" label="Card body" values={vals} onChange={handleChange} multiline />
              </div>
            </div>
            <div className="border-t border-white/5 pt-4 pb-1">
              <p className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold mb-3 flex items-center gap-1.5">
                <Utensils size={12} /> Nutrition Plans
              </p>
              <div className="space-y-3">
                <ContentField fieldKey="serviceNutritionTitle" label="Card title" values={vals} onChange={handleChange} />
                <ContentField fieldKey="serviceNutritionBody" label="Card body" values={vals} onChange={handleChange} multiline />
              </div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold mb-3 flex items-center gap-1.5">
                <FlaskConical size={12} /> Supplement Protocol
              </p>
              <div className="space-y-3">
                <ContentField fieldKey="serviceSupplementTitle" label="Card title" values={vals} onChange={handleChange} />
                <ContentField fieldKey="serviceSupplementBody" label="Card body" values={vals} onChange={handleChange} multiline />
              </div>
            </div>
          </ContentSection>

          {/* CTA */}
          <ContentSection
            id="cta"
            icon={<Megaphone size={16} />}
            title="Call to Action"
            description="The bottom-of-page conversion section with the Book Session button."
            dirty={!!dirty["cta"]}
            saving={updateSettings.isPending}
            onSave={() => handleSave("cta")}
            onReset={() => handleReset("cta", SECTION_KEYS["cta"])}
          >
            <ContentField fieldKey="ctaEyebrow" label="Eyebrow (small label above title)" values={vals} onChange={handleChange} />
            <ContentField fieldKey="ctaTitle" label="Headline" values={vals} onChange={handleChange} />
            <ContentField fieldKey="ctaSubtitle" label="Subtext" values={vals} onChange={handleChange} multiline />
          </ContentSection>

          {/* FREE TRIAL */}
          <ContentSection
            id="trial"
            icon={<Gift size={16} />}
            title="Free Trial"
            description="The free trial offer card that appears above the FAQ section."
            dirty={!!dirty["trial"]}
            saving={updateSettings.isPending}
            onSave={() => handleSave("trial")}
            onReset={() => handleReset("trial", SECTION_KEYS["trial"])}
          >
            <ContentField fieldKey="trialEyebrow" label="Eyebrow" values={vals} onChange={handleChange} />
            <ContentField fieldKey="trialTitle" label="Headline" values={vals} onChange={handleChange} />
            <ContentField fieldKey="trialBody" label="Body text" values={vals} onChange={handleChange} multiline />
          </ContentSection>

          {/* FOOTER */}
          <ContentSection
            id="footer"
            icon={<Globe size={16} />}
            title="Footer"
            description="Tagline shown next to the brand logo in the page footer."
            dirty={!!dirty["footer"]}
            saving={updateSettings.isPending}
            onSave={() => handleSave("footer")}
            onReset={() => handleReset("footer", SECTION_KEYS["footer"])}
          >
            <ContentField fieldKey="footerTagline" label="Footer tagline" values={vals} onChange={handleChange} />
          </ContentSection>
        </div>
      </div>
    </div>
  );
}

// ── Section → keys mapping (used for reset + guard) ───────────────────────────
const SECTION_KEYS: Record<string, string[]> = {
  services: ["servicePtTitle", "servicePtBody", "serviceNutritionTitle", "serviceNutritionBody", "serviceSupplementTitle", "serviceSupplementBody"],
  cta:      ["ctaEyebrow", "ctaTitle", "ctaSubtitle"],
  trial:    ["trialEyebrow", "trialTitle", "trialBody"],
  footer:   ["footerTagline"],
};

function sectionOf(key: string): string {
  for (const [sId, keys] of Object.entries(SECTION_KEYS)) {
    if (keys.includes(key)) return sId;
  }
  return "services";
}
