import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsLeftRight, Camera, Calendar } from "lucide-react";
import type { ProgressPhoto, ProgressViewAngle } from "@shared/schema";
import { PROGRESS_VIEW_ANGLES } from "@shared/schema";

interface Props {
  photos: ProgressPhoto[];
}

// Premium draggable before/after slider. Self-contained — uses native
// pointer events (works for mouse + touch + pen on iOS/Android/desktop)
// without any extra dependency. Lazy-loads images. Resilient to a
// missing pair (renders single-image fallback).
function CompareSlider({
  beforePhoto,
  afterPhoto,
}: {
  beforePhoto?: ProgressPhoto;
  afterPhoto?: ProgressPhoto;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [pos, setPos] = useState(50); // 0..100

  // Keyboard accessibility — arrow keys nudge by 5%, page keys by 20%.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (e.key === "ArrowLeft") { setPos((p) => Math.max(0, p - 5)); e.preventDefault(); }
      if (e.key === "ArrowRight") { setPos((p) => Math.min(100, p + 5)); e.preventDefault(); }
      if (e.key === "PageDown") { setPos((p) => Math.max(0, p - 20)); e.preventDefault(); }
      if (e.key === "PageUp") { setPos((p) => Math.min(100, p + 20)); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const move = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const next = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPos(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    move(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Fallback when only one of the two photos exists for this angle.
  if (!beforePhoto || !afterPhoto) {
    const only = beforePhoto || afterPhoto;
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6 text-center">
          {only ? (
            <>
              <img
                src={only.photoUrl}
                alt="Progress"
                loading="lazy"
                decoding="async"
                className="mx-auto rounded-2xl max-h-[420px] object-contain"
              />
              <div className="mt-3 text-xs text-white/50">
                Need both a "before" and a more recent photo of this angle to enable the slider.
              </div>
            </>
          ) : (
            <div className="text-white/50 text-sm py-8">
              No photos yet for this angle. Tag uploads with front / side / back to unlock the slider.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const beforeDate = beforePhoto.recordedAt ? format(new Date(beforePhoto.recordedAt), "MMM d, yyyy") : "—";
  const afterDate = afterPhoto.recordedAt ? format(new Date(afterPhoto.recordedAt), "MMM d, yyyy") : "—";

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <CardContent className="p-0">
        <div
          ref={containerRef}
          tabIndex={0}
          role="slider"
          aria-label="Before / after comparison"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          className="relative w-full aspect-[3/4] sm:aspect-[4/3] bg-black select-none touch-none cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          data-testid="compare-slider"
        >
          {/* AFTER (full base) */}
          <img
            src={afterPhoto.photoUrl}
            alt="After"
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          {/* BEFORE (clipped overlay) */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          >
            <img
              src={beforePhoto.photoUrl}
              alt="Before"
              loading="lazy"
              decoding="async"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
          {/* Divider + handle */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none"
            style={{ left: `${pos}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center pointer-events-none"
            style={{ left: `${pos}%` }}
          >
            <ChevronsLeftRight size={18} className="text-black" />
          </div>
          {/* Labels */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/65 text-white text-[11px] font-medium tracking-wider uppercase pointer-events-none">
            Before · {beforeDate}
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-blue-500/85 text-white text-[11px] font-medium tracking-wider uppercase pointer-events-none">
            After · {afterDate}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BeforeAfterCompare({ photos }: Props) {
  const [angle, setAngle] = useState<ProgressViewAngle>("front");

  // For each angle, select the EARLIEST photo as "before" and the LATEST
  // as "after". Photos explicitly tagged type='before' take precedence
  // for the before slot; type='after'/'current' take precedence for the
  // after slot. Falls back to date order otherwise.
  const pair = useMemo(() => {
    const sameAngle = photos.filter((p) => (p.viewAngle ?? "front") === angle);
    if (sameAngle.length === 0) return { before: undefined, after: undefined };
    const sortedAsc = [...sameAngle].sort(
      (a, b) => new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime(),
    );
    const explicitBefore = sortedAsc.find((p) => p.type === "before");
    const reversedExplicit = [...sortedAsc].reverse();
    const explicitAfter = reversedExplicit.find((p) => p.type === "after" || p.type === "current");
    const before = explicitBefore ?? sortedAsc[0];
    const afterCandidate = explicitAfter ?? sortedAsc[sortedAsc.length - 1];
    // Don't pair a single photo with itself.
    const after = afterCandidate && afterCandidate.id !== before.id ? afterCandidate : undefined;
    return { before, after };
  }, [photos, angle]);

  const timeline = useMemo(() => {
    const sameAngle = photos.filter((p) => (p.viewAngle ?? "front") === angle);
    return [...sameAngle].sort(
      (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
    );
  }, [photos, angle]);

  const counts = useMemo(() => {
    const c: Record<ProgressViewAngle, number> = { front: 0, side: 0, back: 0 };
    for (const p of photos) {
      const a = (p.viewAngle ?? "front") as ProgressViewAngle;
      c[a] = (c[a] ?? 0) + 1;
    }
    return c;
  }, [photos]);

  return (
    <div className="space-y-4">
      {/* Angle selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {PROGRESS_VIEW_ANGLES.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={angle === a ? "default" : "outline"}
            onClick={() => setAngle(a)}
            className="h-8 capitalize"
            data-testid={`button-angle-${a}`}
          >
            {a}
            <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px] border-white/20">
              {counts[a]}
            </Badge>
          </Button>
        ))}
      </div>

      <CompareSlider beforePhoto={pair.before} afterPhoto={pair.after} />

      {/* Timeline strip for this angle */}
      {timeline.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
            <Calendar size={12} />
            Timeline · {timeline.length} {timeline.length === 1 ? "photo" : "photos"} · {angle}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {timeline.map((p) => (
              <div
                key={p.id}
                className="relative flex-none w-20 h-28 rounded-lg overflow-hidden border border-white/10 bg-white/5"
                data-testid={`timeline-photo-${p.id}`}
              >
                <img src={p.photoUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/65 text-white text-[9px] text-center">
                  {p.recordedAt && format(new Date(p.recordedAt), "MMM d")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-center py-10 text-white/50">
          <Camera size={28} className="mx-auto mb-3 opacity-50" />
          <div className="text-sm">No progress photos yet.</div>
        </div>
      )}
    </div>
  );
}
