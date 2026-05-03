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
          <span className="text-base leading-none shrink-0" aria-hidden="true">
            {current.flag}
          </span>
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
              <span className="text-base leading-none">{l.flag}</span>
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
