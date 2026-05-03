import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useTranslation } from "@/i18n";

export default function CookiePolicy() {
  const { t } = useTranslation();
  return (
    <LegalPage
      eyebrow={t("legal.eyebrow")}
      title={t("legal.cookiesTitle")}
      lastUpdated={t("legal.aprilDate")}
      summary={t("legal.cookieSummary")}
    >
      <LegalSection title={t("legal.cookies.sec1Title")}>
        <p>{t("legal.cookies.sec1Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.cookies.sec2Title")}>
        <ul>
          <li>
            <strong>{t("legal.cookies.sec2Li1Strong")}</strong> — {t("legal.cookies.sec2Li1Body")}
          </li>
          <li>
            <strong>{t("legal.cookies.sec2Li2Strong")}</strong> — {t("legal.cookies.sec2Li2Body")}
          </li>
          <li>
            <strong>{t("legal.cookies.sec2Li3Strong")}</strong> — {t("legal.cookies.sec2Li3Body")}
          </li>
        </ul>
      </LegalSection>

      <LegalSection title={t("legal.cookies.sec3Title")}>
        <p>{t("legal.cookies.sec3Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.cookies.sec4Title")}>
        <p>{t("legal.cookies.sec4Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.cookies.sec5Title")}>
        <p>
          {t("legal.cookies.sec5BodyPre")}{" "}
          <a className="text-primary hover:opacity-80" href="https://wa.me/971505394754">
            WhatsApp
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
