import { useState, useEffect } from "react";
import { Loader2, Palette, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  THEME_DEFAULTS,
  BRAND_DEFAULTS,
  applyBrandCSSVars,
  type ThemeTokens,
  type BrandSettings,
} from "@/lib/brandSettings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TOKEN_META: {
  key: keyof ThemeTokens;
  label: string;
  description: string;
}[] = [
  {
    key: "colorPrimary",
    label: "Accent / Primary",
    description: "Buttons, highlights, active states, glow effects",
  },
  {
    key: "colorBackground",
    label: "Deep Background",
    description: "Page background — the AMOLED canvas",
  },
  {
    key: "colorCard",
    label: "Card Surface",
    description: "Admin cards, panels, dropdowns",
  },
  {
    key: "colorBorder",
    label: "Border",
    description: "Card outlines, input borders, dividers",
  },
  {
    key: "colorMutedText",
    label: "Muted Text",
    description: "Secondary labels, descriptions, timestamps",
  },
];

export default function AdminTheme() {
  const { toast } = useToast();
  const { data: rawSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [tokens, setTokens] = useState<ThemeTokens>({ ...THEME_DEFAULTS });
  const [dirty, setDirty] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!isLoading && rawSettings && !initialised) {
      const stored = (rawSettings.brandSettings ?? {}) as Record<string, unknown>;
      const merged: ThemeTokens = { ...THEME_DEFAULTS };
      for (const k of Object.keys(THEME_DEFAULTS) as (keyof ThemeTokens)[]) {
        if (typeof stored[k] === "string") merged[k] = stored[k] as string;
      }
      setTokens(merged);
      setInitialised(true);
    }
  }, [isLoading, rawSettings, initialised]);

  function handleChange(key: keyof ThemeTokens, value: string) {
    const next = { ...tokens, [key]: value };
    setTokens(next);
    setDirty(true);
    const brandNums = (rawSettings?.brandSettings ?? {}) as Record<string, number>;
    applyBrandCSSVars({ ...brandNums, ...next } as Record<string, number | string>);
  }

  function handleSave() {
    const existing = (rawSettings?.brandSettings ?? {}) as Record<string, unknown>;
    updateSettings.mutate(
      { brandSettings: { ...existing, ...tokens } as unknown as Record<string, number> },
      {
        onSuccess: () => {
          toast({ title: "Theme saved" });
          setDirty(false);
        },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  }

  function handleReset() {
    const resetTokens = { ...THEME_DEFAULTS };
    setTokens(resetTokens);
    setDirty(false);
    const existing = (rawSettings?.brandSettings ?? {}) as Record<string, unknown>;
    const brandNums: Record<string, number> = {};
    for (const [k, v] of Object.entries(existing)) {
      if (typeof v === "number") brandNums[k] = v;
    }
    applyBrandCSSVars({ ...brandNums, ...resetTokens } as Record<string, number | string>);
    updateSettings.mutate(
      { brandSettings: { ...brandNums, ...resetTokens } as unknown as Record<string, number> },
      {
        onSuccess: () => toast({ title: "Theme reset to defaults" }),
        onError: () => toast({ title: "Reset failed", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">System</p>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3" data-testid="text-theme-title">
            <Palette size={28} className="text-primary shrink-0" />
            Theme & Brand Colors
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mt-1">
            Adjust the key color tokens. Changes preview live — save to persist across all sessions.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
            <Loader2 size={16} className="animate-spin" /> Loading settings…
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
            {/* ── Left: token editor ── */}
            <div className="admin-card space-y-1" data-testid="section-theme-tokens">
              <h2 className="font-display font-bold text-lg mb-1">Color tokens</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Each token controls a specific layer of the UI. Adjust with the color picker or type a hex value directly.
              </p>

              <div className="space-y-5">
                {TOKEN_META.map(({ key, label, description }) => (
                  <ColorTokenRow
                    key={key}
                    tokenKey={key}
                    label={label}
                    description={description}
                    value={tokens[key]}
                    onChange={(v) => handleChange(key, v)}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-white/5 mt-6">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      data-testid="button-theme-reset"
                    >
                      <RotateCcw size={13} />
                      Reset to defaults
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset to TRON defaults?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will immediately restore and save the original Tron Legacy × Cinematic palette, replacing your current custom colors.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset} data-testid="button-theme-reset-confirm">
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={!dirty || updateSettings.isPending}
                  data-testid="button-theme-save"
                >
                  {updateSettings.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Save theme
                </Button>
              </div>
            </div>

            {/* ── Right: live preview ── */}
            <div className="admin-card" data-testid="section-theme-preview">
              <h2 className="font-display font-bold text-lg mb-4">Live preview</h2>
              <ThemePreview tokens={tokens} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColorTokenRow({
  tokenKey,
  label,
  description,
  value,
  onChange,
}: {
  tokenKey: string;
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  function commitHex(raw: string) {
    const cleaned = raw.trim().toLowerCase();
    const withHash = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
    if (/^#[0-9a-f]{6}$/.test(withHash)) {
      onChange(withHash);
    }
  }

  return (
    <div className="flex items-start gap-4" data-testid={`token-row-${tokenKey}`}>
      <div className="relative shrink-0 mt-0.5">
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHexInput(e.target.value);
          }}
          className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent p-0.5"
          style={{ colorScheme: "dark" }}
          data-testid={`color-picker-${tokenKey}`}
          aria-label={label}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{label}</span>
          <div
            className="w-4 h-4 rounded-full border border-white/10 shrink-0"
            style={{ backgroundColor: value }}
            aria-hidden
          />
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">{description}</p>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex(hexInput);
          }}
          maxLength={7}
          className="w-28 px-2 py-1 rounded-md border border-white/10 bg-white/[0.04] text-xs font-mono text-foreground focus:outline-none focus:border-primary/50"
          data-testid={`hex-input-${tokenKey}`}
          aria-label={`${label} hex value`}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
  const { colorPrimary, colorBackground, colorCard, colorBorder, colorMutedText } = tokens;

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: colorBorder, backgroundColor: colorBackground }}
      data-testid="theme-preview-root"
    >
      {/* Top bar strip */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b text-[11px] font-medium"
        style={{ borderColor: colorBorder, backgroundColor: colorCard, color: colorPrimary }}
      >
        <Palette size={12} />
        Preview · Youssef Elite
      </div>

      <div className="p-4 space-y-3">
        {/* Sample admin card */}
        <div
          className="rounded-xl border p-4 space-y-2"
          style={{ borderColor: colorBorder, backgroundColor: colorCard }}
          data-testid="preview-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "#f4f8ff" }}>
              Sample card
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${colorPrimary}22`,
                color: colorPrimary,
                border: `1px solid ${colorPrimary}44`,
              }}
              data-testid="preview-badge"
            >
              Active
            </span>
          </div>
          <p className="text-[11px]" style={{ color: colorMutedText }}>
            Secondary description text — muted tone for labels and meta info.
          </p>
          <div className="flex items-center gap-1 mt-1">
            <div
              className="h-[2px] rounded-full flex-1"
              style={{ backgroundColor: `${colorBorder}` }}
            />
            <div
              className="h-[2px] rounded-full w-2/3"
              style={{ backgroundColor: colorPrimary, opacity: 0.6 }}
            />
          </div>
        </div>

        {/* Sample button */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
            style={{
              backgroundColor: colorPrimary,
              color: colorBackground,
            }}
            data-testid="preview-button-primary"
          >
            Primary button
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              backgroundColor: "transparent",
              color: colorPrimary,
              border: `1px solid ${colorBorder}`,
            }}
            data-testid="preview-button-outline"
          >
            Outline
          </button>
        </div>

        {/* Sample input */}
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ borderColor: colorBorder, backgroundColor: colorBackground }}
          data-testid="preview-input"
        >
          <span className="text-[11px] flex-1" style={{ color: colorMutedText }}>
            Sample input field…
          </span>
          <div
            className="w-1 h-3 rounded-full"
            style={{ backgroundColor: colorPrimary, opacity: 0.8 }}
          />
        </div>

        {/* Color swatch strip */}
        <div className="flex gap-1 pt-1" data-testid="preview-swatches">
          {[colorPrimary, colorCard, colorBackground, colorBorder, colorMutedText].map((c, i) => (
            <div
              key={i}
              className="flex-1 h-4 rounded-sm"
              style={{ backgroundColor: c, border: `1px solid ${colorBorder}` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
