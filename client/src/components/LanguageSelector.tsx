import { Check, Globe, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useTranslation, type LanguageCode } from "@/i18n";
import { cn } from "@/lib/utils";

type Variant = "compact" | "full";

// Map each app language code to a stable SVG flag served from /public/flags.
// Using <img> instead of emoji guarantees consistent rendering on Windows
// desktop Chrome (which has no native regional-indicator emoji glyphs and
// would otherwise show "GB", "AE", etc. as fallback text).
const FLAG_SRC: Record<LanguageCode, string> = {
  en: "/flags/gb.svg",
  ar: "/flags/ae.svg",
  ur: "/flags/pk.svg",
  fr: "/flags/fr.svg",
  es: "/flags/es.svg",
  de: "/flags/de.svg",
  it: "/flags/it.svg",
  ru: "/flags/ru.svg",
  zh: "/flags/cn.svg",
  hi: "/flags/in.svg",
  tr: "/flags/tr.svg",
};

function FlagImg({
  code,
  name,
  size = 18,
  className,
}: {
  code: LanguageCode;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={FLAG_SRC[code]}
      alt={`${name} flag`}
      width={size}
      height={Math.round(size * 0.75)}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn(
        "inline-block shrink-0 rounded-sm object-cover ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: Math.round(size * 0.75) }}
    />
  );
}

export function LanguageSelector({
  variant = "compact",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { lang, setLang, t } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="button-language-selector"
          aria-label={t("nav.language")}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 rounded-xl border border-white/10 hover:bg-white/5 hover:border-white/20 text-sm whitespace-nowrap shrink-0 btn-soft",
            variant === "compact" ? "px-2 sm:px-2.5" : "px-3",
            className,
          )}
        >
          <Globe size={14} className="text-muted-foreground hidden sm:inline-block shrink-0" />
          <FlagImg code={current.code} name={current.nativeName} size={18} />
          {variant === "full" && (
            <span className="font-medium whitespace-nowrap">{current.nativeName}</span>
          )}
          <span className="hidden sm:inline text-xs uppercase tracking-wider text-muted-foreground">
            {current.code}
          </span>
          <ChevronDown size={12} className="text-muted-foreground/70 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("nav.language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => {
          const active = l.code === lang;
          return (
            <DropdownMenuItem
              key={l.code}
              onClick={() => setLang(l.code as LanguageCode)}
              data-testid={`option-language-${l.code}`}
              className={cn(
                "cursor-pointer flex items-center gap-3",
                active && "bg-primary/10 text-primary",
              )}
            >
              <FlagImg code={l.code} name={l.nativeName} size={20} />
              <span className="flex-1 text-sm">{l.nativeName}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {l.code}
              </span>
              {active && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
