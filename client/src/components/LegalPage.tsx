import { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/i18n";

interface Props {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
  summary?: string;
  children: ReactNode;
}

export function LegalPage({ eyebrow, title, lastUpdated, summary, children }: Props) {
  const { t } = useTranslation();
  const eyebrowText = eyebrow ?? t("legal.eyebrow");
  return (
    <div className="min-h-screen pt-24 pb-10">
      <div className="max-w-3xl mx-auto px-5">
        <Link
          href="/"
          data-testid="link-back-home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft size={14} /> {t("legal.backHome")}
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
            <ScrollText size={22} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-1">{eyebrowText}</p>
            <h1
              className="text-3xl md:text-4xl font-display font-bold leading-tight"
              data-testid="text-legal-title"
            >
              {title}
            </h1>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-2">{t("legal.lastUpdated").replace("{date}", lastUpdated)}</p>
            )}
          </div>
        </div>

        {summary && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 mb-6">
            <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
          </div>
        )}

        <article className="prose prose-invert prose-sm sm:prose-base max-w-none space-y-6">
          {children}
        </article>
      </div>
      <Footer />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-card/60 p-5 sm:p-6 [&_p]:text-sm [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p+p]:mt-3 [&_ul]:text-sm [&_ul]:text-muted-foreground [&_ul]:leading-relaxed [&_ul]:space-y-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-foreground">
      <h2 className="text-lg font-display font-bold mb-2 text-foreground">{title}</h2>
      {children}
    </section>
  );
}
