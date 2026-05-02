import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { HeroImage } from "@shared/schema";

const AUTO_ADVANCE_MS = 3000;

export function HeroSlider() {
  const { data: images = [] } = useQuery<HeroImage[]>({
    queryKey: ["/api/hero-images"],
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [images.length]);

  // Reset index when image list changes (e.g. after admin deletes one).
  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  if (images.length === 0) return null;

  // Clamp inline so a stale `index` (after a delete that shrinks the list)
  // never produces an out-of-bounds undefined slide before the reset effect
  // above has had a chance to run.
  const safeIndex = index >= images.length ? 0 : index;
  const current = images[safeIndex];
  if (!current) return null;

  return (
    <div
      className="relative w-full h-[42vh] sm:h-[52vh] md:h-[64vh] max-h-[680px] overflow-hidden bg-black"
      data-testid="hero-slider"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={current.imageDataUrl}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
            data-testid={`img-hero-slide-${current.id}`}
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark gradient overlay for legibility of any overlaid content. */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/40 pointer-events-none" />

      {images.length > 1 && (
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10"
          data-testid="hero-slider-dots"
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              data-testid={`button-hero-dot-${i}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === safeIndex
                  ? "w-8 bg-primary"
                  : "w-1.5 bg-white/40 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
