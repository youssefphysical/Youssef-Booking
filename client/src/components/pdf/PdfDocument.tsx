import { useEffect, type ReactNode } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

interface PdfDocumentProps {
  /** Document title shown in the printable header. */
  title: string;
  /** Optional kicker line above the title (e.g. "Nutrition Plan"). */
  kicker?: string;
  /** Optional subtitle (e.g. client name + date). */
  subtitle?: string;
  /** Where the back button on the on-screen toolbar navigates to. */
  backHref: string;
  /** Auto-trigger window.print() once content is ready. */
  autoPrint?: boolean;
  /** Whether the underlying data is still loading (delays autoPrint). */
  isReady?: boolean;
  /** Document body — rendered inside the A4 page wrapper. */
  children: ReactNode;
}

/**
 * Reusable A4 PDF document layout. Premium black/blue luxury styling.
 *
 * Architecture:
 *  - On-screen UI (toolbar, page background) hidden during print via
 *    the `.pdf-screen-only` / `.pdf-print-only` utility classes
 *    defined in `index.css`.
 *  - Page sized to A4 (210 × 297 mm) inside a centred container that
 *    matches the printed page on screen, so trainers see exactly what
 *    will print.
 *  - Auto-prints after a short delay once `isReady` is true (gives
 *    fonts + images time to load so nothing renders blank).
 *  - Reusable for future workout-plan / progress-report exports —
 *    callers just compose their content inside the children slot.
 */
export function PdfDocument({
  title,
  kicker,
  subtitle,
  backHref,
  autoPrint = true,
  isReady = true,
  children,
}: PdfDocumentProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!autoPrint || !isReady) return;
    // Delay so webfonts + any imagery settle before the dialog opens.
    // Without this, mobile Safari sometimes prints the fallback font.
    const id = window.setTimeout(() => {
      window.print();
    }, 600);
    return () => window.clearTimeout(id);
  }, [autoPrint, isReady]);

  return (
    <div className="pdf-doc-root min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* On-screen toolbar — hidden when printing */}
      <div className="pdf-screen-only sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-[210mm] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.back", "Back")}
              data-testid="button-pdf-back"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("pdf.preview", "PDF Preview")}
            </p>
            <p className="text-sm font-medium truncate">{title}</p>
          </div>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="gap-2"
            data-testid="button-pdf-print"
          >
            <Printer size={14} aria-hidden="true" />
            {t("pdf.print", "Save as PDF")}
          </Button>
        </div>
      </div>

      {/* A4 page — visible at the same size on-screen and on paper */}
      <div className="pdf-page-wrap py-6 sm:py-10 px-2 sm:px-6">
        <article className="pdf-page">
          {/* Premium header band */}
          <header className="pdf-header">
            <div className="pdf-header-brand">
              <p className="pdf-header-coach">COACH YOUSSEF AHMED</p>
              <p className="pdf-header-tagline">PERSONAL TRAINING · DUBAI</p>
            </div>
            <div className="pdf-header-doctype">
              {kicker && <p className="pdf-kicker">{kicker}</p>}
              <h1 className="pdf-title">{title}</h1>
              {subtitle && <p className="pdf-subtitle">{subtitle}</p>}
            </div>
          </header>

          <div className="pdf-divider" />

          {children}

          <footer className="pdf-footer">
            <span>youssef-booking.vercel.app</span>
            <span className="pdf-footer-dot">·</span>
            <span>
              {t("pdf.generated", "Generated")} {new Date().toLocaleDateString()}
            </span>
          </footer>
        </article>
      </div>
    </div>
  );
}
