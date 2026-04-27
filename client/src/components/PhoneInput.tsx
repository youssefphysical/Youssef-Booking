import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown, Check } from "lucide-react";

type Country = { code: string; name: string; dial: string; flag: string };

const COUNTRIES: Country[] = [
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { code: "JO", name: "Jordan", dial: "+962", flag: "🇯🇴" },
  { code: "LB", name: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
];

function detectCountry(value: string): { country: Country; rest: string } {
  const trimmed = (value || "").trim();
  if (trimmed.startsWith("+")) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (trimmed.startsWith(c.dial)) {
        return { country: c, rest: trimmed.slice(c.dial.length).trim() };
      }
    }
  }
  return { country: COUNTRIES[0], rest: trimmed.replace(/^\+?971/, "").trim() };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "50 539 4754",
  testId,
  className,
}: Props) {
  const init = useMemo(() => detectCountry(value), []);
  const [country, setCountry] = useState<Country>(init.country);
  const [local, setLocal] = useState<string>(init.rest);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Push combined value up whenever either piece changes
  useEffect(() => {
    const cleaned = local.replace(/[^\d]/g, "");
    onChange(cleaned ? `${country.dial}${cleaned}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, local]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.replace("+", "").startsWith(q) ||
        c.code.toLowerCase().startsWith(q),
    );
  }, [search]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          data-testid="button-country-code"
          className="inline-flex items-center gap-1.5 h-11 px-3 rounded-md bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors shrink-0"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-mono">{country.dial}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        <Input
          inputMode="tel"
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/[^\d\s-]/g, ""))}
          placeholder={placeholder}
          autoComplete="tel"
          data-testid={testId}
          className="bg-white/5 border-white/10 h-11 flex-1"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-white/10 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country or code"
              data-testid="input-country-search"
              className="w-full h-9 px-3 rounded-md bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="max-h-64 overflow-auto" data-testid="list-countries">
            {filtered.map((c) => {
              const selected = c.code === country.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setCountry(c);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 ${
                    selected
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-white/5"
                  }`}
                  data-testid={`option-country-${c.code}`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs">{c.dial}</span>
                  {selected && <Check size={14} className="text-primary" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                No countries match.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
