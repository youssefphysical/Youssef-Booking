import { Link } from "wouter";
import { SiWhatsapp, SiInstagram } from "react-icons/si";
import { useTranslation } from "@/i18n";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="relative border-t border-white/5 py-10 mt-10">
      {/* Cyan neon divider continues the TRON system into the footer. */}
      <div className="absolute left-6 right-6 top-0 tron-beam opacity-70 pointer-events-none" aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-5 flex flex-col items-center gap-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <p className="font-display text-foreground/90 text-sm tracking-wide">
            <span className="text-gradient-blue font-semibold whitespace-nowrap">{t("brand.trainerName", "Youssef Ahmed")}</span>
            <span className="text-muted-foreground/60 mx-2">·</span>
            {t("footer.tagline")}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            © {new Date().getFullYear()} Youssef Ahmed. {t("footer.rights")}
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 md:items-end">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 no-underline">
            <Link href="/how-it-works" className="hover:text-primary no-underline" data-testid="link-footer-how-it-works">
              {t("nav.howItWorks")}
            </Link>
            <Link href="/privacy" className="hover:text-primary no-underline" data-testid="link-footer-privacy">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-primary no-underline" data-testid="link-footer-terms">
              {t("footer.terms")}
            </Link>
            <Link href="/policy" className="hover:text-primary no-underline" data-testid="link-footer-policy">
              {t("footer.cancellation")}
            </Link>
            <Link
              href="/medical-disclaimer"
              className="hover:text-primary no-underline"
              data-testid="link-footer-medical"
            >
              {t("footer.medical")}
            </Link>
            <Link href="/cookies" className="hover:text-primary no-underline" data-testid="link-footer-cookies">
              {t("footer.cookies")}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/971505394754"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#25D366] text-white text-xs font-semibold no-underline shadow-lg shadow-[#25D366]/20 hover:bg-[#1faa55] transition-colors"
              data-testid="link-footer-whatsapp"
            >
              <SiWhatsapp size={14} className="shrink-0" />
              <span className="leading-tight whitespace-nowrap">{t("whatsapp.short", "Coach Youssef")}</span>
            </a>
            <a
              href="https://instagram.com/youssef.fitness"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-foreground/90 text-xs font-semibold no-underline hover:bg-white/10 transition-colors"
              data-testid="link-footer-instagram"
            >
              <SiInstagram size={14} className="shrink-0" />
              <span>{t("instagram.short")}</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
