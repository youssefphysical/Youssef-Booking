import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 mt-10">
      <div className="max-w-6xl mx-auto px-5 flex flex-col items-center gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="text-center md:text-left">
          <p className="font-display text-foreground/90 text-sm tracking-wide">
            <span className="text-gradient-blue font-semibold">Youssef Fitness</span>
            <span className="text-muted-foreground/60 mx-2">·</span>
            Personal Training, Dubai
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            © {new Date().getFullYear()} Youssef Ahmed. All rights reserved.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/how-it-works" className="hover:text-primary" data-testid="link-footer-how-it-works">
            How it Works
          </Link>
          <Link href="/privacy" className="hover:text-primary" data-testid="link-footer-privacy">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-primary" data-testid="link-footer-terms">
            Terms & Conditions
          </Link>
          <Link href="/policy" className="hover:text-primary" data-testid="link-footer-policy">
            Cancellation Policy
          </Link>
          <Link
            href="/medical-disclaimer"
            className="hover:text-primary"
            data-testid="link-footer-medical"
          >
            Medical Disclaimer
          </Link>
          <Link href="/cookies" className="hover:text-primary" data-testid="link-footer-cookies">
            Cookie Policy
          </Link>
          <a
            href="https://instagram.com/youssef.fitness"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary"
            data-testid="link-footer-instagram"
          >
            Instagram
          </a>
          <a
            href="https://wa.me/971505394754"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary"
            data-testid="link-footer-whatsapp"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
