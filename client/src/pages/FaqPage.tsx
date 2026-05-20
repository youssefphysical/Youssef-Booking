import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { FaqAccordion } from "@/components/public/FaqAccordion";
import { useTranslation } from "@/i18n";
import { buildContextMessage } from "@/lib/whatsapp";

export default function FaqPage() {
  const { t, lang } = useTranslation();

  useEffect(() => {
    document.title = `${t("faq.pageTitle")} — Youssef Ahmed`;
  }, [t]);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 pt-24 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
          data-testid="link-faq-back"
        >
          <ArrowLeft size={14} className="lucide-arrow-left" />
          {t("common.back", "Back")}
        </Link>
        <header className="mb-8 text-start">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
            <HelpCircle size={22} />
          </div>
          <p className="tron-eyebrow text-xs mb-3">{t("faq.eyebrow")}</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            {t("faq.title")}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-prose">
            {t("faq.subtitle")}
          </p>
        </header>

        <FaqAccordion />

        <div className="mt-10 tron-card rounded-2xl p-6 text-center">
          <h2 className="font-display font-bold text-lg mb-2">
            {t("faq.stillQuestions.title")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-prose mx-auto">
            {t("faq.stillQuestions.body")}
          </p>
          <WhatsAppButton
            label={t("faq.stillQuestions.cta")}
            message={buildContextMessage("contactCoach", { lang })}
            testId="faq-contact-whatsapp"
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
