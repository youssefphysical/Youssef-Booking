import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Check } from "lucide-react";

const UAE_AREAS: string[] = [
  "Dubai Marina",
  "JBR (Jumeirah Beach Residence)",
  "Downtown Dubai",
  "Business Bay",
  "Jumeirah",
  "Jumeirah Village Circle (JVC)",
  "Jumeirah Lake Towers (JLT)",
  "Dubai Hills",
  "Al Barsha",
  "Barsha Heights (Tecom)",
  "City Walk",
  "Deira",
  "Bur Dubai",
  "Mirdif",
  "Arabian Ranches",
  "Motor City",
  "Sports City",
  "Dubai Silicon Oasis",
  "International City",
  "Al Warqa",
  "Nad Al Sheba",
  "Meydan",
  "Palm Jumeirah",
  "Dubai Creek Harbour",
  "Dubai Festival City",
  "Discovery Gardens",
  "The Greens",
  "The Views",
  "Town Square",
  "Damac Hills",
  "Damac Hills 2",
  "Mudon",
  "Al Furjan",
  "Remraam",
  "The Springs",
  "The Meadows",
  "Emirates Hills",
  "Jumeirah Golf Estates",
  "Tilal Al Ghaf",
  "Al Quoz",
  "Al Karama",
  "Al Satwa",
  "Sharjah",
  "Ajman",
  "Abu Dhabi",
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
  className?: string;
}

export function AreaAutocomplete({
  value,
  onChange,
  placeholder = "e.g. Dubai Marina, JBR, Downtown, Business Bay",
  testId,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = normalize(value);
    if (!q) return UAE_AREAS.slice(0, 8);
    const starts = UAE_AREAS.filter((a) => normalize(a).startsWith(q));
    const includes = UAE_AREAS.filter(
      (a) => !normalize(a).startsWith(q) && normalize(a).includes(q),
    );
    return [...starts, ...includes].slice(0, 8);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <MapPin
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(suggestions[activeIdx]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          data-testid={testId}
          className="bg-white/5 border-white/10 h-11 pl-9"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-white/10 bg-card/95 backdrop-blur-md shadow-2xl"
          data-testid="list-area-suggestions"
        >
          {suggestions.map((s, idx) => {
            const active = idx === activeIdx;
            const selected = s === value;
            return (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
                data-testid={`option-area-${idx}`}
              >
                <MapPin size={12} className="text-primary shrink-0" />
                <span className="flex-1 truncate">{s}</span>
                {selected && <Check size={14} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
